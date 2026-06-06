import type { FastifyInstance } from "fastify";
import { eq, orderItems, orders, products } from "@pos/database";
import { z } from "zod";
import { mapOrder } from "../lib/mappers.js";
import { runWithTenant } from "../middleware/tenant-context.js";

const TAX_RATE = 0.08;

const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1),
      }),
    )
    .min(1),
});

export async function orderRoutes(app: FastifyInstance) {
  app.post(
    "/orders",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = createOrderSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
      }

      const tenantId = request.user!.tenantId;
      const cashierId = request.user!.userId;

      try {
        const result = await runWithTenant(request, reply, async (tx) => {
          let subtotal = 0;
          const lineItems: Array<{
            productId: string;
            quantity: number;
            unitPrice: string;
            productName: string;
          }> = [];

          for (const item of parsed.data.items) {
            const [product] = await tx
              .select()
              .from(products)
              .where(eq(products.id, item.productId))
              .limit(1);

            if (!product) {
              throw new Error(`Product ${item.productId} not found`);
            }

            if (product.stockQty < item.quantity) {
              throw new Error(`Insufficient stock for ${product.name}`);
            }

            const unitPrice = parseFloat(product.price);
            subtotal += unitPrice * item.quantity;

            lineItems.push({
              productId: product.id,
              quantity: item.quantity,
              unitPrice: product.price,
              productName: product.name,
            });
          }

          const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
          const total = Math.round((subtotal + tax) * 100) / 100;

          const [order] = await tx
            .insert(orders)
            .values({
              tenantId,
              cashierId,
              status: "completed",
              subtotal: subtotal.toFixed(2),
              tax: tax.toFixed(2),
              total: total.toFixed(2),
            })
            .returning();

          if (!order) throw new Error("Failed to create order");

          await tx.insert(orderItems).values(
            lineItems.map((item) => ({
              orderId: order.id,
              tenantId,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              productName: item.productName,
            })),
          );

          for (const item of parsed.data.items) {
            const [currentProduct] = await tx
              .select()
              .from(products)
              .where(eq(products.id, item.productId))
              .limit(1);

            if (currentProduct) {
              await tx
                .update(products)
                .set({
                  stockQty: currentProduct.stockQty - item.quantity,
                  updatedAt: new Date(),
                })
                .where(eq(products.id, item.productId));
            }
          }

          const items = await tx
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, order.id));

          return { ...mapOrder(order), items };
        });

        return reply.status(201).send(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Order failed";
        return reply.status(400).send({ error: message });
      }
    },
  );

  app.get(
    "/orders/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const result = await runWithTenant(request, reply, async (tx) => {
        const [order] = await tx.select().from(orders).where(eq(orders.id, id)).limit(1);
        if (!order) return null;

        const items = await tx
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, id));

        return {
          ...mapOrder(order),
          items: items.map((item) => ({
            id: item.id,
            orderId: item.orderId,
            productId: item.productId,
            tenantId: item.tenantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            productName: item.productName,
          })),
        };
      });

      if (!result) return reply.status(404).send({ error: "Order not found" });
      return result;
    },
  );
}
