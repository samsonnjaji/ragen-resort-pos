"use client";

import { formatCurrency, formatDate } from "@/lib/utils";
import { getReceiptLayoutClasses, type ReceiptLayoutSettings } from "@/lib/receipt-types";

interface PrinterTestReceiptProps extends ReceiptLayoutSettings {
  businessName: string;
  currency: string;
  previewSize?: "58mm" | "80mm";
  previewFontSize?: "SMALL" | "NORMAL" | "LARGE" | "EXTRA_LARGE";
  label?: string;
}

export function PrinterTestReceipt({
  businessName,
  currency,
  receiptSize,
  receiptAlignment,
  receiptFontSize,
  receiptBoldText,
  receiptSpacing,
  receiptCompact,
  previewSize,
  previewFontSize,
  label = "Printer Test",
}: PrinterTestReceiptProps) {
  const now = new Date();
  const layout = getReceiptLayoutClasses(
    {
      receiptSize,
      receiptAlignment,
      receiptFontSize,
      receiptBoldText,
      receiptSpacing,
      receiptCompact,
    },
    previewSize,
    previewFontSize
  );

  return (
    <div id="printer-test-receipt" className={layout}>
      <div className="receipt-header">
        <p className="receipt-business-name uppercase">RAGEN RESORT POS</p>
        <p className="receipt-title">{businessName}</p>
      </div>

      <div className="receipt-sep text-center">
        <p className="receipt-title">{label}</p>
        <p className="receipt-body">{previewSize ?? receiptSize ?? "80mm"} paper test</p>
        <p className="receipt-body">{formatDate(now)}</p>
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
          <tr>
            <td>Sample Item 1</td>
            <td className="text-center">1</td>
            <td className="text-right">{formatCurrency(0, currency)}</td>
          </tr>
          <tr>
            <td>Sample Item 2</td>
            <td className="text-center">1</td>
            <td className="text-right">{formatCurrency(0, currency)}</td>
          </tr>
        </tbody>
      </table>

      <div className="receipt-sep receipt-body">
        <div className="receipt-between receipt-total">
          <span className="receipt-label">TOTAL</span>
          <span className="receipt-value">{formatCurrency(0, currency)}</span>
        </div>
      </div>

      <div className="receipt-sep receipt-body">
        <p className="receipt-title">Payment</p>
        <div className="receipt-between">
          <span className="receipt-label">Cash</span>
          <span className="receipt-value">{formatCurrency(0, currency)}</span>
        </div>
      </div>

      <p className="receipt-sep receipt-footer text-center">Thank you — printer test successful</p>
    </div>
  );
}
