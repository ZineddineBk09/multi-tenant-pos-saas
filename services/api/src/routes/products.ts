import type { FastifyInstance } from "fastify";
import { and, categories, eq, ilike, inventoryMovements, or, products } from "@pos/database";
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

const idParamSchema = z.object({ id: z.string().uuid() });

export async function productRoutes(app: FastifyInstance) {
  // Every route below needs a valid login. The tenant is taken from the token only.
  app.addHook("preHandler", app.authenticate);
  // Lists must never be cached by the browser or a proxy (stale lists made new items look "missing").
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
  });

  async function categoryFor(
    tx: Parameters<Parameters<typeof runWithTenant>[1]>[0],
    tenantId: string,
    categoryId: string | null | undefined,
  ) {
    if (!categoryId) return null;
    const [row] = await tx
      .select()
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.tenantId, tenantId)))
      .limit(1);
    return row ?? null;
  }

  app.get("/products", async (request) => {
    const { q, categoryId } = request.query as { q?: string; categoryId?: string };

    const result = await runWithTenant(request, async (tx, tenantId) => {
      const conditions = [eq(products.tenantId, tenantId)];
      if (q) {
        conditions.push(
          or(ilike(products.name, `%${q}%`), ilike(products.sku, `%${q}%`))!,
        );
      }
      if (categoryId) conditions.push(eq(products.categoryId, categoryId));

      const rows = await tx
        .select({ product: products, category: categories })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(and(...conditions))
        .orderBy(products.createdAt);

      return rows.map(({ product, category }) => mapProduct(product, category));
    });

    return { data: result };
  });

  app.get("/products/search", async (request) => {
    const { q } = request.query as { q?: string };
    if (!q) return { data: [] };

    const result = await runWithTenant(request, async (tx, tenantId) => {
      const rows = await tx
        .select({ product: products, category: categories })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(
          and(
            eq(products.tenantId, tenantId),
            or(ilike(products.name, `%${q}%`), ilike(products.sku, `%${q}%`)),
          ),
        )
        .limit(20);

      return rows.map(({ product, category }) => mapProduct(product, category));
    });

    return { data: result };
  });

  app.get("/products/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);

    const result = await runWithTenant(request, async (tx, tenantId) => {
      const [row] = await tx
        .select({ product: products, category: categories })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
        .limit(1);

      return row ? mapProduct(row.product, row.category) : null;
    });

    if (!result) return reply.status(404).send({ error: "Product not found" });
    return result;
  });

  app.post("/products", async (request, reply) => {
    const parsed = createProductSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    }
    const data = parsed.data;

    const result = await runWithTenant(request, async (tx, tenantId) => {
      const category = await categoryFor(tx, tenantId, data.categoryId);
      if (data.categoryId && !category) return "bad-category" as const;

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

      return product ? mapProduct(product, category) : null;
    });

    if (result === "bad-category") return reply.status(400).send({ error: "Category not found" });
    if (!result) return reply.status(500).send({ error: "Could not save product" });
    return reply.status(201).send(result);
  });

  app.patch("/products/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const parsed = updateProductSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const result = await runWithTenant(request, async (tx, tenantId) => {
      if (parsed.data.categoryId) {
        const cat = await categoryFor(tx, tenantId, parsed.data.categoryId);
        if (!cat) return "bad-category" as const;
      }

      const [product] = await tx
        .update(products)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
        .returning();

      if (!product) return null;
      return mapProduct(product, await categoryFor(tx, tenantId, product.categoryId));
    });

    if (result === "bad-category") return reply.status(400).send({ error: "Category not found" });
    if (!result) return reply.status(404).send({ error: "Product not found" });
    return result;
  });

  app.delete("/products/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);

    const result = await runWithTenant(request, async (tx, tenantId) => {
      const [product] = await tx
        .delete(products)
        .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
        .returning();
      return product;
    });

    if (!result) return reply.status(404).send({ error: "Product not found" });
    return { success: true };
  });

  app.get("/categories", async (request) => {
    const result = await runWithTenant(request, async (tx, tenantId) => {
      const rows = await tx.select().from(categories).where(eq(categories.tenantId, tenantId));
      return rows.map(mapCategory);
    });
    return { data: result };
  });

  app.post("/categories", async (request, reply) => {
    const parsed = createCategorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const result = await runWithTenant(request, async (tx, tenantId) => {
      const [category] = await tx
        .insert(categories)
        .values({ tenantId, name: parsed.data.name })
        .returning();
      return category ? mapCategory(category) : null;
    });

    if (!result) return reply.status(500).send({ error: "Could not save category" });
    return reply.status(201).send(result);
  });

  app.post("/inventory/adjust", async (request, reply) => {
    const parsed = adjustStockSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    }
    const { productId, delta, reason } = parsed.data;

    try {
      const result = await runWithTenant(request, async (tx, tenantId) => {
        const [product] = await tx
          .select()
          .from(products)
          .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
          .limit(1);

        if (!product) return null;

        const newQty = product.stockQty + delta;
        if (newQty < 0) throw new Error("Insufficient stock");

        const [updated] = await tx
          .update(products)
          .set({ stockQty: newQty, updatedAt: new Date() })
          .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
          .returning();

        await tx.insert(inventoryMovements).values({ tenantId, productId, delta, reason });

        return updated
          ? mapProduct(updated, await categoryFor(tx, tenantId, updated.categoryId))
          : null;
      });

      if (!result) return reply.status(404).send({ error: "Product not found" });
      return result;
    } catch (error) {
      if (error instanceof Error && error.message === "Insufficient stock") {
        return reply.status(400).send({ error: "Insufficient stock" });
      }
      throw error;
    }
  });
}
