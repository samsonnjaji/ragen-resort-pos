"use client";

import { formatCurrency, formatDate } from "@/lib/utils";
import { getReceiptLayoutClasses, type ReceiptLayoutSettings } from "@/lib/receipt-types";

interface PrinterTestReceiptProps extends ReceiptLayoutSettings {
  businessName: string;
  currency: string;
  previewSize?: "58mm" | "80mm";
  label?: string;
}

export function PrinterTestReceipt({
  businessName,
  currency,
  receiptSize,
  receiptAlignment,
  receiptCompact,
  previewSize,
  label = "Printer Test",
}: PrinterTestReceiptProps) {
  const now = new Date();
  const layout = getReceiptLayoutClasses(
    { receiptSize, receiptAlignment, receiptCompact },
    previewSize
  );

  return (
    <div id="printer-test-receipt" className={layout}>
      <div className="receipt-header">
        <p className="font-bold uppercase">RAGEN RESORT POS</p>
        <p>{businessName}</p>
      </div>

      <div className="receipt-sep text-center">
        <p className="font-bold">{label}</p>
        <p>{previewSize ?? receiptSize ?? "80mm"} paper test</p>
        <p>{formatDate(now)}</p>
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
            <td>Sample Item</td>
            <td className="text-center">1</td>
            <td className="text-right">{formatCurrency(0, currency)}</td>
          </tr>
          <tr>
            <td>Test Line 2</td>
            <td className="text-center">2</td>
            <td className="text-right">{formatCurrency(0, currency)}</td>
          </tr>
        </tbody>
      </table>

      <div className="receipt-sep">
        <div className="receipt-between">
          <span className="receipt-label">Subtotal</span>
          <span className="receipt-value">{formatCurrency(0, currency)}</span>
        </div>
        <div className="receipt-between font-bold">
          <span className="receipt-label">TOTAL</span>
          <span className="receipt-value">{formatCurrency(0, currency)}</span>
        </div>
      </div>

      <p className="receipt-sep text-center font-bold">Printer test successful</p>
    </div>
  );
}
