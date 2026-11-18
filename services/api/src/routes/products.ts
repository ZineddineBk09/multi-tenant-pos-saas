import type { FastifyInstance } from "fastify";
import { and, categories, eq, ilike, or, products } from "@pos/database";
import { z } from "zod";
import { mapCategory, mapProduct } from "../lib/mappers.js";
import { runWithTenant } from "../middleware/tenant-context.js";

const createProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  price: z.union([z.string(), z.number()]).transform((val) => String(val)),
  stockQty: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  categoryId: z.string().uuid().nullable().optional(),
});

const updateProductSchema = createProductSchema.partial();

const createCategorySchema = z.object({
  name: z.string().min(1),
});

const adjustStockSchema = z.object({
  productId: z.string().uuid(),
  delta: z.number().int(),
  reason: z.string().min(1),
});

export async function productRoutes(app: FastifyInstance) {
  app.get(
    "/products",
    async (request, reply) => {
      const query = request.query as { q?: string; categoryId?: string; t?: string };
      const q = query.q;
      const categoryId = query.categoryId;

      const result = await runWithTenant(request, reply, async (tx) => {
        const conditions = [];

        if (q) {
          conditions.push(
            or(ilike(products.name, `%${q}%`), ilike(products.sku, `%${q}%`)),
          );
        }
        if (categoryId) {
          conditions.push(eq(products.categoryId, categoryId));
        }

        const rows = await tx
          .select({ product: products, category: categories })
          .from(products)
          .leftJoin(categories, eq(products.categoryId, categories.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined);

        return rows.map(({ product, category }) => mapProduct(product, category));
      });

      return { data: result ?? [] };
    },
  );

  app.get(
    "/products/search",
    async (request, reply) => {
      const query = request.query as { q?: string };
      const q = query.q;
      if (!q) return { data: [] };

      const result = await runWithTenant(request, reply, async (tx) => {
        const rows = await tx
          .select({ product: products, category: categories })
          .from(products)
          .leftJoin(categories, eq(products.categoryId, categories.id))
          .where(
            or(ilike(products.name, `%${q}%`), ilike(products.sku, `%${q}%`)),
          )
          .limit(20);

        return rows.map(({ product, category }) => mapProduct(product, category));
      });

      return { data: result ?? [] };
    },
  );

  app.get(
    "/products/:id",
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const result = await runWithTenant(request, reply, async (tx) => {
        const [row] = await tx
          .select({ product: products, category: categories })
          .from(products)
          .leftJoin(categories, eq(products.categoryId, categories.id))
          .where(eq(products.id, id))
          .limit(1);

        return row ? mapProduct(row.product, row.category) : null;
      });

      if (!result) return reply.status(404).send({ error: "Product not found" });
      return result;
    },
  );

  app.post(
    "/products",
    async (request, reply) => {
      const parsed = createProductSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
      }

      // اب یہ ریکوئسٹ کے ہیڈر سے براہ راست اصل دکان (Tenant) کی آئی ڈی اٹھائے گا
      const tenantId = (request.headers["x-tenant-id"] as string) || "amin-cosmetics";
      const data = parsed.data;

      const result = await runWithTenant(request, reply, async (tx) => {
        const [product] = await tx
          .insert(products)
          .values({
            tenantId,
            name: data.name,
            sku: data.sku,
            price: data.price,
            stockQty: data.stockQty,
            lowStockThreshold: data.lowStockThreshold,
            categoryId: data.categoryId ?? null,
          })
          .returning();

        if (!product) return null;

        let category = null;
        if (product.categoryId) {
          const [catRow] = await tx
            .select()
            .from(categories)
            .where(eq(categories.id, product.categoryId))
            .limit(1);
          category = catRow || null;
        }

        return mapProduct(product, category);
      });

      return reply.status(201).send(result);
    },
  );

  app.patch(
    "/products/:id",
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateProductSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
      }

      const result = await runWithTenant(request, reply, async (tx) => {
        const [product] = await tx
          .update(products)
          .set({ ...parsed.data, updatedAt: new Date() })
          .where(eq(products.id, id))
          .returning();

        if (!product) return null;

        let category = null;
        if (product.categoryId) {
          const [catRow] = await tx
            .select()
            .from(categories)
            .where(eq(categories.id, product.categoryId))
            .limit(1);
          category = catRow || null;
        }

        return mapProduct(product, category);
      });

      if (!result) return reply.status(404).send({ error: "Product not found" });
      return result;
    },
  );

  app.delete(
    "/products/:id",
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const result = await runWithTenant(request, reply, async (tx) => {
        const [product] = await tx
          .delete(products)
          .where(eq(products.id, id))
          .returning();

        return product;
      });

      if (!result) return reply.status(404).send({ error: "Product not found" });
      return { success: true };
    },
  );

  app.get(
    "/categories",
    async (request, reply) => {
      const result = await runWithTenant(request, reply, async (tx) => {
        const rows = await tx.select().from(categories);
        return rows.map(mapCategory);
      });

      return { data: result ?? [] };
    },
  );

  app.post(
    "/categories",
    async (request, reply) => {
      const parsed = createCategorySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
      }

      const tenantId = (request.headers["x-tenant-id"] as string) || "amin-cosmetics";

      const result = await runWithTenant(request, reply, async (tx) => {
        const [category] = await tx
          .insert(categories)
          .values({ tenantId, name: parsed.data.name })
          .returning();

        return category ? mapCategory(category) : null;
      });

      return reply.status(201).send(result);
    },
  );

  app.post(
    "/inventory/adjust",
    async (request, reply) => {
      const parsed = adjustStockSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
      }

      const tenantId = (request.headers["x-tenant-id"] as string) || "amin-cosmetics";
      const { productId, delta, reason } = parsed.data;

      const result = await runWithTenant(request, reply, async (tx) => {
        const { inventoryMovements } = await import("@pos/database");

        const [product] = await tx
          .select()
          .from(products)
          .where(eq(products.id, productId))
          .limit(1);

        if (!product) return null;

        const newQty = product.stockQty + delta;
        if (newQty < 0) {
          throw new Error("Insufficient stock");
        }

        const [updated] = await tx
          .update(products)
          .set({ stockQty: newQty, updatedAt: new Date() })
          .where(eq(products.id, productId))
          .returning();

        await tx.insert(inventoryMovements).values({
          tenantId,
          productId,
          delta,
          reason,
        });

        let category = null;
        if (updated && updated.categoryId) {
          const [catRow] = await tx
            .select()
            .from(categories)
            .where(eq(categories.id, updated.categoryId))
            .limit(1);
          category = catRow || null;
        }

        return updated ? mapProduct(updated, category) : null;
      });

      if (!result) {
        if (reply.sent) return;
        return reply.status(404).send({ error: "Product not found" });
      }

      return result;
    },
  );
}
