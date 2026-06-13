"use client";

import { formatCurrency, formatDate } from "@/lib/utils";
import { getPaymentMethodLabel, getTotalPaid } from "@/lib/payments";
import { PaymentMethod, RoomChargeType } from "@prisma/client";
import { getReceiptLayoutClasses, type ReceiptLayoutSettings } from "@/lib/receipt-types";

interface RoomInvoiceProps {
  orderNumber: string;
  completedAt: Date | string;
  cashierName: string;
  guest: { fullName: string; phone: string; email?: string | null };
  room: { number: string; type: string };
  checkIn: Date | string;
  checkOut: Date | string;
  nightsStayed: number;
  roomRate: number;
  accommodationSubtotal: number;
  charges: Array<{
    type: RoomChargeType;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  payments: Array<{ method: string; amount: number; reference?: string | null; createdAt?: Date | string }>;
  grandTotal: number;
  settings: ReceiptLayoutSettings & {
    businessName: string;
    businessAddress: string;
    phone: string;
    email: string;
    currency: string;
  };
}

const TYPE_LABELS: Record<string, string> = {
  FOOD: "Food",
  DRINKS: "Drinks",
  ALCOHOL: "Alcohol",
  LAUNDRY: "Laundry",
  ROOM_SERVICE: "Room Service",
  EXTRA_SERVICE: "Extra Service",
  DAMAGE: "Damage / Extra",
  OTHER: "Other",
  ACCOMMODATION: "Accommodation",
};

export function RoomInvoice(props: RoomInvoiceProps) {
  const productCharges = props.charges.filter(
    (c) => ["FOOD", "DRINKS", "ALCOHOL", "ROOM_SERVICE"].includes(c.type)
  );
  const manualCharges = props.charges.filter(
    (c) => !["FOOD", "DRINKS", "ALCOHOL", "ROOM_SERVICE", "ACCOMMODATION"].includes(c.type)
  );
  const totalPaid = getTotalPaid(
    props.payments.map((p) => ({ method: p.method as PaymentMethod, amount: p.amount }))
  );
  const balance = Math.max(0, props.grandTotal - totalPaid);

  return (
    <div id="room-invoice" className={getReceiptLayoutClasses(props.settings)}>
      <div className="receipt-header">
        <p className="font-bold uppercase">RAGEN RESORT POS</p>
        <p>{props.settings.businessName}</p>
        <p>Room Checkout Invoice</p>
        {props.settings.businessAddress && <p>{props.settings.businessAddress}</p>}
        {props.settings.phone && <p>Tel: {props.settings.phone}</p>}
      </div>

      <div className="receipt-sep">
        <p>Invoice: {props.orderNumber}</p>
        <p>Date: {formatDate(props.completedAt)}</p>
        <p>Cashier: {props.cashierName}</p>
      </div>

      <div className="receipt-sep">
        <p className="font-bold">Guest</p>
        <p>{props.guest.fullName}</p>
        <p>{props.guest.phone}</p>
        {props.guest.email && <p>{props.guest.email}</p>}
      </div>

      <div className="receipt-sep">
        <p className="font-bold">Room</p>
        <p>Room {props.room.number} — {props.room.type}</p>
        <p>Check-in: {formatDate(props.checkIn)}</p>
        <p>Check-out: {formatDate(props.checkOut)}</p>
        <p>Nights: {props.nightsStayed} × {formatCurrency(props.roomRate, props.settings.currency)}/night</p>
      </div>

      <Section
        title="Accommodation"
        items={[
          {
            desc: `Room ${props.room.number} (${props.nightsStayed} night${props.nightsStayed !== 1 ? "s" : ""})`,
            qty: props.nightsStayed,
            total: props.accommodationSubtotal,
          },
        ]}
        currency={props.settings.currency}
      />

      {productCharges.length > 0 && (
        <Section
          title="Food / Drinks / Products"
          items={productCharges.map((c) => ({
            desc: c.description,
            qty: c.quantity,
            total: c.total,
          }))}
          currency={props.settings.currency}
        />
      )}

      {manualCharges.length > 0 && (
        <Section
          title="Other Charges"
          items={manualCharges.map((c) => ({
            desc: `${c.description} (${TYPE_LABELS[c.type] ?? c.type})`,
            qty: c.quantity,
            total: c.total,
          }))}
          currency={props.settings.currency}
        />
      )}

      <div className="receipt-sep">
        <div className="receipt-between font-bold">
          <span className="receipt-label">Grand Total</span>
          <span className="receipt-value">{formatCurrency(props.grandTotal, props.settings.currency)}</span>
        </div>
      </div>

      {props.payments.length > 0 && (
        <div className="receipt-sep">
          <p className="font-bold">Payments</p>
          {props.payments.map((p, i) => (
            <div key={i}>
              <div className="receipt-between">
                <span className="receipt-label">{getPaymentMethodLabel(p.method)}</span>
                <span className="receipt-value">{formatCurrency(p.amount, props.settings.currency)}</span>
              </div>
              {p.reference && (
                <p>
                  {p.method === "MPESA" ? "M-Pesa" : getPaymentMethodLabel(p.method)} Ref: {p.reference}
                </p>
              )}
            </div>
          ))}
          <div className="receipt-between font-bold">
            <span className="receipt-label">Total Paid</span>
            <span className="receipt-value">{formatCurrency(totalPaid, props.settings.currency)}</span>
          </div>
          {balance > 0.009 && (
            <div className="receipt-between font-bold">
              <span className="receipt-label">Balance Due</span>
              <span className="receipt-value">{formatCurrency(balance, props.settings.currency)}</span>
            </div>
          )}
        </div>
      )}

      <p className="receipt-sep text-center">
        Thank you for staying at {props.settings.businessName}
      </p>
    </div>
  );
}

function Section({
  title,
  items,
  currency,
}: {
  title: string;
  items: { desc: string; qty: number; total: number }[];
  currency: string;
}) {
  return (
    <div className="receipt-sep">
      <p className="font-bold">{title}</p>
      <table className="receipt-table">
        <thead>
          <tr>
            <th className="text-left">Description</th>
            <th className="text-center" style={{ width: "18%" }}>Qty</th>
            <th className="text-right" style={{ width: "28%" }}>Amt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td>{item.desc}</td>
              <td className="text-center">{item.qty}</td>
              <td className="text-right">{formatCurrency(item.total, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
