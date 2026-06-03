/**
 * Executive-quality Excel workbooks (Summary + Details + Chart Data).
 * Styled sheets via xlsx-js-style; chart PNGs embedded on Summary via ExcelJS.
 */

import type { ReportModuleId } from "@/components/reports/report-modules";
import type { ReportSettingsInfo } from "@/components/reports/report-viewer";
import { buildReportChartImages, type ReportChartImage } from "@/lib/report-chart-images";
import { getPaymentMethodLabel } from "@/lib/payments";
import { formatDate } from "@/lib/utils";

const CHART_ROW_SPAN = 14;

export const EXCEL_REPORT_IDS: ReportModuleId[] = [
  "sales",
  "payment",
  "cashier",
  "inventory",
  "occupancy",
  "profit",
  "expense",
  "product-performance",
];

const SHEET_SUMMARY = "Summary";
const SHEET_DETAILS = "Details";
const SHEET_CHART = "Chart Data";

export type ReportExcelMeta = {
  reportTitle: string;
  settings: ReportSettingsInfo;
  dateRangeLabel: string;
  generatedAt: Date;
  generatedBy: string;
  filename: string;
};

type KpiEntry = { label: string; value: string | number; isCurrency?: boolean; formula?: string };

type ConditionalMode = "inventory-stock" | "revenue-highlight" | "none";

type DetailTableConfig = {
  headers: string[];
  rows: (string | number | null | undefined)[][];
  totalsRow?: (string | number | null | undefined)[];
  currencyColumnIndexes?: number[];
  sumColumnIndexes?: number[];
  emptyMessage?: string;
  useFormulaTotals?: boolean;
  conditionalMode?: ConditionalMode;
  stockColumnIndex?: number;
  alertColumnIndex?: number;
  revenueColumnIndexes?: number[];
};

type ChartSeries = { title: string; headers: string[]; rows: (string | number)[][] };

type WorkbookInput = {
  meta: ReportExcelMeta;
  kpis: KpiEntry[];
  paymentBreakdown?: {
    cash: number;
    mpesa: number;
    card: number;
    bank: number;
    grandTotal?: number;
    useDetailsFormulas?: boolean;
  };
  details: DetailTableConfig;
  chartSeries?: ChartSeries[];
  chartImages?: ReportChartImage[];
  notes?: string[];
};

type SummaryBuildResult = {
  ws: WorkSheet;
  chartImageAnchorRows: number[];
};

type MergeRange = { s: { r: number; c: number }; e: { r: number; c: number } };

type WorkSheet = Record<string, unknown> & {
  "!merges"?: MergeRange[];
  "!cols"?: { wch: number }[];
  "!ref"?: string;
  "!freeze"?: Record<string, string | number>;
  "!autofilter"?: { ref: string };
  "!margins"?: Record<string, number>;
  "!pageSetup"?: Record<string, string | number | boolean>;
  "!print"?: Record<string, string>;
  "!headerFooter"?: Record<string, string | boolean>;
};

const C = {
  emerald: "059669",
  emeraldDark: "047857",
  gold: "D4AF37",
  goldLight: "FEF9E7",
  white: "FFFFFF",
  text: "0F172A",
  muted: "64748B",
  rowAlt: "F1F5F9",
  redLight: "FEE2E2",
  red: "DC2626",
  greenLight: "D1FAE5",
  green: "047857",
  border: "CBD5E1",
};

const KES_FMT = '#,##0" KES"';
const COL_COUNT = 6;

const styles = {
  logoMain: {
    font: { bold: true, sz: 22, color: { rgb: C.white } },
    fill: { patternType: "solid", fgColor: { rgb: C.emerald } },
    alignment: { horizontal: "center", vertical: "center" },
  },
  logoSub: {
    font: { sz: 11, color: { rgb: C.white } },
    fill: { patternType: "solid", fgColor: { rgb: C.emeraldDark } },
    alignment: { horizontal: "center", vertical: "center" },
  },
  logoBusiness: {
    font: { bold: true, sz: 12, color: { rgb: C.gold } },
    fill: { patternType: "solid", fgColor: { rgb: C.emeraldDark } },
    alignment: { horizontal: "center", vertical: "center" },
  },
  reportTitle: {
    font: { bold: true, sz: 18, color: { rgb: C.text } },
    alignment: { horizontal: "center", vertical: "center" },
  },
  metaLabel: { font: { bold: true, sz: 10, color: { rgb: C.muted } } },
  metaValue: { font: { sz: 10, color: { rgb: C.text } } },
  sectionHeader: {
    font: { bold: true, sz: 12, color: { rgb: C.white } },
    fill: { patternType: "solid", fgColor: { rgb: C.emerald } },
    alignment: { horizontal: "center", vertical: "center" },
  },
  kpiCardLabel: {
    font: { bold: true, sz: 10, color: { rgb: C.white } },
    fill: { patternType: "solid", fgColor: { rgb: C.emerald } },
    alignment: { horizontal: "center", vertical: "center" },
    border: borderAll(C.emeraldDark),
  },
  kpiCardValue: {
    font: { bold: true, sz: 16, color: { rgb: C.text } },
    fill: { patternType: "solid", fgColor: { rgb: C.goldLight } },
    alignment: { horizontal: "center", vertical: "center" },
    border: borderAll(C.gold),
  },
  kpiCardValueCurrency: {
    font: { bold: true, sz: 16, color: { rgb: C.emeraldDark } },
    fill: { patternType: "solid", fgColor: { rgb: C.goldLight } },
    numFmt: KES_FMT,
    alignment: { horizontal: "center", vertical: "center" },
    border: borderAll(C.gold),
  },
  kpiCardValueFormula: {
    font: { bold: true, sz: 16, color: { rgb: C.emeraldDark } },
    fill: { patternType: "solid", fgColor: { rgb: C.goldLight } },
    numFmt: KES_FMT,
    alignment: { horizontal: "center", vertical: "center" },
    border: borderAll(C.gold),
  },
  paymentHeader: {
    font: { bold: true, sz: 10, color: { rgb: C.text } },
    fill: { patternType: "solid", fgColor: { rgb: C.gold } },
    border: borderAll(C.border),
  },
  paymentValue: {
    font: { sz: 11, color: { rgb: C.text } },
    numFmt: KES_FMT,
    alignment: { horizontal: "right", vertical: "center" },
    border: borderAll(C.border),
  },
  paymentGrand: {
    font: { bold: true, sz: 14, color: { rgb: C.text } },
    fill: { patternType: "solid", fgColor: { rgb: C.goldLight } },
    numFmt: KES_FMT,
    alignment: { horizontal: "right", vertical: "center" },
    border: borderAll(C.gold),
  },
  tableHeader: {
    font: { bold: true, sz: 11, color: { rgb: C.white } },
    fill: { patternType: "solid", fgColor: { rgb: C.emerald } },
    alignment: { horizontal: "center", vertical: "center" },
    border: borderAll(C.border),
  },
  tableCell: {
    font: { sz: 10, color: { rgb: C.text } },
    border: borderAll(C.border),
    alignment: { vertical: "center" },
  },
  tableCellAlt: {
    font: { sz: 10, color: { rgb: C.text } },
    fill: { patternType: "solid", fgColor: { rgb: C.rowAlt } },
    border: borderAll(C.border),
  },
  tableCellCurrency: {
    font: { sz: 10, color: { rgb: C.text } },
    numFmt: KES_FMT,
    alignment: { horizontal: "right", vertical: "center" },
    border: borderAll(C.border),
  },
  stockLow: {
    font: { bold: true, sz: 10, color: { rgb: C.red } },
    fill: { patternType: "solid", fgColor: { rgb: C.redLight } },
    border: borderAll(C.red),
    alignment: { horizontal: "center" },
  },
  stockHealthy: {
    font: { bold: true, sz: 10, color: { rgb: C.green } },
    fill: { patternType: "solid", fgColor: { rgb: C.greenLight } },
    border: borderAll(C.green),
    alignment: { horizontal: "center" },
  },
  revenueHigh: {
    font: { bold: true, sz: 10, color: { rgb: C.green } },
    fill: { patternType: "solid", fgColor: { rgb: C.greenLight } },
    numFmt: KES_FMT,
    alignment: { horizontal: "right" },
    border: borderAll(C.green),
  },
  totalsRow: {
    font: { bold: true, sz: 12, color: { rgb: C.text } },
    fill: { patternType: "solid", fgColor: { rgb: C.goldLight } },
    border: borderAll(C.gold),
  },
  totalsCurrency: {
    font: { bold: true, sz: 14, color: { rgb: C.emeraldDark } },
    fill: { patternType: "solid", fgColor: { rgb: C.goldLight } },
    numFmt: KES_FMT,
    alignment: { horizontal: "right", vertical: "center" },
    border: borderAll(C.gold),
  },
  emptyMsg: {
    font: { italic: true, sz: 11, color: { rgb: C.muted } },
    alignment: { horizontal: "center", vertical: "center" },
  },
  chartTitle: { font: { bold: true, sz: 12, color: { rgb: C.emerald } } },
  note: { font: { sz: 9, color: { rgb: C.muted }, italic: true } },
  navLink: {
    font: { bold: true, sz: 10, color: { rgb: "1D4ED8" }, underline: true },
    alignment: { horizontal: "left" },
  },
  footerText: {
    font: { sz: 9, color: { rgb: C.muted }, italic: true },
    alignment: { horizontal: "center" },
  },
};

function borderAll(rgb: string) {
  const edge = { style: "thin", color: { rgb } };
  return { top: edge, bottom: edge, left: edge, right: edge };
}

function colLetter(c: number): string {
  let n = c + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cellRef(r: number, c: number) {
  return `${colLetter(c)}${r + 1}`;
}

function mergeCells(ws: WorkSheet, r0: number, c0: number, r1: number, c1: number) {
  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({ s: { r: r0, c: c0 }, e: { r: r1, c: c1 } });
}

function mergeRow(ws: WorkSheet, r: number, c0: number, c1: number) {
  mergeCells(ws, r, c0, r, c1);
}

function setCell(ws: WorkSheet, r: number, c: number, value: string | number, style?: object) {
  const ref = cellRef(r, c);
  const cell: Record<string, unknown> = { v: value, t: typeof value === "number" ? "n" : "s" };
  if (style) cell.s = style;
  ws[ref] = cell;
}

function setFormulaCell(ws: WorkSheet, r: number, c: number, formula: string, style?: object) {
  const ref = cellRef(r, c);
  const cell: Record<string, unknown> = { f: formula, t: "n" };
  if (style) cell.s = style;
  ws[ref] = cell;
}

function setHyperlink(ws: WorkSheet, r: number, c: number, text: string, sheetName: string, style?: object) {
  const ref = cellRef(r, c);
  const cell: Record<string, unknown> = {
    v: text,
    t: "s",
    l: { Target: `#'${sheetName}'!A1`, Tooltip: `Open ${sheetName}` },
  };
  if (style) cell.s = style;
  ws[ref] = cell;
}

function freezeRows(ws: WorkSheet, rowCount: number) {
  ws["!freeze"] = {
    xSplit: 0,
    ySplit: rowCount,
    topLeftCell: cellRef(rowCount, 0),
    activePane: "bottomLeft",
    state: "frozen",
  };
}

function applyExecutivePageSetup(ws: WorkSheet, headerExcelRow = 1) {
  ws["!margins"] = { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.4 };
  ws["!pageSetup"] = {
    orientation: "landscape",
    paperSize: 9,
    fitToWidth: 1,
    fitToHeight: 0,
    scale: 100,
  };
  ws["!print"] = { titles: `$${headerExcelRow}:$${headerExcelRow}` };
  ws["!headerFooter"] = {
    oddFooter: "&C RAGEN RESORT POS &R Generated automatically",
    evenFooter: "&C RAGEN RESORT POS &R Generated automatically",
  };
}

function sheetAmountFormula(rowStart: number, rowEnd: number, col: number) {
  if (rowEnd < rowStart) return "0";
  const colRef = colLetter(col);
  return `SUM(${SHEET_DETAILS}!${colRef}${rowStart}:${colRef}${rowEnd})`;
}

type DetailsBuildResult = {
  ws: WorkSheet;
  headerRow: number;
  firstDataExcelRow: number;
  lastDataExcelRow: number;
  totalExcelRow?: number;
  colCount: number;
};

function buildDetailsSheet(
  XLSX: { utils: { aoa_to_sheet: (data: (string | number)[][]) => WorkSheet } },
  table: DetailTableConfig
): DetailsBuildResult {
  const {
    headers,
    rows,
    totalsRow,
    currencyColumnIndexes = [],
    sumColumnIndexes,
    emptyMessage,
    useFormulaTotals = true,
    conditionalMode = "none",
    stockColumnIndex,
    alertColumnIndex,
    revenueColumnIndexes = [],
  } = table;

  const sumCols = sumColumnIndexes ?? currencyColumnIndexes;
  const headerRow = 0;
  const aoa: (string | number)[][] = [headers];
  const hasData = rows.length > 0;

  if (!hasData && emptyMessage) {
    aoa.push([emptyMessage]);
  } else {
    for (const row of rows) aoa.push(row.map((c) => (c == null ? "" : c)) as (string | number)[]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const colCount = headers.length;

  for (let c = 0; c < colCount; c++) {
    setCell(ws, headerRow, c, headers[c], styles.tableHeader);
  }

  const firstDataExcelRow = headerRow + 2;
  const lastDataExcelRow = hasData ? headerRow + rows.length : headerRow + 1;
  const revenueHighThreshold =
    conditionalMode === "revenue-highlight" && hasData
      ? Math.max(
          ...revenueColumnIndexes.flatMap((ci) =>
            rows.map((r) => (typeof r[ci] === "number" ? (r[ci] as number) : 0))
          ),
          0
        ) * 0.65
      : 0;

  const dataRowCount = hasData ? rows.length : emptyMessage ? 1 : 0;
  for (let ri = 0; ri < dataRowCount; ri++) {
    const sheetR = headerRow + 1 + ri;
    const isAlt = ri % 2 === 1;
    const isEmpty = !hasData;
    const sourceRow = rows[ri];

    for (let c = 0; c < colCount; c++) {
      const val = aoa[sheetR]?.[c] ?? "";
      const isCurrency = currencyColumnIndexes.includes(c) && typeof val === "number";
      let style: object = isAlt ? styles.tableCellAlt : styles.tableCell;

      if (!isEmpty && conditionalMode === "inventory-stock" && stockColumnIndex != null && alertColumnIndex != null) {
        const stock = sourceRow?.[stockColumnIndex];
        const alert = sourceRow?.[alertColumnIndex];
        if (c === stockColumnIndex && typeof stock === "number" && typeof alert === "number") {
          style = stock <= alert ? styles.stockLow : styles.stockHealthy;
        }
      }

      if (
        !isEmpty &&
        conditionalMode === "revenue-highlight" &&
        revenueColumnIndexes.includes(c) &&
        typeof val === "number" &&
        val >= revenueHighThreshold &&
        revenueHighThreshold > 0
      ) {
        style = styles.revenueHigh;
      } else if (isCurrency) {
        style = { ...style, ...styles.tableCellCurrency };
      }

      if (isEmpty) style = styles.emptyMsg;
      setCell(ws, sheetR, c, val as string | number, style);
      if (isEmpty && c === 0) mergeRow(ws, sheetR, 0, colCount - 1);
    }
  }

  let totalExcelRow: number | undefined;
  if (totalsRow && hasData) {
    const tr = headerRow + 1 + rows.length;
    totalExcelRow = tr + 1;
    for (let c = 0; c < colCount; c++) {
      const label = totalsRow[c];
      const useFormula =
        useFormulaTotals && sumCols.includes(c) && lastDataExcelRow >= firstDataExcelRow;
      if (useFormula) {
        const formula = sheetAmountFormula(firstDataExcelRow, lastDataExcelRow, c);
        const isLabelCol =
          c === 0 ||
          (typeof label === "string" && label.length > 0 && typeof totalsRow[c] !== "number");
        if (isLabelCol) {
          setCell(ws, tr, c, typeof label === "string" && label ? label : "TOTAL", styles.totalsRow);
        } else {
          setFormulaCell(ws, tr, c, formula, styles.totalsCurrency);
        }
      } else {
        const val = label ?? "";
        const isCurrency = currencyColumnIndexes.includes(c) && typeof val === "number";
        if (typeof val === "number" && isCurrency) {
          setCell(ws, tr, c, val, styles.totalsCurrency);
        } else {
          setCell(ws, tr, c, val as string | number, styles.totalsRow);
        }
      }
    }
  }

  ws["!cols"] = headers.map((h) => ({ wch: Math.min(40, Math.max(12, h.length + 4)) }));
  const lastRow = totalExcelRow ?? lastDataExcelRow;
  ws["!ref"] = `A1:${colLetter(colCount - 1)}${lastRow}`;

  if (hasData) {
    ws["!autofilter"] = { ref: `A${headerRow + 1}:${colLetter(colCount - 1)}${lastDataExcelRow}` };
    freezeRows(ws, 1);
    applyExecutivePageSetup(ws, headerRow + 1);
  } else {
    applyExecutivePageSetup(ws, 1);
  }

  setHyperlink(ws, lastRow, 0, `← Back to ${SHEET_SUMMARY}`, SHEET_SUMMARY, styles.navLink);

  return { ws, headerRow, firstDataExcelRow, lastDataExcelRow, totalExcelRow, colCount };
}

function addKpiCards(ws: WorkSheet, startRow: number, kpis: KpiEntry[]): number {
  let r = startRow;
  mergeRow(ws, r, 0, COL_COUNT - 1);
  setCell(ws, r, 0, "Key Performance Indicators", styles.sectionHeader);
  r++;

  const cardsPerRow = 3;
  const cardWidth = 2;
  for (let i = 0; i < kpis.length; i += cardsPerRow) {
    const rowKpis = kpis.slice(i, i + cardsPerRow);
    for (let j = 0; j < rowKpis.length; j++) {
      const k = rowKpis[j];
      const c0 = j * cardWidth;
      const c1 = Math.min(c0 + cardWidth - 1, COL_COUNT - 1);
      mergeCells(ws, r, c0, r, c1);
      setCell(ws, r, c0, k.label, styles.kpiCardLabel);
      mergeCells(ws, r + 1, c0, r + 1, c1);
      if (k.formula) {
        setFormulaCell(ws, r + 1, c0, k.formula, styles.kpiCardValueFormula);
      } else if (typeof k.value === "number" && k.isCurrency) {
        setCell(ws, r + 1, c0, k.value, styles.kpiCardValueCurrency);
      } else {
        setCell(ws, r + 1, c0, k.value, styles.kpiCardValue);
      }
    }
    r += 2;
  }
  return r;
}

function buildSummarySheet(
  input: WorkbookInput,
  details: DetailsBuildResult,
  hasChartSheet: boolean
): SummaryBuildResult {
  const { meta, kpis, paymentBreakdown, notes } = input;
  const ws: WorkSheet = {};
  let r = 0;

  mergeCells(ws, r, 0, r, COL_COUNT - 1);
  setCell(ws, r, 0, "◆  RAGEN RESORT POS  ◆", styles.logoMain);
  r++;
  mergeCells(ws, r, 0, r, COL_COUNT - 1);
  setCell(ws, r, 0, "Executive Business Report", styles.logoSub);
  r++;
  mergeCells(ws, r, 0, r, COL_COUNT - 1);
  setCell(ws, r, 0, meta.settings.businessName, styles.logoBusiness);
  r += 2;

  mergeRow(ws, r, 0, COL_COUNT - 1);
  setCell(ws, r, 0, meta.reportTitle, styles.reportTitle);
  r += 2;

  const metaRows: [string, string][] = [
    ["Date range", meta.dateRangeLabel],
    ["Generated at", formatDate(meta.generatedAt)],
    ["Generated by", meta.generatedBy],
  ];
  if (meta.settings.businessAddress) metaRows.unshift(["Address", meta.settings.businessAddress]);
  if (meta.settings.phone || meta.settings.email) {
    metaRows.unshift([
      "Contact",
      [meta.settings.phone, meta.settings.email].filter(Boolean).join(" • "),
    ]);
  }
  metaRows.unshift(["Business", meta.settings.businessName]);

  for (const [label, val] of metaRows) {
    setCell(ws, r, 0, label, styles.metaLabel);
    setCell(ws, r, 1, val, styles.metaValue);
    mergeCells(ws, r, 1, r, COL_COUNT - 1);
    r++;
  }
  r++;

  const kpisWithFormulas = kpis.map((k) => {
    if (k.isCurrency && details.lastDataExcelRow >= details.firstDataExcelRow) {
      const amountCol = input.details.currencyColumnIndexes?.[0];
      if (amountCol != null && k.label.toLowerCase().includes("revenue")) {
        return {
          ...k,
          formula: sheetAmountFormula(details.firstDataExcelRow, details.lastDataExcelRow, amountCol),
        };
      }
    }
    return k;
  });

  r = addKpiCards(ws, r, kpisWithFormulas);

  if (paymentBreakdown) {
    r++;
    mergeRow(ws, r, 0, COL_COUNT - 1);
    setCell(ws, r, 0, "Payment Method Breakdown", styles.sectionHeader);
    r++;

    const payLabels = [
      getPaymentMethodLabel("CASH"),
      getPaymentMethodLabel("MPESA"),
      getPaymentMethodLabel("CARD"),
      getPaymentMethodLabel("BANK"),
    ];
    const payAmounts = [
      paymentBreakdown.cash,
      paymentBreakdown.mpesa,
      paymentBreakdown.card,
      paymentBreakdown.bank,
    ];

    for (let i = 0; i < payLabels.length; i++) {
      setCell(ws, r, 0, payLabels[i], styles.paymentHeader);
      if (
        paymentBreakdown.useDetailsFormulas &&
        details.lastDataExcelRow >= details.firstDataExcelRow
      ) {
        setFormulaCell(
          ws,
          r,
          1,
          `'${SHEET_DETAILS}'!${cellRef(details.firstDataExcelRow - 1 + i, 1)}`,
          styles.paymentValue
        );
      } else {
        setCell(ws, r, 1, payAmounts[i], styles.paymentValue);
      }
      r++;
    }

    if (paymentBreakdown.grandTotal != null) {
      setCell(ws, r, 0, "Grand Total", styles.paymentHeader);
      if (paymentBreakdown.useDetailsFormulas && details.totalExcelRow) {
        setFormulaCell(
          ws,
          r,
          1,
          `'${SHEET_DETAILS}'!${cellRef(details.totalExcelRow - 1, 1)}`,
          styles.paymentGrand
        );
      } else {
        setCell(ws, r, 1, paymentBreakdown.grandTotal, styles.paymentGrand);
      }
      r++;
    }
  }

  const chartImageAnchorRows: number[] = [];
  if (input.chartImages?.length) {
    r++;
    mergeRow(ws, r, 0, COL_COUNT - 1);
    setCell(ws, r, 0, "Visual Analytics", styles.sectionHeader);
    r++;
    for (const ch of input.chartImages) {
      mergeRow(ws, r, 0, COL_COUNT - 1);
      setCell(ws, r, 0, ch.title, styles.chartTitle);
      chartImageAnchorRows.push(r + 1);
      r += 1 + CHART_ROW_SPAN;
    }
  }

  if (notes?.length) {
    r++;
    mergeRow(ws, r, 0, COL_COUNT - 1);
    setCell(ws, r, 0, "Notes", styles.sectionHeader);
    r++;
    for (const n of notes) {
      setCell(ws, r, 0, n, styles.note);
      mergeRow(ws, r, 0, COL_COUNT - 1);
      r++;
    }
  }

  r++;
  mergeRow(ws, r, 0, COL_COUNT - 1);
  setCell(ws, r, 0, "Report Navigation", styles.sectionHeader);
  r++;
  setHyperlink(ws, r, 0, `→ View ${SHEET_DETAILS}`, SHEET_DETAILS, styles.navLink);
  if (hasChartSheet) {
    setHyperlink(ws, r, 2, `→ View ${SHEET_CHART}`, SHEET_CHART, styles.navLink);
  }
  r += 2;

  setCell(ws, r, 0, "RAGEN RESORT POS — Generated automatically", styles.footerText);
  mergeRow(ws, r, 0, COL_COUNT - 1);
  r++;
  setCell(
    ws,
    r,
    0,
    input.chartImages?.length
      ? "Charts above are embedded images. Chart Data sheet has source figures."
      : "Visual charts: use Chart Data sheet or the in-app report preview.",
    styles.note
  );
  mergeRow(ws, r, 0, COL_COUNT - 1);

  ws["!ref"] = `A1:F${r + 1}`;
  ws["!cols"] = [{ wch: 20 }, { wch: 26 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  freezeRows(ws, 4);
  applyExecutivePageSetup(ws, 1);
  return { ws, chartImageAnchorRows };
}

function buildChartDataSheet(
  XLSX: { utils: { aoa_to_sheet: (data: (string | number)[][]) => WorkSheet } },
  series: ChartSeries[]
): WorkSheet {
  const aoa: (string | number)[][] = [
    ["Chart Data — build charts from the ranges below"],
    ["Full-color charts are available in the RAGEN RESORT POS report preview."],
    [],
  ];
  for (const s of series) {
    aoa.push([s.title]);
    aoa.push(s.headers);
    for (const row of s.rows) aoa.push(row);
    aoa.push([]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  let r = 0;
  for (const row of aoa) {
    if (row.length === 1 && typeof row[0] === "string" && row[0] !== "" && !row[0].includes("—")) {
      setCell(ws, r, 0, row[0], styles.chartTitle);
    }
    r++;
  }

  setHyperlink(ws, r, 0, `← Back to ${SHEET_SUMMARY}`, SHEET_SUMMARY, styles.navLink);
  setHyperlink(ws, r, 2, `→ View ${SHEET_DETAILS}`, SHEET_DETAILS, styles.navLink);

  ws["!cols"] = [{ wch: 32 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
  applyExecutivePageSetup(ws, 1);
  return ws;
}

type XlsxStyleModule = {
  utils: {
    book_new: () => unknown;
    book_append_sheet: (wb: unknown, ws: WorkSheet, name: string) => void;
    aoa_to_sheet: (data: (string | number)[][]) => WorkSheet;
  };
  write: (wb: unknown, opts: { bookType: string; type: string }) => ArrayBuffer;
  writeFile: (wb: unknown, filename: string) => void;
};

function downloadExcelBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function embedChartImagesAndDownload(
  xlsxBuffer: ArrayBuffer,
  filename: string,
  chartImages: ReportChartImage[],
  anchorRows: number[]
) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(xlsxBuffer);

  const summary = workbook.getWorksheet(SHEET_SUMMARY);
  if (summary) {
    for (let i = 0; i < chartImages.length; i++) {
      const img = chartImages[i];
      if (!img.base64) continue;
      const anchorRow = anchorRows[i] ?? 12 + i * CHART_ROW_SPAN;
      const imageId = workbook.addImage({
        base64: img.base64,
        extension: "png",
      });
      summary.addImage(imageId, {
        tl: { col: 0.15, row: anchorRow },
        ext: { width: 540, height: 248 },
      });
      for (let offset = 0; offset < CHART_ROW_SPAN; offset++) {
        const row = summary.getRow(anchorRow + offset + 1);
        row.height = 18;
      }
    }
  }

  const out = await workbook.xlsx.writeBuffer();
  downloadExcelBuffer(out as ArrayBuffer, filename);
}

async function writeWorkbook(input: WorkbookInput): Promise<void> {
  const XLSX = (await import("xlsx-js-style")) as XlsxStyleModule;
  const wb = XLSX.utils.book_new();
  const hasChartSheet = Boolean(input.chartSeries?.length);

  const detailsResult = buildDetailsSheet(XLSX, input.details);
  const summaryResult = buildSummarySheet(input, detailsResult, hasChartSheet);
  const chartWs = hasChartSheet ? buildChartDataSheet(XLSX, input.chartSeries!) : null;

  XLSX.utils.book_append_sheet(wb, summaryResult.ws, SHEET_SUMMARY);
  XLSX.utils.book_append_sheet(wb, detailsResult.ws, SHEET_DETAILS);
  if (chartWs) XLSX.utils.book_append_sheet(wb, chartWs, SHEET_CHART);

  const chartImages = input.chartImages?.filter((c) => c.base64.length > 0) ?? [];
  if (chartImages.length > 0 && summaryResult.chartImageAnchorRows.length > 0) {
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    await embedChartImagesAndDownload(
      buffer,
      input.meta.filename,
      chartImages,
      summaryResult.chartImageAnchorRows
    );
  } else {
    XLSX.writeFile(wb, input.meta.filename);
  }
}

// ——— Report-specific builders ———

export type ReportExcelData = {
  sales?: {
    orders: { orderNumber: string; createdAt: Date; total: number; status: string; user: { name: string }; payments?: { method: string; amount: number }[] }[];
    revenueByDay: { date: string; revenue: number }[];
    salesByCategory: { name: string; value: number }[];
    topProducts: { name: string; quantity: number; revenue: number }[];
    totalRevenue: number;
    orderCount: number;
  };
  payment?: {
    cash: number;
    mpesa: number;
    card: number;
    bank: number;
    total: number;
    salesTotal: number;
    orderCount: number;
  };
  cashier?: {
    name: string;
    orders: number;
    revenue: number;
    cash: number;
    mpesa: number;
    card: number;
    bank: number;
    cancellations: number;
  }[];
  inventory?: {
    products: { name: string; sku: string; category: string; stock: number; lowStockAlert: number; costValue: number; retailValue: number; isLowStock: boolean }[];
    lowStock: { name: string; stock: number }[];
    stockByCategory: { name: string; costValue: number; retailValue: number }[];
  };
  occupancy?: {
    occupancyRate: number;
    totalRooms: number;
    statusBreakdown: Record<string, number>;
    bookings: { guest: { fullName: string }; room: { number: string }; status: string; checkIn: Date; checkOut: Date }[];
  };
  roomRevenue?: { number: string; type: string; orders: number; revenue: number }[];
  profit?: { revenue: number; cost: number; expenses: number; profit: number; orderCount: number };
  expenses?: { date: Date; category: string; description: string; amount: number; reference: string | null }[];
  productPerformance?: { name: string; sku: string; category: string; quantity: number; revenue: number; cost: number; margin: number }[];
};

function baseMeta(
  reportTitle: string,
  settings: ReportSettingsInfo,
  dateRangeLabel: string,
  generatedAt: Date,
  generatedBy: string,
  slug: string
): ReportExcelMeta {
  return {
    reportTitle,
    settings,
    dateRangeLabel,
    generatedAt,
    generatedBy,
    filename: `${slug}.xlsx`,
  };
}

export async function exportReportExcel(
  reportId: ReportModuleId,
  settings: ReportSettingsInfo,
  dateRangeLabel: string,
  generatedAt: Date,
  generatedBy: string,
  dateSuffix: string,
  data: ReportExcelData
): Promise<number> {
  const slug = `${reportId}-report-${dateSuffix}`;
  const chartImages = await buildReportChartImages(reportId, data);

  switch (reportId) {
    case "sales": {
      const s = data.sales;
      const orders = s?.orders ?? [];
      let cash = 0,
        mpesa = 0,
        card = 0,
        bank = 0;
      for (const o of orders) {
        for (const p of o.payments ?? []) {
          switch (p.method) {
            case "CASH":
              cash += p.amount;
              break;
            case "MPESA":
              mpesa += p.amount;
              break;
            case "CARD":
              card += p.amount;
              break;
            case "BANK":
              bank += p.amount;
              break;
          }
        }
      }
      await writeWorkbook({
        meta: baseMeta("Sales Report", settings, dateRangeLabel, generatedAt, generatedBy, slug),
        chartImages,
        kpis: [
          { label: "Total Revenue", value: s?.totalRevenue ?? 0, isCurrency: true },
          { label: "Completed Orders", value: s?.orderCount ?? 0 },
          { label: "Categories Sold", value: s?.salesByCategory.length ?? 0 },
        ],
        paymentBreakdown: orders.length ? { cash, mpesa, card, bank, grandTotal: cash + mpesa + card + bank } : undefined,
        details: {
          headers: ["Order", "Date", "Cashier", "Status", "Total (KES)", "Payments"],
          rows: orders.map((o) => [
            o.orderNumber,
            formatDate(o.createdAt),
            o.user.name,
            o.status,
            o.total,
            o.payments?.map((p) => `${getPaymentMethodLabel(p.method)} ${p.amount}`).join("; ") ?? "",
          ]),
          totalsRow: orders.length ? ["TOTAL", "", "", "", 0, ""] : undefined,
          currencyColumnIndexes: [4],
          sumColumnIndexes: [4],
          conditionalMode: "revenue-highlight",
          revenueColumnIndexes: [4],
          emptyMessage: "No records found for this date range.",
        },
        chartSeries: [
          { title: "Revenue by Day", headers: ["Date", "Revenue (KES)"], rows: (s?.revenueByDay ?? []).map((d) => [d.date, d.revenue]) },
          { title: "Sales by Category", headers: ["Category", "Revenue (KES)"], rows: (s?.salesByCategory ?? []).map((c) => [c.name, c.value]) },
          { title: "Top Products", headers: ["Product", "Qty", "Revenue (KES)"], rows: (s?.topProducts ?? []).map((p) => [p.name, p.quantity, p.revenue]) },
        ],
      });
      return orders.length;
    }

    case "payment": {
      const p = data.payment;
      await writeWorkbook({
        meta: baseMeta("Payment Method Report", settings, dateRangeLabel, generatedAt, generatedBy, slug),
        chartImages,
        kpis: [
          { label: "Grand Total (Payments)", value: p?.total ?? 0, isCurrency: true },
          { label: "Order Sales Total", value: p?.salesTotal ?? 0, isCurrency: true },
          { label: "Orders", value: p?.orderCount ?? 0 },
        ],
        paymentBreakdown: p
          ? { cash: p.cash, mpesa: p.mpesa, card: p.card, bank: p.bank, grandTotal: p.total, useDetailsFormulas: true }
          : undefined,
        details: {
          headers: ["Payment Method", "Amount (KES)"],
          rows: p
            ? [
                [getPaymentMethodLabel("CASH"), p.cash],
                [getPaymentMethodLabel("MPESA"), p.mpesa],
                [getPaymentMethodLabel("CARD"), p.card],
                [getPaymentMethodLabel("BANK"), p.bank],
              ]
            : [],
          totalsRow: p ? ["Grand Total", 0] : undefined,
          currencyColumnIndexes: [1],
          sumColumnIndexes: [1],
          emptyMessage: "No records found for this date range.",
        },
        chartSeries: p
          ? [{ title: "Payment Methods", headers: ["Method", "Amount (KES)"], rows: [
              ["Cash", p.cash],
              ["M-Pesa", p.mpesa],
              ["Card", p.card],
              ["Bank", p.bank],
            ] }]
          : [],
      });
      return p?.orderCount ?? 0;
    }

    case "cashier": {
      const list = data.cashier ?? [];
      const totalRev = list.reduce((s, c) => s + c.revenue, 0);
      await writeWorkbook({
        meta: baseMeta("Cashier Performance Report", settings, dateRangeLabel, generatedAt, generatedBy, slug),
        chartImages,
        kpis: [
          { label: "Cashiers", value: list.length },
          { label: "Total Revenue", value: totalRev, isCurrency: true },
          { label: "Total Orders", value: list.reduce((s, c) => s + c.orders, 0) },
        ],
        paymentBreakdown: list.length
          ? {
              cash: list.reduce((s, c) => s + c.cash, 0),
              mpesa: list.reduce((s, c) => s + c.mpesa, 0),
              card: list.reduce((s, c) => s + c.card, 0),
              bank: list.reduce((s, c) => s + c.bank, 0),
              grandTotal: totalRev,
            }
          : undefined,
        details: {
          headers: ["Cashier", "Orders", "Revenue", "Cash", "M-Pesa", "Card", "Bank", "Cancelled"],
          rows: list.map((c) => [c.name, c.orders, c.revenue, c.cash, c.mpesa, c.card, c.bank, c.cancellations]),
          totalsRow: list.length ? ["TOTAL", 0, 0, 0, 0, 0, 0, ""] : undefined,
          currencyColumnIndexes: [2, 3, 4, 5, 6],
          sumColumnIndexes: [1, 2, 3, 4, 5, 6],
          conditionalMode: "revenue-highlight",
          revenueColumnIndexes: [2],
          emptyMessage: "No records found for this date range.",
        },
        chartSeries: [{ title: "Sales per Cashier", headers: ["Cashier", "Revenue (KES)", "Orders"], rows: list.map((c) => [c.name, c.revenue, c.orders]) }],
      });
      return list.length;
    }

    case "inventory": {
      const inv = data.inventory;
      const products = inv?.products ?? [];
      const totalRetail = products.reduce((s, p) => s + p.retailValue, 0);
      await writeWorkbook({
        meta: baseMeta("Inventory Report", settings, dateRangeLabel, generatedAt, generatedBy, slug),
        chartImages,
        kpis: [
          { label: "Active SKUs", value: products.length },
          { label: "Low Stock Items", value: inv?.lowStock.length ?? 0 },
          { label: "Total Retail Value", value: totalRetail, isCurrency: true },
        ],
        details: {
          headers: ["Product", "SKU", "Category", "Stock", "Alert", "Cost Value", "Retail Value", "Low Stock"],
          rows: products.map((p) => [p.name, p.sku, p.category, p.stock, p.lowStockAlert, p.costValue, p.retailValue, p.isLowStock ? "Yes" : "No"]),
          totalsRow: products.length ? ["TOTAL", "", "", "", "", 0, 0, ""] : undefined,
          currencyColumnIndexes: [5, 6],
          sumColumnIndexes: [5, 6],
          conditionalMode: "inventory-stock",
          stockColumnIndex: 3,
          alertColumnIndex: 4,
          emptyMessage: "No records found for this date range.",
        },
        chartSeries: [
          { title: "Low Stock", headers: ["Product", "Stock"], rows: (inv?.lowStock ?? []).map((p) => [p.name, p.stock]) },
          { title: "Stock Value by Category", headers: ["Category", "Cost (KES)", "Retail (KES)"], rows: (inv?.stockByCategory ?? []).map((c) => [c.name, c.costValue, c.retailValue]) },
        ],
        notes: ["Snapshot of current active inventory (not filtered by transaction dates)."],
      });
      return products.length;
    }

    case "occupancy": {
      const occ = data.occupancy;
      const bookings = occ?.bookings ?? [];
      const rooms = data.roomRevenue ?? [];
      const roomRevTotal = rooms.reduce((s, r) => s + r.revenue, 0);
      await writeWorkbook({
        meta: baseMeta("Room Occupancy Report", settings, dateRangeLabel, generatedAt, generatedBy, slug),
        chartImages,
        kpis: [
          { label: "Occupancy Rate", value: `${occ?.occupancyRate ?? 0}%` },
          { label: "Total Rooms", value: occ?.totalRooms ?? 0 },
          { label: "Room Sales Revenue", value: roomRevTotal, isCurrency: true },
        ],
        details: {
          headers: ["Section", "Guest / Room", "Detail", "Status", "Check In", "Check Out", "Revenue (KES)"],
          rows: [
            ...rooms.map((r) => ["Room Revenue", `Room ${r.number}`, r.type, "", "", "", r.revenue]),
            ...bookings.map((b) => [
              "Booking",
              b.guest.fullName,
              `Room ${b.room.number}`,
              b.status,
              formatDate(b.checkIn),
              formatDate(b.checkOut),
              "",
            ]),
          ],
          totalsRow: rooms.length ? ["", "", "", "", "", "TOTAL", 0] : undefined,
          currencyColumnIndexes: [6],
          sumColumnIndexes: [6],
          conditionalMode: "revenue-highlight",
          revenueColumnIndexes: [6],
          emptyMessage: "No records found for this date range.",
        },
        chartSeries: occ
          ? [{
              title: "Room Status",
              headers: ["Status", "Count"],
              rows: Object.entries(occ.statusBreakdown).map(([k, v]) => [k, v]),
            }]
          : [],
      });
      return bookings.length + rooms.length;
    }

    case "profit": {
      const p = data.profit;
      await writeWorkbook({
        meta: baseMeta("Profit Report", settings, dateRangeLabel, generatedAt, generatedBy, slug),
        chartImages,
        kpis: [
          { label: "Revenue", value: p?.revenue ?? 0, isCurrency: true },
          { label: "Cost of Goods", value: p?.cost ?? 0, isCurrency: true },
          { label: "Expenses", value: p?.expenses ?? 0, isCurrency: true },
          { label: "Net Profit", value: p?.profit ?? 0, isCurrency: true },
        ],
        details: {
          headers: ["Metric", "Amount (KES)"],
          rows: p
            ? [
                ["Revenue", p.revenue],
                ["Cost of Goods", p.cost],
                ["Operating Expenses", p.expenses],
                ["Net Profit", p.profit],
              ]
            : [],
          currencyColumnIndexes: [1],
          conditionalMode: "revenue-highlight",
          revenueColumnIndexes: [1],
          emptyMessage: "No records found for this date range.",
        },
        chartSeries: p
          ? [{ title: "Revenue vs Expenses", headers: ["Category", "Amount (KES)"], rows: [
              ["Revenue", p.revenue],
              ["COGS", p.cost],
              ["Expenses", p.expenses],
            ] }]
          : [],
      });
      return p?.orderCount ?? 0;
    }

    case "expense": {
      const list = data.expenses ?? [];
      const total = list.reduce((s, e) => s + e.amount, 0);
      await writeWorkbook({
        meta: baseMeta("Expense Report", settings, dateRangeLabel, generatedAt, generatedBy, slug),
        chartImages,
        kpis: [
          { label: "Total Expenses", value: total, isCurrency: true },
          { label: "Line Items", value: list.length },
        ],
        details: {
          headers: ["Date", "Category", "Description", "Amount (KES)", "Reference"],
          rows: list.map((e) => [formatDate(e.date), e.category, e.description, e.amount, e.reference ?? ""]),
          totalsRow: list.length ? ["", "", "TOTAL", 0, ""] : undefined,
          currencyColumnIndexes: [3],
          sumColumnIndexes: [3],
          emptyMessage: "No records found for this date range.",
        },
      });
      return list.length;
    }

    case "product-performance": {
      const list = data.productPerformance ?? [];
      const totalRev = list.reduce((s, p) => s + p.revenue, 0);
      const totalMargin = list.reduce((s, p) => s + p.margin, 0);
      await writeWorkbook({
        meta: baseMeta("Product Performance Report", settings, dateRangeLabel, generatedAt, generatedBy, slug),
        chartImages,
        kpis: [
          { label: "Products Sold", value: list.length },
          { label: "Total Revenue", value: totalRev, isCurrency: true },
          { label: "Total Margin", value: totalMargin, isCurrency: true },
        ],
        details: {
          headers: ["Product", "SKU", "Category", "Qty", "Revenue", "Cost", "Margin"],
          rows: list.map((p) => [p.name, p.sku, p.category, p.quantity, p.revenue, p.cost, p.margin]),
          totalsRow: list.length ? ["", "", "TOTAL", 0, 0, 0, 0] : undefined,
          currencyColumnIndexes: [4, 5, 6],
          sumColumnIndexes: [3, 4, 5, 6],
          conditionalMode: "revenue-highlight",
          revenueColumnIndexes: [4, 6],
          emptyMessage: "No records found for this date range.",
        },
        chartSeries: [{ title: "Top Products by Revenue", headers: ["Product", "Revenue (KES)"], rows: list.slice(0, 15).map((p) => [p.name, p.revenue]) }],
      });
      return list.length;
    }

    default:
      throw new Error(`Excel export not supported for ${reportId}`);
  }
}
