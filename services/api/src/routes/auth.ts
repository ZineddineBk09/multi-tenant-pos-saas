import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { and, db, eq, tenants, users, withTenantContext } from "@pos/database";
import { z } from "zod";
import { signToken } from "../lib/auth.js";
import { mapTenant, mapUser } from "../lib/mappers.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  app.get("/tenants", async () => {
    const rows = await db.select().from(tenants);
    return { data: rows.map(mapTenant) };
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { email, password, tenantSlug } = parsed.data;

    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);

    if (!tenant) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const user = await withTenantContext(tenant.id, async (tx) => {
      const [found] = await tx
        .select()
        .from(users)
        .where(and(eq(users.email, email), eq(users.tenantId, tenant.id)))
        .limit(1);
      return found ?? null;
    });

    if (!user) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const token = signToken({
      userId: user.id,
      tenantId: tenant.id,
      role: user.role,
      email: user.email,
    });

    return {
      token,
      user: mapUser(user),
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
}
