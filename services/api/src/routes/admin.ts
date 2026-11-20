import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { eq, tenantCards, tenants, users, withTenantContext } from "@pos/database";
import { z } from "zod";
import { runWithTenant } from "../middleware/tenant-context.js";

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");

const createTenantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().optional(),
  address: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(80).optional(),
  ownerName: z.string().trim().min(1).max(120).optional(),
  ownerEmail: z.string().trim().toLowerCase().email().optional(),
  cardImageBase64: z.string().optional(),
  cardImageMime: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
});

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * Admin-only access. The key lives in the ADMIN_API_KEY environment variable
 * (at least 24 characters). If it is not set, these endpoints are disabled.
 */
async function requireAdminKey(request: FastifyRequest, reply: FastifyReply) {
  const configured = process.env.ADMIN_API_KEY ?? "";
  if (configured.length < 24) {
    return reply.status(503).send({ error: "Admin API is not configured" });
  }
  const provided = String(request.headers["x-admin-key"] ?? "");
  const ok = timingSafeEqual(sha256(provided), sha256(configured));
  if (!ok) return reply.status(401).send({ error: "Unauthorized" });
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
  });

  // Register a new shop: store + owner login + (optional) visiting card image, in one transaction.
  app.post(
    "/admin/tenants",
    { preHandler: [requireAdminKey], bodyLimit: 9 * 1024 * 1024 },
    async (request, reply) => {
      const parsed = createTenantSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
      }
      const data = parsed.data;

      const slug = slugify(data.slug || data.name);
      if (!slug || !SLUG_RE.test(slug)) {
        return reply.status(400).send({ error: "Could not build a valid store ID from the name" });
      }

      let image: Buffer | null = null;
      if (data.cardImageBase64) {
        if (!data.cardImageMime) {
          return reply.status(400).send({ error: "cardImageMime is required with cardImageBase64" });
        }
        image = Buffer.from(data.cardImageBase64, "base64");
        if (image.length === 0 || image.length > MAX_IMAGE_BYTES) {
          return reply.status(400).send({ error: "Card image is empty or larger than 6 MB" });
        }
      }

      const tenantId = randomUUID();
      const temporaryPassword = randomBytes(9).toString("base64url"); // 12 characters
      const passwordHash = await bcrypt.hash(temporaryPassword, 10);
      const loginEmail = data.ownerEmail ?? `owner@${slug}.pos`;

      const created = await withTenantContext(tenantId, async (tx) => {
        const [tenant] = await tx
          .insert(tenants)
          .values({
            id: tenantId,
            slug,
            name: data.name,
            address: data.address || null,
            phone: data.phone || null,
          })
          .onConflictDoNothing({ target: tenants.slug })
          .returning();

        if (!tenant) return null; // this store ID already exists

        await tx.insert(users).values({
          tenantId,
          email: loginEmail,
          passwordHash,
          name: data.ownerName ?? `${data.name} Owner`,
          role: "owner",
        });

        if (image && data.cardImageMime) {
          await tx.insert(tenantCards).values({
            tenantId,
            mimeType: data.cardImageMime,
            image,
          });
        }
        return tenant;
      });

      if (!created) {
        return reply.status(409).send({ error: `A store with the ID "${slug}" already exists` });
      }

      return reply.status(201).send({
        tenantId: created.id,
        slug: created.slug,
        name: created.name,
        loginEmail,
        temporaryPassword,
        hasCardImage: Boolean(image),
      });
    },
  );
}

// The logged-in store's own visiting card image (used by the dashboard).
export async function storeCardRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/stores/current/card", async (request, reply) => {
    const row = await runWithTenant(request, async (tx, tenantId) => {
      const [card] = await tx
        .select()
        .from(tenantCards)
        .where(eq(tenantCards.tenantId, tenantId))
        .limit(1);
      return card ?? null;
    });

    if (!row) return reply.status(404).send({ error: "No visiting card on file" });

    return reply
      .header("Content-Type", row.mimeType)
      .header("Cache-Control", "private, no-store")
      .send(row.image);
  });
}
