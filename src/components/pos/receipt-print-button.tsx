"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { printThermalReceipt } from "@/lib/print-receipt";
import { useToast } from "@/hooks/use-toast";
import type { ReceiptPrintTarget, ReceiptSize } from "@/lib/receipt-types";

interface ReceiptPrintButtonProps {
  targetId: ReceiptPrintTarget;
  receiptSize?: string | null;
  receiptAlignment?: string | null;
  receiptCompact?: boolean | null;
  forceSize?: ReceiptSize;
  label?: string;
  className?: string;
  variant?: "gold" | "outline" | "default" | "ghost";
}

export function ReceiptPrintButton({
  targetId,
  receiptSize,
  receiptAlignment,
  receiptCompact,
  forceSize,
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
      receiptCompact,
      forceSize,
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
