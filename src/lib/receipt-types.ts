export const RECEIPT_SIZES = ["58mm", "80mm"] as const;
export type ReceiptSize = (typeof RECEIPT_SIZES)[number];

export const RECEIPT_ALIGNMENTS = ["LEFT", "CENTER"] as const;
export type ReceiptAlignment = (typeof RECEIPT_ALIGNMENTS)[number];

export const RECEIPT_PRINT_TARGETS = [
  "receipt",
  "room-sale-receipt",
  "room-invoice",
  "printer-test-receipt",
] as const;
export type ReceiptPrintTarget = (typeof RECEIPT_PRINT_TARGETS)[number];

export interface ReceiptLayoutSettings {
  receiptSize?: string | null;
  receiptAlignment?: string | null;
  receiptCompact?: boolean | null;
}

export function normalizeReceiptSize(size?: string | null): ReceiptSize {
  return size === "58mm" ? "58mm" : "80mm";
}

export function normalizeReceiptAlignment(alignment?: string | null): ReceiptAlignment {
  return alignment === "CENTER" ? "CENTER" : "LEFT";
}

/** Screen preview width class on the receipt element */
export function receiptSizeClass(size?: string | null): string {
  return normalizeReceiptSize(size) === "58mm" ? "receipt-58mm" : "receipt-80mm";
}

/** Body class applied during print */
export function receiptPrintSizeClass(size?: string | null): string {
  return receiptSizeClass(size);
}

export function receiptAlignmentClass(alignment?: string | null): string {
  return normalizeReceiptAlignment(alignment) === "CENTER"
    ? "receipt-align-center"
    : "receipt-align-left";
}

export function getReceiptLayoutClasses(
  settings: ReceiptLayoutSettings,
  previewSize?: ReceiptSize
): string {
  const parts = ["receipt-thermal", "thermal-receipt-root", receiptSizeClass(previewSize ?? settings.receiptSize)];
  parts.push(receiptAlignmentClass(settings.receiptAlignment));
  if (settings.receiptCompact) parts.push("receipt-compact");
  return parts.join(" ");
}

export function getPrintableWidthMm(size: ReceiptSize): number {
  return size === "58mm" ? 48 : 72;
}

export function getPaperWidthMm(size: ReceiptSize): number {
  return size === "58mm" ? 58 : 80;
}
