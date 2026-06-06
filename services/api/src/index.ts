import cors from "@fastify/cors";
import Fastify from "fastify";
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
