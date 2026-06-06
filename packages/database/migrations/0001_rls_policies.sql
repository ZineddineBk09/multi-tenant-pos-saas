-- Row-Level Security policies for tenant isolation
-- Applied after Drizzle schema migration

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements FORCE ROW LEVEL SECURITY;

-- Users
CREATE POLICY users_select ON users FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY users_insert ON users FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY users_update ON users FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY users_delete ON users FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Categories
CREATE POLICY categories_select ON categories FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY categories_insert ON categories FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY categories_update ON categories FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY categories_delete ON categories FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Products
CREATE POLICY products_select ON products FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY products_insert ON products FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY products_update ON products FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY products_delete ON products FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Orders
CREATE POLICY orders_select ON orders FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY orders_insert ON orders FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY orders_update ON orders FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY orders_delete ON orders FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Order items
CREATE POLICY order_items_select ON order_items FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY order_items_insert ON order_items FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY order_items_update ON order_items FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY order_items_delete ON order_items FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Inventory movements
CREATE POLICY inventory_movements_select ON inventory_movements FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY inventory_movements_insert ON inventory_movements FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY inventory_movements_update ON inventory_movements FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY inventory_movements_delete ON inventory_movements FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Unique constraints per tenant
CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_email_idx ON users (tenant_id, email);
CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_sku_idx ON products (tenant_id, sku);
CREATE UNIQUE INDEX IF NOT EXISTS categories_tenant_name_idx ON categories (tenant_id, name);
