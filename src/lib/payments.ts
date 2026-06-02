import { PaymentMethod } from "@prisma/client";
import { z } from "zod";
import { AppError } from "@/lib/app-error";

/** Methods stored on Payment rows (SPLIT is UI-only). */
export const STORED_PAYMENT_METHODS = ["CASH", "MPESA", "CARD", "BANK", "ROOM_CHARGE"] as const;
export type StoredPaymentMethod = (typeof STORED_PAYMENT_METHODS)[number];

export const paymentLineSchema = z.object({
  method: z.enum(["CASH", "MPESA", "CARD", "BANK", "ROOM_CHARGE"]),
  amount: z.number().positive("Payment amount must be positive"),
  reference: z.string().optional(),
});

export const salePaymentsInputSchema = z.object({
  orderTotal: z.number().nonnegative(),
  lines: z.array(paymentLineSchema).min(1, "At least one payment is required"),
});

export type PaymentLineInput = z.infer<typeof paymentLineSchema>;

export type NormalizedPayment = {
  method: PaymentMethod;
  amount: number;
  reference?: string;
};

export type PaymentSummary = {
  cash: number;
  mpesa: number;
  card: number;
  bank: number;
  roomCharge: number;
  legacySplit: number;
  total: number;
};

const MONEY_EPS = 0.009;

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isStoredMethod(method: PaymentMethod): method is StoredPaymentMethod {
  return (STORED_PAYMENT_METHODS as readonly string[]).includes(method);
}

export function getPaymentMethodLabel(method: string): string {
  switch (method) {
    case "CASH":
      return "Cash";
    case "MPESA":
      return "M-Pesa";
    case "CARD":
      return "Card";
    case "BANK":
      return "Bank";
    case "SPLIT":
      return "Split Payment";
    case "ROOM_CHARGE":
      return "Room Charge";
    default:
      return method;
  }
}

export function getPaymentMethodBadgeVariant(
  method: string
): "default" | "secondary" | "success" | "warning" | "destructive" | "outline" {
  switch (method) {
    case "CASH":
      return "success";
    case "MPESA":
      return "warning";
    case "CARD":
      return "default";
    case "BANK":
      return "secondary";
    case "SPLIT":
      return "outline";
    case "ROOM_CHARGE":
      return "destructive";
    default:
      return "outline";
  }
}

export function isSplitOrder(payments: { method: PaymentMethod }[]): boolean {
  if (payments.length > 1) return true;
  return payments.some((p) => p.method === "SPLIT");
}

/** Sum payment rows for display (handles legacy SPLIT single row). */
export function getTotalPaid(payments: { method: PaymentMethod; amount: number }[]): number {
  return roundMoney(payments.reduce((s, p) => s + p.amount, 0));
}

export function getOrderBalance(orderTotal: number, payments: { amount: number }[]): number {
  const paid = roundMoney(payments.reduce((s, p) => s + p.amount, 0));
  return roundMoney(Math.max(0, orderTotal - paid));
}

/**
 * Validate and normalize payments for a completed sale.
 * - Single CASH with amount > order total: treat as tendered, record order total on payment, set change.
 * - Split / multi-method: sum must be >= order total; overpay only from cash; stored rows sum to order total.
 */
export function validateAndNormalizePayments(
  rawLines: PaymentLineInput[],
  orderTotal: number
): { payments: NormalizedPayment[]; changeGiven: number; isSplit: boolean } {
  const parsed = salePaymentsInputSchema.safeParse({
    orderTotal,
    lines: rawLines.filter((l) => l.amount > 0),
  });
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Invalid payment data";
    throw new AppError(msg);
  }

  const lines = parsed.data.lines;

  for (const line of lines) {
    if (line.method === "MPESA" && !line.reference?.trim()) {
      throw new AppError("M-Pesa transaction reference is required.");
    }
  }

  const totalEntered = roundMoney(lines.reduce((s, l) => s + l.amount, 0));

  if (totalEntered < orderTotal - MONEY_EPS) {
    throw new AppError("Total paid is less than the order total.");
  }

  let changeGiven = 0;
  let payments: NormalizedPayment[] = lines.map((l) => ({
    method: l.method as PaymentMethod,
    amount: roundMoney(l.amount),
    reference: l.reference?.trim() || undefined,
  }));

  const isSplit = payments.length > 1;

  if (payments.length === 1 && payments[0].method === "CASH" && totalEntered > orderTotal + MONEY_EPS) {
    changeGiven = roundMoney(totalEntered - orderTotal);
    payments = [{ ...payments[0], amount: orderTotal }];
    return { payments, changeGiven, isSplit: false };
  }

  if (totalEntered > orderTotal + MONEY_EPS) {
    changeGiven = roundMoney(totalEntered - orderTotal);
    const nonCash = payments
      .filter((p) => p.method !== "CASH")
      .reduce((s, p) => s + p.amount, 0);
    const cashTotal = payments
      .filter((p) => p.method === "CASH")
      .reduce((s, p) => s + p.amount, 0);

    if (nonCash > orderTotal + MONEY_EPS) {
      throw new AppError("Non-cash payments cannot exceed the order total.");
    }
    if (cashTotal < changeGiven - MONEY_EPS) {
      throw new AppError("Overpayment must come from cash.");
    }

    payments = payments
      .map((p) =>
        p.method === "CASH" ? { ...p, amount: roundMoney(p.amount - changeGiven) } : p
      )
      .filter((p) => p.amount > MONEY_EPS);
  }

  const storedSum = roundMoney(payments.reduce((s, p) => s + p.amount, 0));
  if (Math.abs(storedSum - orderTotal) > MONEY_EPS) {
    if (isSplit) {
      throw new AppError("Split payment amounts must equal the order total.");
    }
    throw new AppError("Payment amounts do not match the order total.");
  }

  return { payments, changeGiven, isSplit };
}

export function aggregatePaymentTotals(
  orders: { payments: { method: PaymentMethod; amount: number }[] }[]
): PaymentSummary {
  const summary: PaymentSummary = {
    cash: 0,
    mpesa: 0,
    card: 0,
    bank: 0,
    roomCharge: 0,
    legacySplit: 0,
    total: 0,
  };

  for (const order of orders) {
    for (const p of order.payments) {
      switch (p.method) {
        case "CASH":
          summary.cash += p.amount;
          break;
        case "MPESA":
          summary.mpesa += p.amount;
          break;
        case "CARD":
          summary.card += p.amount;
          break;
        case "BANK":
          summary.bank += p.amount;
          break;
        case "ROOM_CHARGE":
          summary.roomCharge += p.amount;
          break;
        case "SPLIT":
          summary.legacySplit += p.amount;
          break;
        default:
          break;
      }
      summary.total += p.amount;
    }
  }

  summary.cash = roundMoney(summary.cash);
  summary.mpesa = roundMoney(summary.mpesa);
  summary.card = roundMoney(summary.card);
  summary.bank = roundMoney(summary.bank);
  summary.roomCharge = roundMoney(summary.roomCharge);
  summary.legacySplit = roundMoney(summary.legacySplit);
  summary.total = roundMoney(summary.total);

  return summary;
}

export function formatPaymentBreakdownForLog(
  payments: { method: PaymentMethod; amount: number; reference?: string | null }[],
  changeGiven: number
): string {
  const parts = payments.map(
    (p) =>
      `${getPaymentMethodLabel(p.method)} ${p.amount}${p.reference ? ` (ref: ${p.reference})` : ""}`
  );
  if (changeGiven > 0) parts.push(`Change: ${changeGiven}`);
  return parts.join("; ");
}
