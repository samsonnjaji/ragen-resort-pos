"use client";

import { formatCurrency, formatDate } from "@/lib/utils";
import { getPaymentMethodLabel, getTotalPaid } from "@/lib/payments";
import { PaymentMethod, RoomChargeType } from "@prisma/client";

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
  settings: {
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
    <div id="room-invoice" className="receipt-thermal mx-auto p-4 max-w-lg bg-white text-black print:p-2">
      <div className="text-center mb-4 border-b-2 border-emerald-700 pb-3">
        <h1 className="text-lg font-serif font-bold text-emerald-800 uppercase tracking-wide">
          {props.settings.businessName}
        </h1>
        <p className="text-xs text-gray-600 mt-1">Room Guest Invoice</p>
        {props.settings.businessAddress && (
          <p className="text-[10px] mt-1">{props.settings.businessAddress}</p>
        )}
        {props.settings.phone && <p className="text-[10px]">Tel: {props.settings.phone}</p>}
      </div>

      <div className="text-[11px] space-y-1 mb-3">
        <p><span className="font-semibold">Invoice:</span> {props.orderNumber}</p>
        <p><span className="font-semibold">Date:</span> {formatDate(props.completedAt)}</p>
        <p><span className="font-semibold">Cashier:</span> {props.cashierName}</p>
      </div>

      <div className="border border-emerald-200 rounded p-2 mb-3 text-[11px] bg-emerald-50/50">
        <p className="font-serif font-semibold text-emerald-800 mb-1">Guest Details</p>
        <p>{props.guest.fullName}</p>
        <p>{props.guest.phone}</p>
        {props.guest.email && <p>{props.guest.email}</p>}
      </div>

      <div className="border border-amber-200 rounded p-2 mb-3 text-[11px] bg-amber-50/50">
        <p className="font-serif font-semibold text-amber-800 mb-1">Room Details</p>
        <p>Room {props.room.number} — {props.room.type}</p>
        <p>Check-in: {formatDate(props.checkIn)}</p>
        <p>Check-out: {formatDate(props.checkOut)}</p>
        <p>Nights: {props.nightsStayed} × {formatCurrency(props.roomRate, props.settings.currency)}/night</p>
      </div>

      <Section title="Accommodation" items={[
        {
          desc: `Room ${props.room.number} (${props.nightsStayed} night${props.nightsStayed !== 1 ? "s" : ""})`,
          qty: props.nightsStayed,
          total: props.accommodationSubtotal,
        },
      ]} currency={props.settings.currency} />

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

      <div className="border-t-2 border-emerald-700 pt-2 mt-3 space-y-1 text-[11px]">
        <div className="flex justify-between font-bold text-base">
          <span>Grand Total</span>
          <span className="text-amber-700">{formatCurrency(props.grandTotal, props.settings.currency)}</span>
        </div>
      </div>

      {props.payments.length > 0 && (
        <div className="mt-3 text-[11px]">
          <p className="font-serif font-semibold text-emerald-800 mb-1">Payments</p>
          {props.payments.map((p, i) => (
            <div key={i} className="flex justify-between">
              <span>
                {getPaymentMethodLabel(p.method)}
                {p.reference ? ` (${p.reference})` : ""}
              </span>
              <span>{formatCurrency(p.amount, props.settings.currency)}</span>
            </div>
          ))}
          <div className="flex justify-between font-semibold mt-1 border-t pt-1">
            <span>Total Paid</span>
            <span>{formatCurrency(totalPaid, props.settings.currency)}</span>
          </div>
          {balance > 0.009 && (
            <div className="flex justify-between text-red-600 font-semibold">
              <span>Balance Due</span>
              <span>{formatCurrency(balance, props.settings.currency)}</span>
            </div>
          )}
        </div>
      )}

      <p className="text-center text-[10px] text-gray-500 mt-4 pt-2 border-t">
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
    <div className="mb-3">
      <p className="font-serif font-semibold text-sm text-emerald-800 mb-1">{title}</p>
      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-gray-300">
            <th className="text-left py-1">Description</th>
            <th className="text-center w-8">Qty</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td className="py-0.5 pr-1">{item.desc}</td>
              <td className="text-center">{item.qty}</td>
              <td className="text-right">{formatCurrency(item.total, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
