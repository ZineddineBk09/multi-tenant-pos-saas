import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import type { UserRole } from "@pos/types";

export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    reply.status(401).send({ error: "Unauthorized" });
    return;
  }

  try {
    const token = header.slice(7);
    request.user = verifyToken(token);
  } catch {
    reply.status(401).send({ error: "Invalid token" });
  }
}
