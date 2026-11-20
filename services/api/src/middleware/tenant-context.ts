import type { FastifyRequest } from "fastify";
import type { DbTransaction } from "@pos/database";
import { withTenantContext } from "@pos/database";

export type TenantDb = DbTransaction;

/**
 * The tenant ALWAYS comes from the verified login token (request.user), never
 * from a client header or a default. Routes that use this must run behind
 * app.authenticate.
 */
export function requireTenantId(request: FastifyRequest): string {
  const tenantId = request.user?.tenantId;
  if (!tenantId) {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  }
  return tenantId;
}

export async function runWithTenant<T>(
  request: FastifyRequest,
  fn: (tx: TenantDb, tenantId: string) => Promise<T>,
): Promise<T> {
  const tenantId = requireTenantId(request);
  return withTenantContext(tenantId, (tx) => fn(tx, tenantId));
}
