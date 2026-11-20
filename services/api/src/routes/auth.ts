import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { and, db, eq, tenants, users, withTenantContext } from "@pos/database";
import { z } from "zod";
import { signToken } from "../lib/auth.js";
import { mapTenant, mapUser } from "../lib/mappers.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().min(1).optional(),
});

export async function authRoutes(app: FastifyInstance) {
  app.get("/tenants", { preHandler: [app.authenticate] }, async (request, reply) => {
    const payload = request.user;
    if (!payload) return reply.status(401).send({ error: "Unauthorized" });

    if (String(payload.role) === "admin" || String(payload.role) === "super_admin") {
      const rows = await db.select().from(tenants);
      return { data: rows.map(mapTenant) };
    }

    const [ownTenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, payload.tenantId))
      .limit(1);

    return { data: ownTenant ? [mapTenant(ownTenant)] : [] };
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { email, password, tenantSlug } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    let targetTenantId: string | null = null;

    if (tenantSlug) {
      const [requestedTenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.slug, tenantSlug))
        .limit(1);

      if (!requestedTenant) {
        return reply.status(401).send({ error: "Invalid credentials" });
      }
      targetTenantId = requestedTenant.id;
    }

    const matchedUsers = await db
      .select()
      .from(users)
      .where(
        targetTenantId
          ? and(eq(users.email, normalizedEmail), eq(users.tenantId, targetTenantId))
          : eq(users.email, normalizedEmail),
      );

    if (matchedUsers.length === 0) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    let authenticatedUser = null;
    for (const candidate of matchedUsers) {
      const valid = await bcrypt.compare(password, candidate.passwordHash);
      if (valid) {
        authenticatedUser = candidate;
        break;
      }
    }

    if (!authenticatedUser) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, authenticatedUser.tenantId))
      .limit(1);

    if (!tenant) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const token = signToken({
      userId: authenticatedUser.id,
      tenantId: tenant.id,
      role: authenticatedUser.role,
      email: authenticatedUser.email,
    });

    return {
      token,
      user: mapUser(authenticatedUser),
      tenant: mapTenant(tenant),
    };
  });

  app.get("/auth/me", { preHandler: [app.authenticate] }, async (request, reply) => {
    const payload = request.user;
    if (!payload) return reply.status(401).send({ error: "Unauthorized" });

    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, payload.tenantId))
      .limit(1);

    const user = await withTenantContext(payload.tenantId, async (tx) => {
      const [found] = await tx.select().from(users).where(eq(users.id, payload.userId)).limit(1);
      return found ?? null;
    });

    if (!user || !tenant) {
      return reply.status(404).send({ error: "User not found" });
    }

    return { user: mapUser(user), tenant: mapTenant(tenant) };
  });

  // The single source of "which store am I?" for every page: always the logged-in tenant.
  app.get("/stores/current", { preHandler: [app.authenticate] }, async (request, reply) => {
    const payload = request.user;
    if (!payload) return reply.status(401).send({ error: "Unauthorized" });

    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, payload.tenantId))
      .limit(1);

    if (!tenant) return reply.status(404).send({ error: "Store not found" });

    return {
      slug: tenant.slug,
      name: tenant.name,
      details: tenant.address ?? "",
      phone: tenant.phone ?? "",
    };
  });

  // Lets a user replace the temporary password they were given at registration.
  app.post("/auth/change-password", { preHandler: [app.authenticate] }, async (request, reply) => {
    const payload = request.user;
    if (!payload) return reply.status(401).send({ error: "Unauthorized" });

    const parsed = z
      .object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(100) })
      .safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "New password must be at least 8 characters" });
    }

    const outcome = await withTenantContext(payload.tenantId, async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(and(eq(users.id, payload.userId), eq(users.tenantId, payload.tenantId)))
        .limit(1);
      if (!user) return "unauthorized" as const;

      const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
      if (!valid) return "wrong-password" as const;

      const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
      await tx
        .update(users)
        .set({ passwordHash })
        .where(and(eq(users.id, user.id), eq(users.tenantId, user.tenantId)));
      return "ok" as const;
    });

    if (outcome === "unauthorized") return reply.status(401).send({ error: "Unauthorized" });
    if (outcome === "wrong-password") {
      return reply.status(400).send({ error: "Current password is incorrect" });
    }

    return { success: true };
  });
}
