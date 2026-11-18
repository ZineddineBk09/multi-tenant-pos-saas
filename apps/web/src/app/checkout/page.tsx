"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "@pos/api-client";
import type { Order, Product } from "@pos/types";
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

interface CartItem {
  product: Product;
  quantity: number;
}

interface StoreProfile {
  name: string;
  details: string;
  phone: string;
}

const INVOICE_KEY = "pos:nextInvoiceNo";
const INVOICE_SEED = 17;

function readNextInvoice(): number {
  try {
    const n = Number(localStorage.getItem(INVOICE_KEY));
    return Number.isInteger(n) && n >= INVOICE_SEED ? n : INVOICE_SEED;
  } catch {
    return INVOICE_SEED;
  }
}

function consumeInvoice(): string {
  const current = readNextInvoice();
  try {
    localStorage.setItem(INVOICE_KEY, String(current + 1));
  } catch {}
  return `local-${current}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [itemNameInput, setItemNameInput] = useState("");
  const [qtyInput, setQtyInput] = useState("1");
  const [priceInput, setPriceInput] = useState("");
  const [discountAmount, setDiscountAmount] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("local-17");
  const [attendantName, setAttendantName] = useState("Nasir Farooq");

  const [cameraOpen, setCameraOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // ڈائنامیکلی اسٹور کا ڈیٹا لوڈ کرنے کے لیے فالکن سیٹ اپ
  const [storeInfo, setStoreInfo] = useState<StoreProfile>({
    name: "Loading Store...",
    details: "",
    phone: "",
  });

  useEffect(() => {
    if (!getToken()) {
      window.location.href = "/login";
      return;
    }
    loadProducts();
    loadStoreProfile(); // ڈائنامیک اسٹور پروفাইল فیچ کرنے کے لیے
    setInvoiceNo(`local-${readNextInvoice()}`);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  async function loadStoreProfile() {
    try {
      const res = await apiFetch<StoreProfile>("/stores/current");
      if (res && res.name) {
        setStoreInfo(res);
      }
    } catch (err) {
      console.error("Failed to load store profile, keeping fallback", err);
      // اگر API سے ڈیٹا نہ ملے تو پرانا فالکن نام شو ہو تاکہ ایپ نہ پھنسے
      setStoreInfo({
        name: "Amin Cosmetics & Toiletries",
        details: "Shop #22, 2nd Floor, Al Hilal Market, Bara Bazar, Rawalpindi",
        phone: "0333-3187875",
      });
    }
  }

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

  function startVoiceSearch() {
    // @ts-expect-error window.webkitSpeechRecognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Voice search is not supported on this browser. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError("🎤 Listening... Speak item name");
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const spokenText = event.results[0][0].transcript;
      setItemNameInput(spokenText);
      setIsListening(false);
      setError(`🎤 Spoken: ${spokenText}`);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setError("Voice recognition error. Please try again.");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }

  async function startCameraScanner() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCameraOpen(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        detectBarcodeLoop();
      }, 200);
    } catch {
      setError("Camera access denied or not supported on this browser.");
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  }

  async function detectBarcodeLoop() {
    if (!("BarcodeDetector" in window)) {
      setError("Live camera BarcodeDetector not supported in this browser.");
      return;
    }

    // @ts-expect-error BarcodeDetector experimental support
    const detector = new window.BarcodeDetector({
      formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e"],
    });

    const scanFrame = async () => {
      if (!videoRef.current || !streamRef.current) return;
      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          const scannedCode = barcodes[0].rawValue;
          stopCamera();
          handleBarcodeScanned(scannedCode);
          return;
        }
      } catch {
        // Ignore single frame error
      }
      if (streamRef.current) {
        requestAnimationFrame(scanFrame);
      }
    };

    requestAnimationFrame(scanFrame);
  }

  function handleBarcodeScanned(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBarcodeInput(trimmed);

    const found = products.find(
      (p) => (p.sku && p.sku.toLowerCase() === trimmed.toLowerCase()) || p.id === trimmed
    );

    if (found) {
      setItemNameInput(found.name);
      setPriceInput(found.price || "");
      setError(`⚡ Auto-matched: ${found.name}`);
    } else {
      setItemNameInput(`Item-${trimmed}`);
      setPriceInput("");
      setError(`⚡ New Barcode. Name auto-filled, adjust price if needed.`);
    }
  }

  async function handleAddAndSave(e: React.FormEvent) {
    e.preventDefault();
    const sku = barcodeInput.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
    const name = itemNameInput.trim() || `Item-${sku}`;
    const qty = parseInt(qtyInput, 10) || 1;
    const price = priceInput.trim() || "0";

    setError("");

    let targetProduct: Product | undefined;

    try {
      const response = await apiFetch<Product | { data: Product }>("/products", {
        method: "POST",
        body: JSON.stringify({
          name,
          sku,
          price,
          stockQty: 9999,
        }),
      });

      const savedProduct =
        response && typeof response === "object" && "data" in response
          ? (response as { data: Product }).data
          : (response as Product);

      if (savedProduct) {
        targetProduct = savedProduct;
        setProducts((prev) => {
          const exists = prev.findIndex((p) => p.id === savedProduct.id);
          if (exists >= 0) {
            return prev.map((p) => (p.id === savedProduct.id ? savedProduct : p));
          }
          return [...prev, savedProduct];
        });
      }
    } catch {
      targetProduct = {
        id: `custom-${Date.now()}`,
        name,
        sku,
        price,
        stockQty: 9999,
      } as unknown as Product;
    }

    if (targetProduct) {
      addToCart(targetProduct, qty);
      setError(`✔ آئٹم کامیابی کے ساتھ انوینٹری میں سیو اور کارٹ میں ایڈ ہو گئی ہے!`);
      
      setBarcodeInput("");
      setItemNameInput("");
      setQtyInput("1");
      setPriceInput("");
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    }
  }

  function addToCart(product: Product, qtyToAdd: number = 1) {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + qtyToAdd }
            : item
        );
      }
      return [...prev, { product, quantity: qtyToAdd }];
    });
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function setExactQty(productId: string, newQty: number) {
    if (newQty <= 0) {
      setCart((prev) => prev.filter((item) => item.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity: newQty } : item
      )
    );
  }

  function updateItemPrice(productId: string, newPrice: string) {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, product: { ...item.product, price: newPrice } }
          : item
      )
    );
  }

  const subtotal = cart.reduce(
    (sum, item) => sum + (parseFloat(item.product.price) || 0) * item.quantity,
    0
  );
  const discountVal = parseFloat(discountAmount) || 0;
  const total = Math.max(0, Math.round((subtotal - discountVal) * 100) / 100);

  async function completeSale() {
    if (cart.length === 0) return;
    setProcessing(true);
    setError("");

    try {
      const issuedInvoice = consumeInvoice();
      const fallbackOrder: Order = {
        id: issuedInvoice,
        subtotal: subtotal.toFixed(2),
        total: total.toFixed(2),
        items: cart.map((item, idx) => ({
          id: `item-${idx}`,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.price,
        })),
      } as unknown as Order;

      setReceipt(fallbackOrder);
      setCart([]);
      setDiscountAmount("");
      setInvoiceNo(`local-${readNextInvoice()}`);
    } catch {
      setError("Checkout failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  function sendWhatsAppReceipt(targetPhone?: string) {
    if (!receipt) return;
    
    let itemsText = "";
    receipt.items?.forEach((item, index) => {
      itemsText += `${index + 1}. ${item.productName} (${item.unitPrice} x ${item.quantity}) - Rs ${(parseFloat(item.unitPrice) * item.quantity).toFixed(2)}\n`;
    });

    const message = 
      `*${storeInfo.name}*\n` +
      `${storeInfo.details}\n` +
      `Ph: ${storeInfo.phone}\n` +
      `--------------------------------\n` +
      `*Order Receipt #${receipt.id}* (Attendant: ${attendantName})\n\n` +
      `${itemsText}\n` +
      `--------------------------------\n` +
      `Subtotal: Rs ${receipt.subtotal}\n` +
      (discountVal > 0 ? `Discount: -Rs ${discountVal}\n` : "") +
      `*Grand Total: Rs ${total}*\n` +
      `--------------------------------\n` +
      `Thank you for shopping with us! (Admin: ${storeInfo.phone})`;

    const encodedMessage = encodeURIComponent(message);
    let url = `https://wa.me/?text=${encodedMessage}`;
    
    if (targetPhone && targetPhone.trim().length > 5) {
      const cleanPhone = targetPhone.replace(/[^0-9]/g, "");
      url = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    }

    window.open(url, "_blank");
  }

  if (receipt) {
    return (
      <AppShell title="Checkout">
        <div className="mx-auto max-w-md space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Receipt</CardTitle>
              <Badge variant="success">Order Complete</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-b border-slate-200 pb-3 text-center">
                <h2 className="font-bold text-lg">{storeInfo.name}</h2>
                <p className="text-xs text-slate-600">{storeInfo.details}</p>
                <p className="text-xs text-slate-600">Ph: {storeInfo.phone}</p>
              </div>
              <div className="flex justify-between text-sm text-slate-500">
                <span>Order #{receipt.id}</span>
                <span>Attendant: {attendantName}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {receipt.items?.map((item) => (
                  <div key={item.id} className="flex justify-between py-2 text-sm font-mono">
                    <span>
                      {item.productName} {item.unitPrice} x {item.quantity}
                    </span>
                    <span className="font-bold">Rs {(parseFloat(item.unitPrice) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1 border-t border-slate-200 pt-4 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>Rs {receipt.subtotal}</span>
                </div>
                {discountVal > 0 && (
                  <div className="flex justify-between text-green-600 font-medium">
                    <span>Discount</span>
                    <span>-Rs {discountVal}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>Grand Total</span>
                  <span className="text-blue-600">Rs {total}</span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Input
                  placeholder="Customer WhatsApp Number (e.g. 923001234567)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold"
                  onClick={() => sendWhatsAppReceipt(customerPhone)}
                >
                  💬 Send Receipt to Customer WhatsApp
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-green-600 text-green-700 hover:bg-green-50 font-bold"
                  onClick={() => sendWhatsAppReceipt(storeInfo.phone)}
                >
                  📱 Send Copy to Store Owner ({storeInfo.phone})
                </Button>
              </div>

              <Button className="w-full mt-2" onClick={() => setReceipt(null)}>
                New Sale
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
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
          <h1 className="text-2xl font-bold text-slate-900">{storeInfo.name}</h1>
          <p className="text-sm text-slate-700 font-medium">{storeInfo.details} | Ph: {storeInfo.phone}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span>Attendant:</span>
          <input
            type="text"
            value={attendantName}
            onChange={(e) => setAttendantName(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded text-sm w-32 font-semibold"
          />
        </div>
      </div>

      <PageHeader title={`Checkout Terminal (${invoiceNo})`} description="Scan Barcode (Auto-Fills Name & Saves to Inventory) 📦" />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              ref={barcodeInputRef}
              placeholder="Scan Barcode / QR Code..."
              value={barcodeInput}
              onChange={(e) => handleBarcodeScanned(e.target.value)}
              className="h-12 text-base flex-1 min-w-[200px]"
              autoFocus
            />
            <Button 
              type="button" 
              onClick={() => handleBarcodeScanned(barcodeInput)}
              className="h-12 px-6 bg-slate-900 hover:bg-slate-800 text-white font-medium"
            >
              Scan / Find
            </Button>
            {!cameraOpen ? (
              <Button
                type="button"
                variant="outline"
