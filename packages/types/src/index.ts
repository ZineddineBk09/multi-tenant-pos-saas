export type UserRole = "owner" | "manager" | "cashier";

export type OrderStatus = "pending" | "completed" | "cancelled";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  plan: string;
  createdAt: string;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  createdAt: string;
}

export interface Product {
  id: string;
  tenantId: string;
  categoryId: string | null;
  name: string;
  sku: string;
  price: string;
  stockQty: number;
  lowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
  category?: Category | null;
}

export interface InventoryMovement {
  id: string;
  tenantId: string;
  productId: string;
  delta: number;
  reason: string;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  tenantId: string;
  quantity: number;
  unitPrice: string;
  productName: string;
}

export interface Order {
  id: string;
  tenantId: string;
  cashierId: string;
  status: OrderStatus;
  subtotal: string;
  tax: string;
  total: string;
  createdAt: string;
  items?: OrderItem[];
}

export interface AuthResponse {
  token: string;
  user: User;
  tenant: Tenant;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}
