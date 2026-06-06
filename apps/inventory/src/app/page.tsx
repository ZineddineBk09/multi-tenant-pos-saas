"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "@pos/api-client";
import type { Category, Product } from "@pos/types";
import {
  AppShell,
  Badge,
  Button,
  DataTable,
  Dialog,
  Input,
  Label,
  PageHeader,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@pos/ui";

interface ProductForm {
  name: string;
  sku: string;
  price: string;
  stockQty: number;
  lowStockThreshold: number;
  categoryId: string;
}

const emptyForm: ProductForm = {
  name: "",
  sku: "",
  price: "",
  stockQty: 0,
  lowStockThreshold: 5,
  categoryId: "",
};

export default function InventoryPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adjustDialog, setAdjustDialog] = useState<Product | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [adjustDelta, setAdjustDelta] = useState(0);
  const [adjustReason, setAdjustReason] = useState("Manual adjustment");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (categoryFilter) params.set("categoryId", categoryFilter);

    const [productsRes, categoriesRes] = await Promise.all([
      apiFetch<{ data: Product[] }>(`/products?${params}`),
      apiFetch<{ data: Category[] }>("/categories"),
    ]);

    setProducts(productsRes.data);
    setCategories(categoriesRes.data);
    setLoading(false);
  }, [search, categoryFilter]);

  useEffect(() => {
    if (!getToken()) {
      window.location.href = "/login";
      return;
    }
    loadData().catch(() => router.push("/login"));
  }, [loadData, router]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      sku: product.sku,
      price: product.price,
      stockQty: product.stockQty,
      lowStockThreshold: product.lowStockThreshold,
      categoryId: product.categoryId ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const body = {
      ...form,
      categoryId: form.categoryId || null,
    };

    try {
      if (editing) {
        await apiFetch(`/products/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/products", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      setDialogOpen(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this product?")) return;
    await apiFetch(`/products/${id}`, { method: "DELETE" });
    await loadData();
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustDialog) return;

    try {
      await apiFetch("/inventory/adjust", {
        method: "POST",
        body: JSON.stringify({
          productId: adjustDialog.id,
          delta: adjustDelta,
          reason: adjustReason,
        }),
      });
      setAdjustDialog(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adjustment failed");
    }
  }

  return (
    <AppShell
      title="Inventory"
      nav={
        <nav className="flex gap-4 text-sm">
          <a href="/dashboard" className="text-slate-600 hover:text-slate-900">
            Dashboard
          </a>
          <a href="/inventory" className="font-medium text-slate-900">
            Inventory
          </a>
          <a href="/checkout" className="text-slate-600 hover:text-slate-900">
            Checkout
          </a>
        </nav>
      }
    >
      <PageHeader
        title="Inventory Manager"
        description="Products, categories, and stock levels for your store"
        actions={<Button onClick={openCreate}>Add Product</Button>}
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <Input
          placeholder="Search by name or SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="max-w-xs"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading products...</p>
      ) : (
        <DataTable>
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Product</TableHeaderCell>
                <TableHeaderCell>SKU</TableHeaderCell>
                <TableHeaderCell>Category</TableHeaderCell>
                <TableHeaderCell>Price</TableHeaderCell>
                <TableHeaderCell>Stock</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.sku}</TableCell>
                  <TableCell>{product.category?.name ?? "—"}</TableCell>
                  <TableCell>${product.price}</TableCell>
                  <TableCell>
                    <span className="mr-2">{product.stockQty}</span>
                    {product.stockQty <= product.lowStockThreshold && (
                      <Badge variant="warning">Low</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(product)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setAdjustDialog(product);
                          setAdjustDelta(0);
                        }}
                      >
                        Adjust
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(product.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTable>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? "Edit Product" : "Add Product"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="sku">SKU</Label>
            <Input id="sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="price">Price</Label>
            <Input id="price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="stock">Stock Qty</Label>
            <Input
              id="stock"
              type="number"
              value={form.stockQty}
              onChange={(e) => setForm({ ...form, stockQty: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              id="category"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full">
            {editing ? "Save Changes" : "Create Product"}
          </Button>
        </form>
      </Dialog>

      <Dialog
        open={!!adjustDialog}
        onClose={() => setAdjustDialog(null)}
        title={`Adjust Stock: ${adjustDialog?.name ?? ""}`}
      >
        <form onSubmit={handleAdjust} className="space-y-4">
          <div>
            <Label htmlFor="delta">Quantity Change (+/-)</Label>
            <Input
              id="delta"
              type="number"
              value={adjustDelta}
              onChange={(e) => setAdjustDelta(Number(e.target.value))}
              required
            />
          </div>
          <div>
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full">
            Apply Adjustment
          </Button>
        </form>
      </Dialog>
    </AppShell>
  );
}
