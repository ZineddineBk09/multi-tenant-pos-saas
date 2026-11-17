"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "@pos/api-client";
import type { Product } from "@pos/types";
import {
  AppShell,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
} from "@pos/ui";

export default function InventoryPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // New Product Form State
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [stockQty, setStockQty] = useState("100");

  useEffect(() => {
    if (!getToken()) {
      window.location.href = "/login";
      return;
    }
    loadInventory();
  }, []);

  async function loadInventory() {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: Product[] }>("/products");
      if (res && res.data) {
        setProducts(res.data);
      }
    } catch (err) {
      console.error("Failed to load inventory", err);
      setError("انوینٹری لوڈ کرنے میں مسئلہ پیش آیا۔");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !price) {
      alert("براہ کرم پروڈکٹ کا نام اور قیمت درج کریں!");
      return;
    }

    try {
      const newProduct = await apiFetch<Product>("/products", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          sku: sku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
          price: price.trim(),
          stockQty: parseInt(stockQty) || 100,
        }),
      });

      if (newProduct) {
        setProducts((prev) => [newProduct, ...prev]);
        setName("");
        setSku("");
        setPrice("");
        setStockQty("100");
        setError("✔ پروڈکٹ کامیابی کے ساتھ انوینٹری میں ایڈ ہو گئی ہے!");
      }
    } catch (err) {
      console.error("Failed to add product", err);
      setError("پروڈکٹ سیو کرنے میں خرابی ہوئی۔ براہ کرم دوبارہ کوشش کریں۔");
    }
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <div className="mb-4 border-b border-slate-200 pb-3 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Imdad Cosmetics</h1>
          <p className="text-sm text-slate-600">Shop # B1-A, Kamil Plaza, Basement Bara Bazar, Rawalpindi</p>
        </div>
        <Button
          onClick={() => router.push("/checkout")}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
        >
          Go to Checkout →
        </Button>
      </div>

      <PageHeader title="Inventory Manager" description="Add, manage, and track products securely." />

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        {/* Add Product Form */}
        <Card className="lg:col-span-1 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">➕ Add New Product</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddProduct} className="space-y-3">
              <Input
                placeholder="Product Name (e.g. Shampoo)..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                placeholder="Barcode / SKU (Optional)..."
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Price (Rs)..."
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
              <Input
                type="number"
                placeholder="Stock Qty..."
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
              />
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold">
                Save to Inventory
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Search & Stats */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Search Inventory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by product name or SKU/Barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Button onClick={loadInventory} variant="outline">
                Refresh
              </Button>
            </div>

            {error && (
              <div className="p-2 text-sm bg-blue-50 text-blue-800 rounded font-medium">
                {error}
              </div>
            )}

            <div className="text-xs text-slate-500">
              Total Products in Database: <span className="font-bold text-slate-900">{products.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100 text-slate-700 text-xs uppercase border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Barcode / SKU</th>
              <th className="px-4 py-3">Item Name</th>
              <th className="px-4 py-3 text-right">Price (Rs)</th>
              <th className="px-4 py-3 text-center">Stock Qty</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Loading inventory...
                </td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  کوئی پروڈکٹ نہیں ملی۔ اوپر فارم سے نئی پروڈکٹ ایڈ کریں۔
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.sku || "N/A"}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 text-right font-medium">Rs {Number(p.price || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-center font-bold">{p.stockQty ?? 99}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                      In Stock
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
