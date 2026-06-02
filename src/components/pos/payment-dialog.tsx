"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import {
  getPaymentMethodBadgeVariant,
  getPaymentMethodLabel,
  roundMoney,
} from "@/lib/payments";
import {
  Banknote,
  Smartphone,
  CreditCard,
  Building2,
  Split,
} from "lucide-react";
import { PaymentMethod } from "@prisma/client";

export type PaymentLineDraft = {
  method: "CASH" | "MPESA" | "CARD" | "BANK";
  amount: number;
  reference?: string;
};

type CheckoutMode = PaymentMethod | "SPLIT_UI";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderTotal: number;
  loading: boolean;
  disabled?: boolean;
  onComplete: (payments: PaymentLineDraft[]) => void;
}

const METHODS: {
  mode: CheckoutMode;
  icon: typeof Banknote;
  label: string;
}[] = [
  { mode: "CASH", icon: Banknote, label: "Cash" },
  { mode: "MPESA", icon: Smartphone, label: "M-Pesa" },
  { mode: "CARD", icon: CreditCard, label: "Card" },
  { mode: "BANK", icon: Building2, label: "Bank" },
  { mode: "SPLIT_UI", icon: Split, label: "Split" },
];

const SPLIT_METHODS = ["CASH", "MPESA", "CARD", "BANK"] as const;

export function PaymentDialog({
  open,
  onOpenChange,
  orderTotal,
  loading,
  disabled,
  onComplete,
}: PaymentDialogProps) {
  const [mode, setMode] = useState<CheckoutMode>("CASH");
  const [cashTendered, setCashTendered] = useState("");
  const [mpesaRef, setMpesaRef] = useState("");
  const [cardRef, setCardRef] = useState("");
  const [bankRef, setBankRef] = useState("");
  const [splitAmounts, setSplitAmounts] = useState<Record<string, string>>({
    CASH: "",
    MPESA: "",
    CARD: "",
    BANK: "",
  });
  const [splitRefs, setSplitRefs] = useState<Record<string, string>>({
    MPESA: "",
    CARD: "",
    BANK: "",
  });

  useEffect(() => {
    if (!open) return;
    setMode("CASH");
    setCashTendered(orderTotal > 0 ? String(orderTotal) : "");
    setMpesaRef("");
    setCardRef("");
    setBankRef("");
    setSplitAmounts({ CASH: "", MPESA: "", CARD: "", BANK: "" });
    setSplitRefs({ MPESA: "", CARD: "", BANK: "" });
  }, [open, orderTotal]);

  const splitLines = useMemo(() => {
    return SPLIT_METHODS.map((m) => ({
      method: m,
      amount: roundMoney(Number(splitAmounts[m]) || 0),
      reference: splitRefs[m]?.trim() || undefined,
    })).filter((l) => l.amount > 0);
  }, [splitAmounts, splitRefs]);

  const { totalEntered, balanceRemaining, changeDue, canComplete, validationError } =
    useMemo(() => {
      if (mode === "SPLIT_UI") {
        const entered = roundMoney(splitLines.reduce((s, l) => s + l.amount, 0));
        const balance = roundMoney(orderTotal - entered);
        const change = entered > orderTotal ? roundMoney(entered - orderTotal) : 0;
        let err: string | null = null;
        if (entered < orderTotal - 0.009) {
          err = `Need ${formatCurrency(orderTotal - entered)} more`;
        } else if (change > 0) {
          const nonCash = splitLines
            .filter((l) => l.method !== "CASH")
            .reduce((s, l) => s + l.amount, 0);
          const cash = splitLines
            .filter((l) => l.method === "CASH")
            .reduce((s, l) => s + l.amount, 0);
          if (nonCash > orderTotal + 0.009) err = "Non-cash cannot exceed order total";
          else if (cash < change - 0.009) err = "Overpayment must come from cash";
        }
        const mpesaLine = splitLines.find((l) => l.method === "MPESA");
        if (mpesaLine && !mpesaLine.reference) {
          err = "M-Pesa reference required";
        }
        if (splitLines.length === 0) err = "Enter at least one payment";
        return {
          totalEntered: entered,
          balanceRemaining: balance > 0 ? balance : 0,
          changeDue: change,
          canComplete: !err && entered >= orderTotal - 0.009,
          validationError: err,
        };
      }

      if (mode === "CASH") {
        const tendered = roundMoney(Number(cashTendered) || 0);
        const change = tendered > orderTotal ? roundMoney(tendered - orderTotal) : 0;
        const err =
          tendered < orderTotal - 0.009
            ? `Need ${formatCurrency(orderTotal - tendered)} more`
            : null;
        return {
          totalEntered: tendered,
          balanceRemaining: err ? roundMoney(orderTotal - tendered) : 0,
          changeDue: change,
          canComplete: !err,
          validationError: err,
        };
      }

      if (mode === "MPESA") {
        const err = !mpesaRef.trim() ? "M-Pesa reference required" : null;
        return {
          totalEntered: orderTotal,
          balanceRemaining: 0,
          changeDue: 0,
          canComplete: !err,
          validationError: err,
        };
      }

      return {
        totalEntered: orderTotal,
        balanceRemaining: 0,
        changeDue: 0,
        canComplete: true,
        validationError: null,
      };
    }, [mode, orderTotal, cashTendered, mpesaRef, splitLines]);

  const buildPayments = (): PaymentLineDraft[] => {
    if (mode === "SPLIT_UI") return splitLines;
    if (mode === "CASH") {
      return [{ method: "CASH", amount: roundMoney(Number(cashTendered) || 0) }];
    }
    if (mode === "MPESA") {
      return [
        { method: "MPESA", amount: orderTotal, reference: mpesaRef.trim() },
      ];
    }
    if (mode === "CARD") {
      return [
        {
          method: "CARD",
          amount: orderTotal,
          reference: cardRef.trim() || undefined,
        },
      ];
    }
    return [
      {
        method: "BANK",
        amount: orderTotal,
        reference: bankRef.trim() || undefined,
      },
    ];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            Payment — {formatCurrency(orderTotal)}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {METHODS.map(({ mode: m, icon: Icon, label }) => (
            <Button
              key={m}
              type="button"
              variant={mode === m ? "default" : "outline"}
              className="h-16 flex-col gap-1 text-sm touch-target"
              onClick={() => setMode(m)}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Button>
          ))}
        </div>

        {mode === "CASH" && (
          <div className="space-y-2 mt-2">
            <Label>Cash tendered</Label>
            <Input
              type="number"
              min={0}
              step="1"
              value={cashTendered}
              onChange={(e) => setCashTendered(e.target.value)}
              className="h-12 text-lg"
            />
          </div>
        )}

        {mode === "MPESA" && (
          <div className="space-y-2 mt-2">
            <Label>M-Pesa transaction code *</Label>
            <Input
              value={mpesaRef}
              onChange={(e) => setMpesaRef(e.target.value)}
              placeholder="e.g. QHX12345"
              className="h-12"
            />
          </div>
        )}

        {mode === "CARD" && (
          <div className="space-y-2 mt-2">
            <Label>Reference (optional)</Label>
            <Input
              value={cardRef}
              onChange={(e) => setCardRef(e.target.value)}
              placeholder="Auth / terminal ref"
              className="h-12"
            />
          </div>
        )}

        {mode === "BANK" && (
          <div className="space-y-2 mt-2">
            <Label>Reference (optional)</Label>
            <Input
              value={bankRef}
              onChange={(e) => setBankRef(e.target.value)}
              placeholder="Transfer reference"
              className="h-12"
            />
          </div>
        )}

        {mode === "SPLIT_UI" && (
          <div className="space-y-3 mt-2">
            {SPLIT_METHODS.map((m) => (
              <div key={m} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={getPaymentMethodBadgeVariant(m)} className="w-20 justify-center">
                    {getPaymentMethodLabel(m)}
                  </Badge>
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    placeholder="0"
                    value={splitAmounts[m]}
                    onChange={(e) =>
                      setSplitAmounts((prev) => ({ ...prev, [m]: e.target.value }))
                    }
                    className="h-11"
                  />
                </div>
                {m === "MPESA" && Number(splitAmounts.MPESA) > 0 && (
                  <Input
                    value={splitRefs.MPESA}
                    onChange={(e) =>
                      setSplitRefs((prev) => ({ ...prev, MPESA: e.target.value }))
                    }
                    placeholder="M-Pesa ref *"
                    className="h-10 ml-24"
                  />
                )}
                {(m === "CARD" || m === "BANK") && Number(splitAmounts[m]) > 0 && (
                  <Input
                    value={splitRefs[m] ?? ""}
                    onChange={(e) =>
                      setSplitRefs((prev) => ({ ...prev, [m]: e.target.value }))
                    }
                    placeholder="Reference (optional)"
                    className="h-10 ml-24"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm mt-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Order total</span>
            <span className="font-semibold">{formatCurrency(orderTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total entered</span>
            <span className="font-semibold">{formatCurrency(totalEntered)}</span>
          </div>
          {balanceRemaining > 0 && (
            <div className="flex justify-between text-amber-500">
              <span>Balance remaining</span>
              <span className="font-semibold">{formatCurrency(balanceRemaining)}</span>
            </div>
          )}
          {changeDue > 0 && (
            <div className="flex justify-between text-emerald-500">
              <span>Change due</span>
              <span className="font-bold">{formatCurrency(changeDue)}</span>
            </div>
          )}
          {validationError && (
            <p className="text-destructive text-xs pt-1">{validationError}</p>
          )}
        </div>

        <Button
          variant="gold"
          className="w-full mt-2 h-14 text-base touch-target"
          disabled={loading || disabled || !canComplete}
          onClick={() => onComplete(buildPayments())}
        >
          Complete Sale
        </Button>
      </DialogContent>
    </Dialog>
  );
}
