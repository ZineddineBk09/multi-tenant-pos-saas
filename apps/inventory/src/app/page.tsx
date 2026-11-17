"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "@pos/api-client";
import type { Product } from "@pos/types";
import {
  AppShell,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
} from "@pos/ui";

interface StoreProfile {
  name: string;
  details: string;
  phone: string;
}

export default function InventoryPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // New Product Form State
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [stockQty, setStockQty] = useState("100");

  const [storeInfo, setStoreInfo] = useState<StoreProfile>({
    name: "Imdad Cosmetics",
    details: "Shop # B1-A, Kamil Plaza, Basement Bara Bazar, Rawalpindi",
    phone: "03451523394",
  });

  const storeProfiles: Record<string, StoreProfile> = {
    "imdad-cosmetics": {
      name: "Imdad Cosmetics",
      details: "Shop # B1-A, Kamil Plaza, Basement Bara Bazar, Rawalpindi",
      phone: "03451523394",
    },
  };

  useEffect(() => {
    if (!getToken()) {
      window.location.href = "/login";
      return;
    }

    const currentTenant = process.env.NEXT_PUBLIC_TENANT_ID || "imdad-cosmetics";
    setStoreInfo(
      storeProfiles[currentTenant as keyof typeof storeProfiles] || {
        name: "Imdad Cosmetics",
        details: "Shop # B1-A, Kamil Plaza, Basement Bara Bazar, Rawalpindi",
        phone: "03451523394",
      }
    );

    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch<{ data: Product[] }>("/products");
      if (res && res.data) {
        setProducts(res.data);
      } else {
        setProducts([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products from server.");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  // Add Single Product
  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !price) {
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
      setError("پروڈکٹ سیو کرنے میں خرابی ہوئی۔");
    }
  }

  // Handle Bulk CSV Import (Copy-Paste or Excel Import)
  const handleCSVImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        if (!text) return;
        
        const lines = text.split("\n");
        let importedCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const cols = line.split(",");
          if (cols.length >= 2) {
            const pName = cols[1]?.replace(/["']/g, "").trim() || "Imported Item";
            const pSku = cols[0]?.replace(/["']/g, "").trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
            const pPrice = cols[2]?.replace(/["']/g, "").trim() || "100";
            const pStock = parseInt(cols[3]?.replace(/["']/g, "").trim()) || 50;

            try {
              const saved = await apiFetch<Product>("/products", {
                method: "POST",
                body: JSON.stringify({ name: pName, sku: pSku, price: pPrice, stockQty: pStock }),
              });
              if (saved) {
                importedCount++;
              }
            } catch {}
          }
        }
        alert(`کامیابی کے ساتھ ${importedCount} پروڈکٹس امپورٹ ہو گئی ہیں!`);
        loadProducts();
      };
      reader.readAsText(file);
    }
  };

  function exportToCSV() {
    if (products.length === 0) {
      alert("No products available to export.");
      return;
    }

    const headers = ["Barcode / SKU", "Item Name", "Price (Rs)", "Stock Qty", "Status"];
    const rows = products.map((p) => [
      `"${p.sku || ""}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      p.price,
      p.stockQty,
      p.stockQty > 5 ? "In Stock" : p.stockQty > 0 ? "Low Stock" : "Out of Stock",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `imdad_cosmetics_inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

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
          <h1 className="text-2xl font-bold text-slate-900">{storeInfo.name}</h1>
          <p className="text-sm text-slate-700 font-medium">{storeInfo.details} | Ph: {storeInfo.phone}</p>
        </div>
        <Button
          onClick={() => router.push("/checkout")}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
        >
          Go to Checkout ➔
        </Button>
      </div>

      <PageHeader
        title="Inventory Manager"
        description="Products, barcodes, and stock levels saved securely on server"
      />

      {/* Bulk Import Section */}
      <div className="bg-slate-50 border border-dashed border-slate-300 p-4 rounded-xl mb-6">
        <label className="font-bold block mb-1 text-slate-800 text-sm">
          📁 پرانا ڈیٹا یا کسٹمر/پروڈکٹ لسٹ امپورٹ کریں (Bulk CSV File Import):
        </label>
        <p className="text-xs text-slate-500 mb-2">اپنی CSV فائل یہاں سلیکٹ کریں تاکہ سارا پرانا ڈیٹا خود بخود سسٹم میں آ جائے:</p>
        <input type="file" accept=".csv" onChange={handleCSVImport} className="text-sm" />
      </div>

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

        {/* Search & Actions */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Search & Manage Inventory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <Input
                placeholder="Search by product name or SKU/Barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-md h-11 bg-white"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={loadProducts}
                  className="h-11 border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  🔄 Refresh
                </Button>
                <Button
                  onClick={exportToCSV}
                  className="h-11 bg-green-600 hover:bg-green-700 text-white"
                >
                  📊 Export to CSV
                </Button>
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Total Products in Database: <span className="font-bold text-slate-900">{products.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl mb-4 flex justify-between items-center">
          <p className="text-sm font-medium">{error}</p>
          <Button size="sm" onClick={loadProducts} className="bg-blue-600 hover:bg-blue-700 text-white">
            Retry
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
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
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500 font-medium">
                  Loading inventory items... Please wait.
                </td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  No products found in inventory. Add a new product or import CSV above.
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{product.sku}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{product.name}</td>
                  <td className="px-4 py-3 text-right font-medium">Rs {product.price}</td>
                  <td className="px-4 py-3 text-center font-bold">{product.stockQty}</td>
                  <td className="px-4 py-3 text-center">
                    {product.stockQty > 5 ? (
                      <Badge variant="success">In Stock</Badge>
                    ) : product.stockQty > 0 ? (
                      <Badge variant="warning">Low Stock</Badge>
                    ) : (
                      <Badge variant="destructive">Out of Stock</Badge>
                    )}
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
