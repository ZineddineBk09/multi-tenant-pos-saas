import type { Category, Order, Product, Tenant, User } from "@pos/types";
import type {
  categories as categoriesTable,
  orders as ordersTable,
  products as productsTable,
  tenants as tenantsTable,
  users as usersTable,
} from "@pos/database";

type DbTenant = typeof tenantsTable.$inferSelect;
type DbUser = typeof usersTable.$inferSelect;
type DbCategory = typeof categoriesTable.$inferSelect;
type DbProduct = typeof productsTable.$inferSelect;
type DbOrder = typeof ordersTable.$inferSelect;

export function mapTenant(row: DbTenant): Tenant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    plan: row.plan,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapUser(row: DbUser): User {
  return {
    id: row.id,
    tenantId: row.tenantId,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapCategory(row: DbCategory): Category {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapProduct(
  row: DbProduct,
  category?: DbCategory | null,
): Product {
  return {
    id: row.id,
    tenantId: row.tenantId,
    categoryId: row.categoryId,
    name: row.name,
    sku: row.sku,
    price: row.price,
    stockQty: row.stockQty,
    lowStockThreshold: row.lowStockThreshold,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    category: category ? mapCategory(category) : null,
  };
}

export function mapOrder(row: DbOrder): Order {
  return {
    id: row.id,
    tenantId: row.tenantId,
    cashierId: row.cashierId,
    status: row.status,
    subtotal: row.subtotal,
    tax: row.tax,
    total: row.total,
    createdAt: row.createdAt.toISOString(),
  };
}
