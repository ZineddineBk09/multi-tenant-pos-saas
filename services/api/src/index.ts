import cors from "@fastify/cors";
import Fastify from "fastify";
import { ZodError } from "zod";
import { authenticate } from "./lib/auth.js";
import { authRoutes } from "./routes/auth.js";
import { orderRoutes } from "./routes/orders.js";
import { productRoutes } from "./routes/products.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: typeof authenticate;
  }
}

const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:3000";

async function buildApp() {
  const app = Fastify({ logger: true });

  app.decorate("authenticate", authenticate);

  await app.register(cors, {
    origin: [
      CORS_ORIGIN,
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
    ],
    credentials: true,
  });

  // 👇 یہ نیا ایرر ہینڈلر شامل کیا گیا ہے تاکہ 500 انٹرنل سرور ایرر کی اصل وجہ اور Zod ویلیڈیشن کا پتہ چل سکے
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: "Invalid input", issues: err.flatten() });
    }
    req.log.error({ err }, "unhandled error");
    const code = (err as any).code; // Postgres error code
    if (code === "23505") return reply.status(409).send({ error: "SKU already exists" });
    if (code === "23502") return reply.status(400).send({ error: "Missing required field" });
    if (code === "42703" || code === "42P01") {
      return reply.status(500).send({ error: "Database schema out of date" });
    }
    return reply.status(500).send({ error: "Internal server error" });
  });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(authRoutes);
  await app.register(productRoutes);
  await app.register(orderRoutes);

  return app;
}

async function main() {
  const app = await buildApp();
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`API listening on http://localhost:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

export { buildApp };
