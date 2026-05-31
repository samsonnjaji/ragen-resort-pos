"use client";

import { formatCurrency, formatDate } from "@/lib/utils";

interface ReceiptProps {
  order: {
    orderNumber: string;
    items: { product: { name: string }; quantity: number; unitPrice: number; total: number }[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    payments: { method: string; amount: number }[];
    user: { name: string };
    createdAt: Date | string;
  };
  settings: {
    businessName: string;
    businessAddress: string;
    phone: string;
    email: string;
    receiptFooter: string;
    currency: string;
  };
}

export function Receipt({ order, settings }: ReceiptProps) {
  return (
    <div id="receipt" className="bg-white text-black p-6 max-w-sm mx-auto font-mono text-sm">
      <div className="text-center mb-4">
        <h2 className="text-lg font-bold">{settings.businessName}</h2>
        {settings.businessAddress && <p className="text-xs">{settings.businessAddress}</p>}
        {settings.phone && <p className="text-xs">Tel: {settings.phone}</p>}
        {settings.email && <p className="text-xs">{settings.email}</p>}
      </div>

      <div className="border-t border-b border-dashed border-gray-400 py-2 mb-3 text-xs">
        <p>Receipt: {order.orderNumber}</p>
        <p>Date: {formatDate(order.createdAt)}</p>
        <p>Cashier: {order.user.name}</p>
      </div>

      <table className="w-full mb-3 text-xs">
        <thead>
          <tr className="border-b">
            <th className="text-left py-1">Item</th>
            <th className="text-center py-1">Qty</th>
            <th className="text-right py-1">Price</th>
            <th className="text-right py-1">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, i) => (
            <tr key={i}>
              <td className="py-1">{item.product.name}</td>
              <td className="text-center py-1">{item.quantity}</td>
              <td className="text-right py-1">{formatCurrency(item.unitPrice, settings.currency)}</td>
              <td className="text-right py-1">{formatCurrency(item.total, settings.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-dashed border-gray-400 pt-2 space-y-1 text-xs">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatCurrency(order.subtotal, settings.currency)}</span>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>-{formatCurrency(order.discount, settings.currency)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Tax</span>
          <span>{formatCurrency(order.tax, settings.currency)}</span>
        </div>
        <div className="flex justify-between font-bold text-base pt-1">
          <span>TOTAL</span>
          <span>{formatCurrency(order.total, settings.currency)}</span>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-dashed border-gray-400 text-xs">
        <p className="font-semibold mb-1">Payment:</p>
        {order.payments.map((p, i) => (
          <div key={i} className="flex justify-between">
            <span>{p.method}</span>
            <span>{formatCurrency(p.amount, settings.currency)}</span>
          </div>
        ))}
      </div>

      <p className="text-center mt-4 text-xs italic">{settings.receiptFooter}</p>
    </div>
  );
}

export function printReceipt() {
  const receiptEl = document.getElementById("receipt");
  if (!receiptEl) return;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>Receipt</title>
        <style>
          body { font-family: monospace; margin: 0; padding: 20px; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>${receiptEl.innerHTML}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}
