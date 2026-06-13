export const RECEIPT_SIZES = ["58mm", "80mm"] as const;
export type ReceiptSize = (typeof RECEIPT_SIZES)[number];

export const RECEIPT_ALIGNMENTS = ["LEFT", "CENTER"] as const;
export type ReceiptAlignment = (typeof RECEIPT_ALIGNMENTS)[number];

export const RECEIPT_FONT_SIZES = ["SMALL", "NORMAL", "LARGE", "EXTRA_LARGE"] as const;
export type ReceiptFontSize = (typeof RECEIPT_FONT_SIZES)[number];

export const RECEIPT_SPACING = ["COMPACT", "NORMAL", "SPACIOUS"] as const;
export type ReceiptSpacing = (typeof RECEIPT_SPACING)[number];

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
  receiptFontSize?: string | null;
  receiptBoldText?: boolean | null;
  receiptSpacing?: string | null;
  /** @deprecated use receiptSpacing */
  receiptCompact?: boolean | null;
}

export function normalizeReceiptSize(size?: string | null): ReceiptSize {
  return size === "58mm" ? "58mm" : "80mm";
}

export function normalizeReceiptAlignment(alignment?: string | null): ReceiptAlignment {
  return alignment === "CENTER" ? "CENTER" : "LEFT";
}

export function normalizeReceiptFontSize(fontSize?: string | null): ReceiptFontSize {
  switch (fontSize) {
    case "SMALL":
      return "SMALL";
    case "LARGE":
      return "LARGE";
    case "EXTRA_LARGE":
      return "EXTRA_LARGE";
    default:
      return "NORMAL";
  }
}

export function normalizeReceiptSpacing(
  spacing?: string | null,
  legacyCompact?: boolean | null
): ReceiptSpacing {
  if (spacing === "COMPACT" || spacing === "SPACIOUS") return spacing;
  if (legacyCompact) return "COMPACT";
  return "NORMAL";
}

export function receiptSizeClass(size?: string | null): string {
  return normalizeReceiptSize(size) === "58mm" ? "receipt-58mm" : "receipt-80mm";
}

export function receiptPrintSizeClass(size?: string | null): string {
  return receiptSizeClass(size);
}

export function receiptAlignmentClass(alignment?: string | null): string {
  return normalizeReceiptAlignment(alignment) === "CENTER"
    ? "receipt-align-center"
    : "receipt-align-left";
}

export function receiptFontSizeClass(fontSize?: string | null): string {
  switch (normalizeReceiptFontSize(fontSize)) {
    case "SMALL":
      return "receipt-font-small";
    case "LARGE":
      return "receipt-font-large";
    case "EXTRA_LARGE":
      return "receipt-font-xl";
    default:
      return "receipt-font-normal";
  }
}

export function receiptSpacingClass(
  spacing?: string | null,
  legacyCompact?: boolean | null
): string {
  switch (normalizeReceiptSpacing(spacing, legacyCompact)) {
    case "COMPACT":
      return "receipt-spacing-compact";
    case "SPACIOUS":
      return "receipt-spacing-spacious";
    default:
      return "receipt-spacing-normal";
  }
}

export function getReceiptLayoutClasses(
  settings: ReceiptLayoutSettings,
  previewSize?: ReceiptSize,
  previewFontSize?: ReceiptFontSize
): string {
  const parts = [
    "receipt-thermal",
    "thermal-receipt-root",
    receiptSizeClass(previewSize ?? settings.receiptSize),
    receiptAlignmentClass(settings.receiptAlignment),
    receiptFontSizeClass(previewFontSize ?? settings.receiptFontSize),
    receiptSpacingClass(settings.receiptSpacing, settings.receiptCompact),
  ];
  if (settings.receiptBoldText !== false) parts.push("receipt-bold-text");
  return parts.join(" ");
}

export function getPrintableWidthMm(size: ReceiptSize): number {
  return size === "58mm" ? 54 : 76;
}

export function getPaperWidthMm(size: ReceiptSize): number {
  return size === "58mm" ? 58 : 80;
}

export function defaultReceiptFontSize(size?: string | null): ReceiptFontSize {
  return normalizeReceiptSize(size) === "58mm" ? "LARGE" : "NORMAL";
}
