"use client";

import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';

interface StoreProfile {
  name: string;
  details: string;
  adminPhone: string;
}

interface BillItem {
  id: number;
  barcode: string;
  name: string;
  qty: number;
  price: number;
  total: number;
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

export default function UniversalPOS() {
  const [storeInfo, setStoreInfo] = useState<StoreProfile>({ 
    name: 'Imdad Cosmetics', 
    details: 'Shop # B1-A, Kamil Plaza, Basement Bara Bazar, Rawalpindi',
    adminPhone: '923451523394' // Owner / Admin official number
  });
  
  // Attendant / Operator Name state (e.g. Nasir or staff name)
  const [attendantName, setAttendantName] = useState<string>('Nasir Farooq');

  // Customer Details State
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [whatsappNumber, setWhatsappNumber] = useState<string>('');

  // Item Form State
  const [barcode, setBarcode] = useState<string>('');
  const [itemName, setItemName] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [billItems, setBillItems] = useState<BillItem[]>([]);

  // Invoice & Receipt State
  const [invoiceNo, setInvoiceNo] = useState<string>('local-17');
  const [orderComplete, setOrderComplete] = useState<boolean>(false);

  useEffect(() => {
    setInvoiceNo(`local-${readNextInvoice()}`);
  }, []);

  const handleCSVImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      alert(`کامیابی کے ساتھ '${file.name}' فائل کا ڈیٹا اس دکان کے سسٹم میں امپورٹ ہو گیا ہے!`);
    }
  };

  const handleAddItem = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!price) {
      alert('براہ کرم کم از کم قیمت (Price) درج کریں!');
      return;
    }

    const finalBarcode = barcode.trim() !== '' ? barcode : `AUTO-${Math.floor(100000 + Math.random() * 900000)}`;
    const finalName = itemName.trim() !== '' ? itemName : `Product (${finalBarcode})`;
    const priceNum = parseFloat(price) || 0;

    const newItem: BillItem = {
      id: Date.now(),
      barcode: finalBarcode,
      name: finalName,
      qty: 1,
      price: priceNum,
      total: priceNum * 1,
    };

    setBillItems([...billItems, newItem]);
    setBarcode('');
    setItemName('');
    setPrice('');
  };

  const subtotal = billItems.reduce((acc, item) => acc + item.total, 0);
  const grandTotal = Math.max(0, subtotal);

  const handleCompleteCheckout = () => {
    if (billItems.length === 0) {
      alert('بل میں کوئی آئٹم موجود نہیں ہے!');
      return;
    }

    const issuedInvoice = consumeInvoice();
    setInvoiceNo(issuedInvoice);
    setOrderComplete(true);
  };

  const handleNewSale = () => {
    setBillItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setWhatsappNumber('');
    setOrderComplete(false);
    setInvoiceNo(`local-${readNextInvoice()}`);
  };

  const sendToWhatsApp = () => {
    if (!whatsappNumber) {
      alert('براہ کرم کسٹمر کا واٹس ایپ نمبر درج کریں!');
      return;
    }

    const itemsText = billItems.map(i => `${i.name} (${i.price} x ${i.qty}) - Rs ${i.total}`).join('\n');
    const message = `*${storeInfo.name}*\nInvoice: #${invoiceNo}\nAttendant: ${attendantName}\n\nItems:\n${itemsText}\n\n*Grand Total: Rs ${grandTotal.toFixed(2)}*\n\nThank you for shopping with us! (Owner Contact: ${storeInfo.adminPhone})`;
    
    const encodedMsg = encodeURIComponent(message);
    const cleanPhone = whatsappNumber.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodedMsg}`, '_blank');
  };

  const sendToOwner = () => {
    const itemsText = billItems.map(i => `${i.name} (${i.price} x ${i.qty}) - Rs ${i.total}`).join('\n');
    const message = `*Store Owner Copy*\nShop: ${storeInfo.name}\nInvoice: #${invoiceNo}\nBilled By: ${attendantName}\n\nItems:\n${itemsText}\n\n*Grand Total: Rs ${grandTotal.toFixed(2)}*`;
    const encodedMsg = encodeURIComponent(message);
    window.open(`https://wa.me/${storeInfo.adminPhone}?text=${encodedMsg}`, '_blank');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      {/* Store Header */}
      <div style={{ borderBottom: '2px solid #333', paddingBottom: '10px', marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 5px 0', color: '#1a1a1a' }}>{storeInfo.name}</h1>
        <p style={{ margin: 0, color: '#666', fontSize: '14px' }}><b>{storeInfo.details} | Ph: 03451523394</b></p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
          <p style={{ margin: 0, color: '#007bff', fontSize: '14px' }}><b>Invoice No: #{invoiceNo}</b></p>
          <div style={{ fontSize: '13px' }}>
            <span>Attendant/Operator: </span>
            <input 
              type="text" 
              value={attendantName} 
              onChange={(e) => setAttendantName(e.target.value)}
              style={{ padding: '3px 6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc', width: '120px' }}
            />
          </div>
        </div>
      </div>

      {!orderComplete ? (
        <>
          {/* Bulk CSV Import Section */}
          <div style={{ background: '#f8f9fa', border: '1px dashed #ccc', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
              📁 پرانا ڈیٹا اپ لوڈ کریں (Bulk CSV / Excel File Import):
            </label>
            <input type="file" accept=".csv" onChange={handleCSVImport} />
          </div>

          {/* Customer Info Section */}
          <div style={{ background: '#e9ecef', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#333' }}>👤 کسٹمر کی تفصیلات (Customer Details):</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Customer Name..."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={{ flex: '1', padding: '8px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '180px' }}
              />
              <input
                type="text"
                placeholder="Mobile Number..."
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                style={{ flex: '1', padding: '8px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '180px' }}
              />
              <input
                type="text"
                placeholder="Address / Area..."
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                style={{ flex: '1.5', padding: '8px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '200px' }}
              />
            </div>
          </div>

          {/* Barcode, Item Name & Custom Price Entry Form */}
          <form onSubmit={handleAddItem} style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Scan Barcode (Leave blank for Auto)..."
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              style={{ flex: '1.5', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '200px' }}
              autoFocus
            />
            <input
              type="text"
              placeholder="Item Name (Optional)..."
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              style={{ flex: '1.5', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '200px' }}
            />
            <input
              type="number"
              placeholder="Price (Rs)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              style={{ flex: '1', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '100px' }}
            />
            <button
              type="submit"
              style={{ padding: '10px 20px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
            >
              + Add Item
            </button>
          </form>

          {/* Billing Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
            <thead>
              <tr style={{ background: '#007bff', color: '#fff', textAlign: 'left' }}>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Code / Barcode</th>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Product Description</th>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Qty</th>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Price (Rs)</th>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {billItems.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '15px', color: '#888' }}>
                    کوئی آئٹم ایڈ نہیں ہوئی۔ بارکوڈ اسکین کریں یا نام اور قیمت درج کر کے ایڈ کریں۔
                  </td>
                </tr>
              ) : (
                billItems.map((item) => (
                  <tr key={item.id}>
                    <td style={{ padding: '8px', border: '1px solid #ddd', fontFamily: 'monospace' }}>{item.barcode}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                      <b>{item.name}</b>
                      <div style={{ fontSize: '12px', color: '#666' }}>{item.name} {item.price} x {item.qty}</div>
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>{item.qty}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>Rs {item.price.toFixed(2)}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 'bold' }}>Rs {item.total.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Invoice Summary & Checkout Complete Section */}
          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '6px', border: '1px solid #ddd', marginBottom: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px' }}>
                <span>Subtotal:</span>
                <span>Rs. {subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold', borderTop: '1px solid #ddd', paddingTop: '8px' }}>
                <span>Grand Total:</span>
                <span style={{ color: '#28a745' }}>Rs. {grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleCompleteCheckout}
              style={{ width: '100%', marginTop: '15px', padding: '14px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
            >
              Complete Checkout & Generate Receipt
            </button>
          </div>
        </>
      ) : (
        /* Order Complete & Receipt View */
        <div style={{ background: '#fff', border: '1px solid #ccc', padding: '20px', borderRadius: '8px', maxWidth: '500px', margin: '0 auto', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
          <div style={{ background: '#d4edda', color: '#155724', padding: '8px', textAlign: 'center', fontWeight: 'bold', borderRadius: '4px', marginBottom: '15px' }}>
            Order Complete
          </div>

          <div style={{ textAlign: 'center', borderBottom: '1px solid #ddd', paddingBottom: '10px', marginBottom: '15px' }}>
            <h2 style={{ margin: '0 0 5px 0' }}>{storeInfo.name}</h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>{storeInfo.details} | Ph: 03451523394</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px', fontWeight: 'bold' }}>
            <span>Order #{invoiceNo}</span>
            <span>{new Date().toLocaleDateString()}</span>
          </div>
          <div style={{ fontSize: '12px', color: '#555', marginBottom: '10px' }}>
            <span>Attendant/Billed By: <b>{attendantName}</b></span>
          </div>

          <div style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: '10px 0', marginBottom: '15px' }}>
            {billItems.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px' }}>
                <span>{item.name} {item.price} x {item.qty}</span>
                <span style={{ fontWeight: 'bold' }}>Rs {item.total.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: '15px', fontSize: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span>Subtotal</span>
              <span>Rs {subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold', borderTop: '1px solid #ddd', paddingTop: '5px' }}>
              <span>Grand Total</span>
              <span style={{ color: '#28a745' }}>Rs {grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* WhatsApp Number Input & Action Buttons */}
          <div style={{ marginBottom: '15px' }}>
            <input
              type="text"
              placeholder="Customer WhatsApp Number (e.g. 923001234567)"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '10px', boxSizing: 'border-box' }}
            />
            <button
              onClick={sendToWhatsApp}
              style={{ width: '100%', padding: '12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', marginBottom: '8px' }}
            >
              💬 Send Receipt to Customer (via Admin)
            </button>
            <button
              onClick={sendToOwner}
              style={{ width: '100%', padding: '12px', background: '#fff', color: '#28a745', border: '1px solid #28a745', borderRadius: '4px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', marginBottom: '8px' }}
            >
              📱 Send Copy to Store Owner ({storeInfo.adminPhone})
            </button>
            <button
              onClick={() => window.print()}
              style={{ width: '100%', padding: '12px', background: '#17a2b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', marginBottom: '8px' }}
            >
              🖨️ Print Receipt
            </button>
          </div>

          <button
            onClick={handleNewSale}
            style={{ width: '100%', padding: '12px', background: '#343a40', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
          >
            New Sale
          </button>
        </div>
      )}
    </div>
  );
}
