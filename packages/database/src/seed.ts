import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  categories,
  client,
  db,
  orderItems,
  orders,
  products,
  tenants,
  users,
  withTenantContext,
} from "./index.js";

const DEMO_PASSWORD = "demo1234";

async function seed() {
  console.log("Seeding database...");

  const existing = await db.select().from(tenants).limit(1);
  if (existing.length > 0) {
    console.log("Database already seeded, skipping.");
    await client.end();
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // امداد کاسمیٹک (Imdad Cosmetics) کا ٹیننٹ بنائیں
  const [imdad] = await db
    .insert(tenants)
    .values({ slug: "imdad-cosmetics", name: "Imdad Cosmetics", plan: "pro" })
    .returning();

  if (!imdad) throw new Error("Failed to create tenants");

  await withTenantContext(imdad.id, async (tx) => {
    await tx.insert(users).values([
      {
        tenantId: imdad.id,
        email: "owner@imdad.demo",
        passwordHash,
        name: "Nasir Owner",
        role: "owner",
      },
    ]);
  });

  await withTenantContext(imdad.id, async (tx) => {
    const imdadCategories = await tx
      .insert(categories)
      .values([
        { tenantId: imdad.id, name: "Makeup" },
        { tenantId: imdad.id, name: "Skincare" },
        { tenantId: imdad.id, name: "Hair Care" },
      ])
      .returning();

    const imdadProducts = [
      { name: "Lipstick Matte", sku: "IMD-001", price: "450.00", stockQty: 30, cat: 0 },
      { name: "Face Powder", sku: "IMD-002", price: "650.00", stockQty: 20, cat: 0 },
      { name: "Foundation Liquid", sku: "IMD-003", price: "1200.00", stockQty: 15, cat: 0 },
      { name: "Eyeliner Waterproof", sku: "IMD-004", price: "350.00", stockQty: 25, cat: 0 },
      { name: "Whitening Cream", sku: "IMD-005", price: "850.00", stockQty: 18, cat: 1 },
      { name: "Face Wash", sku: "IMD-006", price: "500.00", stockQty: 25, cat: 1 },
      { name: "Sunblock SPF 60", sku: "IMD-007", price: "950.00", stockQty: 12, cat: 1 },
      { name: "Shampoo Bottle", sku: "IMD-008", price: "750.00", stockQty: 30, cat: 2 },
      { name: "Hair Serum", sku: "IMD-009", price: "600.00", stockQty: 14, cat: 2 },
      { name: "Hair Oil", sku: "IMD-010", price: "400.00", stockQty: 40, cat: 2 },
    ];

    await tx
      .insert(products)
      .values(
        imdadProducts.map((p) => ({
          tenantId: imdad.id,
          categoryId: imdadCategories[p.cat]?.id ?? null,
          name: p.name,
          sku: p.sku,
          price: p.price,
          stockQty: p.stockQty,
          lowStockThreshold: 5,
        })),
      );
  });

  console.log("Seed complete for Imdad Cosmetics.");
  await client.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
