"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { printThermalReceipt } from "@/lib/print-receipt";
import { useToast } from "@/hooks/use-toast";
import type { ReceiptFontSize, ReceiptPrintTarget, ReceiptSize } from "@/lib/receipt-types";

interface ReceiptPrintButtonProps {
  targetId: ReceiptPrintTarget;
  receiptSize?: string | null;
  receiptAlignment?: string | null;
  receiptFontSize?: string | null;
  receiptBoldText?: boolean | null;
  receiptSpacing?: string | null;
  receiptCompact?: boolean | null;
  forceSize?: ReceiptSize;
  forceFontSize?: ReceiptFontSize;
  label?: string;
  className?: string;
  variant?: "gold" | "outline" | "default" | "ghost";
}

export function ReceiptPrintButton({
  targetId,
  receiptSize,
  receiptAlignment,
  receiptFontSize,
  receiptBoldText,
  receiptSpacing,
  receiptCompact,
  forceSize,
  forceFontSize,
  label = "Print Receipt",
  className,
  variant = "gold",
}: ReceiptPrintButtonProps) {
  const { toast } = useToast();

  const handlePrint = () => {
    printThermalReceipt({
      targetId,
      receiptSize,
      receiptAlignment,
      receiptFontSize,
      receiptBoldText,
      receiptSpacing,
      receiptCompact,
      forceSize,
      forceFontSize,
      onError: (message) => {
        toast({ title: "Print failed", description: message, variant: "destructive" });
      },
    });
  };

  return (
    <Button variant={variant} className={className} onClick={handlePrint}>
      <Printer className="h-4 w-4 mr-2" />
      {label}
    </Button>
  );
}
