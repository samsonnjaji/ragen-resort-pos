"use client";

import { formatCurrency, formatDate } from "@/lib/utils";
import { getPaymentMethodLabel, getTotalPaid } from "@/lib/payments";
import { PaymentMethod } from "@prisma/client";
import { getReceiptLayoutClasses, type ReceiptLayoutSettings } from "@/lib/receipt-types";

interface RoomSaleReceiptProps {
  orderNumber: string;
  completedAt: Date | string;
  cashierName: string;
  roomNumber: string;
  roomType: string;
  customerName: string;
  customerPhone?: string;
  nights: number;
  unitPrice: number;
  total: number;
  changeGiven?: number;
  payments: Array<{ method: string; amount: number; reference?: string | null }>;
  settings: ReceiptLayoutSettings & {
    businessName: string;
    businessAddress: string;
    phone: string;
    currency: string;
    receiptFooter?: string;
  };
}

export function RoomSaleReceipt({
  orderNumber,
  completedAt,
  cashierName,
  roomNumber,
  roomType,
  customerName,
  customerPhone,
  nights,
  unitPrice,
  total,
  changeGiven = 0,
  payments,
  settings,
}: RoomSaleReceiptProps) {
  const totalPaid = getTotalPaid(
    payments.map((p) => ({ method: p.method as PaymentMethod, amount: p.amount }))
  );

  return (
    <div id="room-sale-receipt" className={getReceiptLayoutClasses(settings)}>
      <div className="receipt-header">
        <p className="font-bold uppercase">RAGEN RESORT POS</p>
        <p>{settings.businessName}</p>
        <p>Room Sale Receipt</p>
        {settings.businessAddress && <p>{settings.businessAddress}</p>}
      </div>

      <div className="receipt-sep">
        <p>Receipt: {orderNumber}</p>
        <p>Date: {formatDate(completedAt)}</p>
        <p>Cashier: {cashierName}</p>
      </div>

      <div className="receipt-sep">
        <p className="font-bold">Customer: {customerName}</p>
        {customerPhone && <p>Phone: {customerPhone}</p>}
        <p>Room {roomNumber} — {roomType}</p>
      </div>

      <table className="receipt-table">
        <thead>
          <tr>
            <th className="text-left">Item</th>
            <th className="text-center" style={{ width: "18%" }}>Qty</th>
            <th className="text-right" style={{ width: "28%" }}>Amt</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Room {roomNumber} Accommodation</td>
            <td className="text-center">{nights}</td>
            <td className="text-right">{formatCurrency(total, settings.currency)}</td>
          </tr>
        </tbody>
      </table>

      <div className="receipt-sep">
        <div className="receipt-between">
          <span className="receipt-label">Room Rate</span>
          <span className="receipt-value">{formatCurrency(unitPrice, settings.currency)}/night</span>
        </div>
        <div className="receipt-between font-bold">
          <span className="receipt-label">Total</span>
          <span className="receipt-value">{formatCurrency(total, settings.currency)}</span>
        </div>
      </div>

      <div className="receipt-sep">
        <p className="font-bold">Payment</p>
        {payments.map((p, i) => (
          <div key={i}>
            <div className="receipt-between">
              <span className="receipt-label">{getPaymentMethodLabel(p.method)}</span>
              <span className="receipt-value">{formatCurrency(p.amount, settings.currency)}</span>
            </div>
            {p.reference && (
              <p>
                {p.method === "MPESA" ? "M-Pesa" : getPaymentMethodLabel(p.method)} Ref: {p.reference}
              </p>
            )}
          </div>
        ))}
        <div className="receipt-between font-bold">
          <span className="receipt-label">Paid</span>
          <span className="receipt-value">{formatCurrency(totalPaid, settings.currency)}</span>
        </div>
        <div className="receipt-between">
          <span className="receipt-label">Change</span>
          <span className="receipt-value">{formatCurrency(changeGiven, settings.currency)}</span>
        </div>
      </div>

      {settings.receiptFooter && (
        <p className="receipt-sep text-center">{settings.receiptFooter}</p>
      )}
    </div>
  );
}
