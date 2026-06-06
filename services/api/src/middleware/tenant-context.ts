import type { FastifyReply, FastifyRequest } from "fastify";
import type { DbTransaction } from "@pos/database";
import { withTenantContext } from "@pos/database";

export type TenantDb = DbTransaction;

export async function runWithTenant<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  fn: (tx: TenantDb) => Promise<T>,
): Promise<T | undefined> {
  if (!request.user) {
    reply.status(401).send({ error: "Unauthorized" });
    return undefined;
  }

  return withTenantContext(request.user.tenantId, fn);
}
