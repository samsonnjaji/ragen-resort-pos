"use client";

import { formatCurrency, formatDate } from "@/lib/utils";
import {
  getPaymentMethodLabel,
  getTotalPaid,
  isSplitOrder,
} from "@/lib/payments";
import { PaymentMethod } from "@prisma/client";
import { getReceiptLayoutClasses, type ReceiptLayoutSettings } from "@/lib/receipt-types";

interface ReceiptProps {
  order: {
    orderNumber: string;
    items: { product: { name: string }; quantity: number; unitPrice: number; total: number }[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    changeGiven?: number;
    payments: { method: string; amount: number; reference?: string | null }[];
    user: { name: string };
    createdAt: Date | string;
  };
  settings: ReceiptLayoutSettings & {
    businessName: string;
    businessAddress: string;
    phone: string;
    email: string;
    receiptFooter: string;
    currency: string;
  };
}

export function Receipt({ order, settings }: ReceiptProps) {
  const changeGiven = order.changeGiven ?? 0;
  const payments = order.payments;
  const totalPaid = getTotalPaid(
    payments.map((p) => ({ method: p.method as PaymentMethod, amount: p.amount }))
  );
  const split = isSplitOrder(
    payments.map((p) => ({ method: p.method as PaymentMethod }))
  );
  const single =
    payments.length === 1 && !split && payments[0].method !== "SPLIT";
  const mpesaPayments = payments.filter((p) => p.method === "MPESA");

  return (
    <div id="receipt" className={getReceiptLayoutClasses(settings)}>
      <div className="receipt-header">
        <p className="receipt-business-name uppercase">RAGEN RESORT POS</p>
        <p className="receipt-title">{settings.businessName}</p>
        {settings.businessAddress && <p className="receipt-body">{settings.businessAddress}</p>}
        {settings.phone && <p className="receipt-body">Tel: {settings.phone}</p>}
      </div>

      <div className="receipt-sep receipt-body">
        <p>Receipt: {order.orderNumber}</p>
        <p>Date: {formatDate(order.createdAt)}</p>
        <p>Cashier: {order.user.name}</p>
      </div>

      <table className="receipt-table receipt-body">
        <thead>
          <tr>
            <th className="text-left">Item</th>
            <th className="text-center" style={{ width: "18%" }}>Qty</th>
            <th className="text-right" style={{ width: "28%" }}>Amt</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, i) => (
            <tr key={i}>
              <td>{item.product.name}</td>
              <td className="text-center">{item.quantity}</td>
              <td className="text-right">{formatCurrency(item.total, settings.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="receipt-sep receipt-body">
        <div className="receipt-between">
          <span className="receipt-label">Subtotal</span>
          <span className="receipt-value">{formatCurrency(order.subtotal, settings.currency)}</span>
        </div>
        {order.discount > 0 && (
          <div className="receipt-between">
            <span className="receipt-label">Discount</span>
            <span className="receipt-value">-{formatCurrency(order.discount, settings.currency)}</span>
          </div>
        )}
        <div className="receipt-between">
          <span className="receipt-label">Tax</span>
          <span className="receipt-value">{formatCurrency(order.tax, settings.currency)}</span>
        </div>
        <div className="receipt-between receipt-total">
          <span className="receipt-label">TOTAL</span>
          <span className="receipt-value">{formatCurrency(order.total, settings.currency)}</span>
        </div>
      </div>

      <div className="receipt-sep receipt-body">
        <p className="receipt-title">Payment</p>
        {single ? (
          <>
            <div className="receipt-between">
              <span className="receipt-label">Method</span>
              <span className="receipt-value">{getPaymentMethodLabel(payments[0].method)}</span>
            </div>
            <div className="receipt-between">
              <span className="receipt-label">Amount Paid</span>
              <span className="receipt-value">{formatCurrency(payments[0].amount, settings.currency)}</span>
            </div>
            {payments[0].reference && (
              <p>{getPaymentMethodLabel(payments[0].method)} Ref: {payments[0].reference}</p>
            )}
          </>
        ) : (
          <>
            {payments.map((p, i) => (
              <div key={i}>
                <div className="receipt-between">
                  <span className="receipt-label">{getPaymentMethodLabel(p.method)}</span>
                  <span className="receipt-value">{formatCurrency(p.amount, settings.currency)}</span>
                </div>
                {p.reference && (
                  <p>{getPaymentMethodLabel(p.method)} Ref: {p.reference}</p>
                )}
              </div>
            ))}
            <div className="receipt-between receipt-total">
              <span className="receipt-label">Total Paid</span>
              <span className="receipt-value">{formatCurrency(totalPaid, settings.currency)}</span>
            </div>
          </>
        )}
        {mpesaPayments.length > 0 && mpesaPayments.some((p) => p.reference) && (
          <div className="receipt-sep">
            {mpesaPayments
              .filter((p) => p.reference)
              .map((p, i) => (
                <p key={i}>M-Pesa Ref: {p.reference}</p>
              ))}
          </div>
        )}
        <div className="receipt-between">
          <span className="receipt-label">Change</span>
          <span className="receipt-value">{formatCurrency(changeGiven, settings.currency)}</span>
        </div>
      </div>

      {settings.receiptFooter && (
        <p className="receipt-sep receipt-footer text-center">{settings.receiptFooter}</p>
      )}
    </div>
  );
}

export { printThermalReceipt as printReceipt } from "@/lib/print-receipt";
