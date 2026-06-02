"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import {
  getPaymentMethodBadgeVariant,
  getPaymentMethodLabel,
  getTotalPaid,
  isSplitOrder,
} from "@/lib/payments";
import { PaymentMethod } from "@prisma/client";

interface PaymentBreakdownProps {
  orderTotal: number;
  changeGiven?: number;
  payments: {
    method: PaymentMethod | string;
    amount: number;
    reference?: string | null;
  }[];
  compact?: boolean;
}

export function PaymentBreakdown({
  orderTotal,
  changeGiven = 0,
  payments,
  compact,
}: PaymentBreakdownProps) {
  const totalPaid = getTotalPaid(
    payments.map((p) => ({ method: p.method as PaymentMethod, amount: p.amount }))
  );
  const balance = Math.max(0, orderTotal - totalPaid);
  const split = isSplitOrder(payments.map((p) => ({ method: p.method as PaymentMethod })));

  if (payments.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No payment records</p>
    );
  }

  if (payments.length === 1 && !split && payments[0].method !== "SPLIT") {
    const p = payments[0];
    return (
      <div className={compact ? "text-xs space-y-0.5" : "text-sm space-y-1"}>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={getPaymentMethodBadgeVariant(p.method)}>
            {getPaymentMethodLabel(p.method)}
          </Badge>
          <span className="font-medium">{formatCurrency(p.amount)}</span>
        </div>
        {p.reference && (
          <p className="text-muted-foreground">Ref: {p.reference}</p>
        )}
        {changeGiven > 0 && (
          <p className="text-emerald-500">Change: {formatCurrency(changeGiven)}</p>
        )}
      </div>
    );
  }

  return (
    <div className={compact ? "text-xs space-y-1" : "text-sm space-y-2"}>
      {split && (
        <Badge variant="outline" className="mb-1">
          Split Payment
        </Badge>
      )}
      {payments.map((p, i) => (
        <div key={i} className="flex flex-wrap items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <Badge variant={getPaymentMethodBadgeVariant(p.method)}>
              {getPaymentMethodLabel(p.method)}
            </Badge>
            {p.reference && (
              <span className="text-muted-foreground text-xs">Ref: {p.reference}</span>
            )}
          </div>
          <span className="font-medium">{formatCurrency(p.amount)}</span>
        </div>
      ))}
      <div className="border-t pt-1 space-y-0.5">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total paid</span>
          <span className="font-semibold">{formatCurrency(totalPaid)}</span>
        </div>
        {balance > 0.009 && (
          <div className="flex justify-between text-amber-500">
            <span>Balance</span>
            <span>{formatCurrency(balance)}</span>
          </div>
        )}
        {changeGiven > 0 && (
          <div className="flex justify-between text-emerald-500">
            <span>Change</span>
            <span>{formatCurrency(changeGiven)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
