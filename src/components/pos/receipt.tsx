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
    <div id="receipt" className="receipt-thermal mx-auto p-3 md:p-4">
      <div className="text-center mb-3">
        <h2 className="text-sm font-bold uppercase">{settings.businessName}</h2>
        {settings.businessAddress && <p className="text-[10px] mt-1">{settings.businessAddress}</p>}
        {settings.phone && <p className="text-[10px]">Tel: {settings.phone}</p>}
      </div>

      <div className="border-t border-b border-dashed border-gray-500 py-2 mb-2 text-[10px]">
        <p>Receipt: {order.orderNumber}</p>
        <p>Date: {formatDate(order.createdAt)}</p>
        <p>Cashier: {order.user.name}</p>
      </div>

      <table className="w-full mb-2 text-[10px]">
        <thead>
          <tr className="border-b border-gray-400">
            <th className="text-left py-1">Item</th>
            <th className="text-center py-1 w-8">Qty</th>
            <th className="text-right py-1">Amt</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, i) => (
            <tr key={i}>
              <td className="py-1 pr-1">{item.product.name}</td>
              <td className="text-center py-1">{item.quantity}</td>
              <td className="text-right py-1">{formatCurrency(item.total, settings.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-dashed border-gray-500 pt-2 space-y-0.5 text-[10px]">
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
        <div className="flex justify-between font-bold text-xs pt-1 border-t border-gray-400 mt-1">
          <span>TOTAL</span>
          <span>{formatCurrency(order.total, settings.currency)}</span>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-dashed border-gray-500 text-[10px]">
        {order.payments.map((p, i) => (
          <div key={i} className="flex justify-between">
            <span>{p.method}</span>
            <span>{formatCurrency(p.amount, settings.currency)}</span>
          </div>
        ))}
      </div>

      <p className="text-center mt-3 text-[10px] italic">{settings.receiptFooter}</p>
    </div>
  );
}

export function printReceipt() {
  window.print();
}
