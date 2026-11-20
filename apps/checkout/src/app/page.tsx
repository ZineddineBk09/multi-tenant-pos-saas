"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "@pos/api-client";
import type { Product } from "@pos/types";
import { Html5Qrcode } from "html5-qrcode";
import {
  AppShell,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@pos/ui";

interface CartItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  qty: number;
}

// Robust Invoice Helper Functions (LocalStorage synced)
// Invoice numbers are counted per store so two shops on one device never share a counter.
let invoiceScope = "unscoped";
const invoiceKey = () => `pos:nextInvoiceNo:${invoiceScope}`;
const INVOICE_SEED = 17;

function readNextInvoice(): number {
  try {
    const n = Number(localStorage.getItem(invoiceKey()));
    return Number.isInteger(n) && n >= INVOICE_SEED ? n : INVOICE_SEED;
  } catch {
    return INVOICE_SEED;
  }
}

function consumeInvoice(): string {
  const current = readNextInvoice();
  try {
    localStorage.setItem(invoiceKey(), String(current + 1));
  } catch {}
  return `local-${current}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customQty, setCustomQty] = useState(1);
  const [discount, setDiscount] = useState<number>(0);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  
  // The store always comes from the logged-in account (server), never from a hardcoded name.
  const [storeInfo, setStoreInfo] = useState({ name: "", details: "", phone: "" });

  // Dynamic Invoice Number state
  const [invoiceNo, setInvoiceNo] = useState("local-17");

  // Receipt Modal State
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [completedOrderData, setCompletedOrderData] = useState<{
    invoice: string;
    items: CartItem[];
    subtotal: number;
    discountAmt: number;
    grandTotal: number;
  } | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!getToken()) {
      window.location.href = "/login";
      return;
    }
    loadProducts();
    apiFetch<{ slug?: string; name: string; details: string; phone: string }>("/stores/current")
      .then((res) => {
        if (res?.name) {
          invoiceScope = res.slug || res.name;
          setStoreInfo({ name: res.name, details: res.details, phone: res.phone });
        }
      })
      .catch((err) => console.error("Failed to load store profile", err))
      .finally(() => setInvoiceNo(`local-${readNextInvoice()}`));

    // Initialize upcoming invoice number from localStorage
    setInvoiceNo(`local-${readNextInvoice()}`);

    return () => {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {});
          }
        } catch {}
      }
    };
  }, []);

  async function loadProducts() {
    try {
      const res = await apiFetch<{ data: Product[] }>("/products");
      if (res && res.data) {
        setProducts(res.data);
      }
    } catch (err) {
      console.error("Failed to load products for checkout", err);
    }
  }

  function processBarcode(code: string) {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    setNotice("");
    const foundProduct = products.find(
      (p) => p.sku?.toLowerCase() === cleanCode.toLowerCase() || p.id === cleanCode
    );

    if (foundProduct) {
      addToCart({
        id: foundProduct.id,
        name: foundProduct.name,
        sku: foundProduct.sku || cleanCode,
        price: Number(foundProduct.price) || 0,
        qty: 1,
      });
      setBarcodeInput("");
      setNotice(`✔ Added: ${foundProduct.name} (Rs ${foundProduct.price})`);
    } else {
      setBarcodeInput(cleanCode);
      setNotice(`Barcode (${cleanCode}) not found in inventory — enter Name & Price below.`);
    }
  }

  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    processBarcode(barcodeInput);
  }

  function addToCart(newItem: CartItem) {
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.sku === newItem.sku);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].qty += newItem.qty;
        return updated;
      }
      return [newItem, ...prev];
    });
  }

  async function handleManualAdd() {
    if (!customName.trim() || !customPrice) return;
    const priceNum = parseFloat(customPrice);
    if (isNaN(priceNum) || priceNum <= 0) return;

    const sku = barcodeInput.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
    const qty = customQty > 0 ? customQty : 1;

    try {
      // Reuse the product if this barcode already exists, otherwise save it to this store's inventory.
      let product = products.find((p) => p.sku?.toLowerCase() === sku.toLowerCase());
      if (!product) {
        product = await apiFetch<Product>("/products", {
          method: "POST",
          body: JSON.stringify({
            name: customName.trim(),
            sku,
            price: String(priceNum),
            stockQty: 9999,
          }),
        });
        setProducts((prev) => [...prev, product as Product]);
      }

      addToCart({
        id: product.id,
        name: product.name,
        sku: product.sku || sku,
        price: priceNum,
        qty,
      });

      setCustomName("");
      setCustomPrice("");
      setCustomQty(1);
      setBarcodeInput("");
      setNotice(`✔ Saved to inventory and added: ${product.name}`);
      await loadProducts();
    } catch (err) {
      setNotice(`❌ Item was NOT saved: ${err instanceof Error ? err.message : "error"}`);
    }
  }

  function updateQty(sku: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.sku === sku) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  }

  function removeFromCart(sku: string) {
    setCart((prev) => prev.filter((item) => item.sku !== sku));
  }

  async function toggleCameraScanner() {
    if (scannerActive) {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
        } catch {}
      }
      setScannerActive(false);
    } else {
      setScannerActive(true);
      setTimeout(async () => {
        try {
          const scanner = new Html5Qrcode("reader");
          scannerRef.current = scanner;
          await scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 150 } },
            (decodedText) => {
              processBarcode(decodedText);
              scanner.stop().catch(() => {});
              setScannerActive(false);
            },
            () => {}
          );
        } catch (err) {
          console.error("Camera start error:", err);
          setNotice("Could not start camera. Make sure permissions are allowed in Safari.");
          setScannerActive(false);
        }
      }, 200);
    }
  }

  // Derived Grand Total calculation
  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0);
  const discountVal = Number(discount) || 0;
  const discountAmount = (subtotal * discountVal) / 100;
  const grandTotal = Math.max(0, subtotal - discountAmount);

  async function handleCheckoutComplete() {
    if (cart.length === 0) {
      alert("Cart is empty!");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/orders", {
        method: "POST",
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.qty,
            unitPrice: String(item.price),
          })),
          discount: discountAmount,
        }),
      });

      const issuedInvoice = consumeInvoice();

      setCompletedOrderData({
        invoice: issuedInvoice,
        items: [...cart],
        subtotal,
        discountAmt: discountAmount,
        grandTotal,
      });
      setShowReceiptModal(true);

      setCart([]);
      setDiscount(0);
      setInvoiceNo(`local-${readNextInvoice()}`);
      await loadProducts();
    } catch (err) {
      // The sale was NOT saved: keep the cart and say why.
      alert(`Sale was not saved: ${err instanceof Error ? err.message : "Checkout failed"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell
      title="Checkout"
      nav={
        <nav className="flex gap-4 text-sm">
          <a href="/dashboard" className="text-slate-600 hover:text-slate-900">
            Dashboard
          </a>
          <a href="/inventory" className="text-slate-600 hover:text-slate-900">
            Inventory
          </a>
          <a href="/checkout" className="font-medium text-slate-900">
            Checkout
          </a>
        </nav>
      }
    >
      <div className="mb-4 border-b border-slate-200 pb-3 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Checkout Terminal</h1>
          <p className="text-sm text-slate-600">
            {storeInfo.name || "Checkout"} — Invoice: <span className="font-mono font-bold text-blue-600">{invoiceNo}</span>
          </p>
        </div>
        <Button
          onClick={() => router.push("/inventory")}
          variant="outline"
          className="border-slate-300 text-slate-700"
        >
          ← Back to Inventory
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Scan or Enter Barcode</CardTitle>
              <Button
                type="button"
                onClick={toggleCameraScanner}
                variant="outline"
                className="text-xs bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
              >
                {scannerActive ? "Close Camera" : "📷 Open iPhone Camera Scanner"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {scannerActive && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div id="reader" className="w-full"></div>
                </div>
              )}

              <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
                <Input
                  placeholder="Scan Barcode / QR or type SKU..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="h-11 text-base font-mono"
                  autoFocus
                />
                <Button type="submit" className="h-11 bg-slate-900 hover:bg-slate-800 text-white px-6">
                  Add Code
                </Button>
              </form>

              {notice && (
                <div className={`p-3 text-sm rounded-lg font-medium ${notice.startsWith("✔") ? "bg-green-50 border border-green-200 text-green-800" : "bg-amber-50 border border-amber-200 text-amber-800"}`}>
                  {notice}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  placeholder="Item Name..."
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="h-10"
                />
                <Input
                  type="number"
                  placeholder="Price (Rs)..."
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="h-10"
                />
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={customQty}
                    onChange={(e) => setCustomQty(parseInt(e.target.value) || 1)}
                    className="h-10 w-20"
                  />
                  <Button
                    type="button"
                    onClick={handleManualAdd}
                    className="h-10 flex-1 bg-green-600 hover:bg-green-700 text-white font-medium"
                  >
                    + Add Item
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Current Bill Items</CardTitle>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  No items in cart yet. Scan a barcode or use the camera scanner above.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-700 text-xs uppercase border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2">Code</th>
                        <th className="px-3 py-2">Item Name</th>
                        <th className="px-3 py-2 text-right">Price</th>
                        <th className="px-3 py-2 text-center">Qty</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {cart.map((item) => (
                        <tr key={item.sku} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono text-xs text-slate-500">{item.sku}</td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-slate-900">{item.name}</div>
                            <div className="text-xs text-slate-500 font-mono">
                              {item.name} — Rs {item.price} × {item.qty} = Rs {item.price * item.qty}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">Rs {item.price}</td>
                          <td className="px-3 py-2 text-center">
                            <div className="inline-flex items-center border border-slate-200 rounded">
                              <button
                                onClick={() => updateQty(item.sku, -1)}
                                className="px-2 py-0.5 text-slate-600 hover:bg-slate-100"
                              >
                                -
                              </button>
                              <span className="px-3 font-medium">{item.qty}</span>
                              <button
                                onClick={() => updateQty(item.sku, 1)}
                                className="px-2 py-0.5 text-slate-600 hover:bg-slate-100"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-bold">Rs {item.price * item.qty}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => removeFromCart(item.sku)}
                              className="text-red-600 hover:text-red-800 text-xs font-semibold"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-slate-200 shadow-sm bg-slate-50">
            <CardHeader>
              <CardTitle className="text-lg">Bill Summary ({invoiceNo})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">Rs {subtotal.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Discount (%)</span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-24 h-9 bg-white text-right"
                />
              </div>

              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-700">
                  <span>Discount Amount</span>
                  <span>- Rs {discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="border-t border-slate-200 pt-3 flex justify-between items-center text-lg font-bold text-slate-900">
                <span>Grand Total</span>
                <span className="text-blue-600">Rs {grandTotal.toFixed(2)}</span>
              </div>

              <Button
                onClick={handleCheckoutComplete}
                disabled={loading || cart.length === 0}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base mt-2"
              >
                {loading ? "Processing..." : "Complete Checkout & Print"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {showReceiptModal && completedOrderData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 font-mono text-sm">
            <div className="text-center space-y-1 border-b pb-3">
              <h2 className="font-bold text-lg text-slate-900">{storeInfo.name}</h2>
              {storeInfo.details && <p className="text-xs text-slate-600">{storeInfo.details}</p>}
              {storeInfo.phone && <p className="text-xs text-slate-600">Ph: {storeInfo.phone}</p>}
            </div>

            <div className="flex justify-between text-xs text-slate-500 border-b pb-2">
              <span>INVOICE NO: #{completedOrderData.invoice}</span>
              <span>DATE: {new Date().toLocaleDateString()}</span>
            </div>

            <div className="grid grid-cols-12 text-xs font-bold text-slate-700 border-b pb-1">
              <span className="col-span-6">PRODUCT DESCRIPTION</span>
              <span className="col-span-2 text-right">PRICE</span>
              <span className="col-span-2 text-center">QTY</span>
              <span className="col-span-2 text-right">TOTAL</span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto py-1">
              {completedOrderData.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 text-xs items-center py-1 border-b border-slate-100">
                  <span className="col-span-6 font-semibold">{item.name}</span>
                  <span className="col-span-2 text-right">{item.price}</span>
                  <span className="col-span-2 text-center">{item.qty}</span>
                  <span className="col-span-2 text-right font-bold">{(item.price * item.qty).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span>SUBTOTAL:</span>
                <span>Rs {completedOrderData.subtotal.toFixed(2)}</span>
              </div>
              {completedOrderData.discountAmt > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>DISCOUNT:</span>
                  <span>- Rs {completedOrderData.discountAmt.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-slate-900 border-t pt-2">
                <span>TOTAL PRICE:</span>
                <span className="text-blue-600">Rs {completedOrderData.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="text-center text-xs text-slate-500 border-t pt-3">
              Thank you for shopping with us!
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => window.print()}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white"
              >
                🖨 Print Receipt
              </Button>
              <Button
                onClick={() => setShowReceiptModal(false)}
                variant="outline"
                className="flex-1 border-slate-300 text-slate-700"
              >
                Close / New Sale
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
