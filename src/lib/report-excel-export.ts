/**
 * Styled Excel report workbooks (Summary + Details + Chart Data).
 * Uses xlsx-js-style (SheetJS fork with cell styles). Charts are not embedded;
 * use Chart Data sheet + in-app report preview for visuals.
 */

import type { ReportModuleId } from "@/components/reports/report-modules";
import type { ReportSettingsInfo } from "@/components/reports/report-viewer";
import { getPaymentMethodLabel } from "@/lib/payments";
import { formatDate } from "@/lib/utils";

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

export type ReportExcelMeta = {
  reportTitle: string;
  settings: ReportSettingsInfo;
  dateRangeLabel: string;
  generatedAt: Date;
  generatedBy: string;
  filename: string;
};

type KpiEntry = { label: string; value: string | number; isCurrency?: boolean };

type DetailTableConfig = {
  headers: string[];
  rows: (string | number | null | undefined)[][];
  totalsRow?: (string | number | null | undefined)[];
  currencyColumnIndexes?: number[];
  emptyMessage?: string;
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
  };
  details: DetailTableConfig;
  chartSeries?: ChartSeries[];
  notes?: string[];
};

const C = {
  emerald: "059669",
  gold: "D4AF37",
  white: "FFFFFF",
  text: "0F172A",
  muted: "64748B",
  rowAlt: "F1F5F9",
  rowGold: "FEF9E7",
  border: "CBD5E1",
};

const KES_FMT = '#,##0" KES"';

type MergeRange = { s: { r: number; c: number }; e: { r: number; c: number } };
type WorkSheet = Record<string, unknown> & {
  "!merges"?: MergeRange[];
  "!cols"?: { wch: number }[];
  "!ref"?: string;
  "!freeze"?: Record<string, string | number>;
};

const styles = {
  brandTitle: {
    font: { bold: true, sz: 16, color: { rgb: C.white } },
    fill: { patternType: "solid", fgColor: { rgb: C.emerald } },
    alignment: { horizontal: "center", vertical: "center" },
  },
  reportTitle: {
    font: { bold: true, sz: 14, color: { rgb: C.text } },
    alignment: { horizontal: "left" },
  },
  metaLabel: {
    font: { bold: true, sz: 10, color: { rgb: C.muted } },
  },
  metaValue: {
    font: { sz: 10, color: { rgb: C.text } },
  },
  sectionHeader: {
    font: { bold: true, sz: 11, color: { rgb: C.white } },
    fill: { patternType: "solid", fgColor: { rgb: C.emerald } },
    alignment: { horizontal: "left" },
  },
  kpiLabel: {
    font: { bold: true, sz: 10, color: { rgb: C.muted } },
    fill: { patternType: "solid", fgColor: { rgb: C.rowAlt } },
  },
  kpiValue: {
    font: { bold: true, sz: 12, color: { rgb: C.text } },
    fill: { patternType: "solid", fgColor: { rgb: C.rowGold } },
  },
  paymentHeader: {
    font: { bold: true, sz: 10, color: { rgb: C.text } },
    fill: { patternType: "solid", fgColor: { rgb: C.gold } },
  },
  paymentValue: {
    font: { sz: 10, color: { rgb: C.text } },
    numFmt: KES_FMT,
    alignment: { horizontal: "right" },
  },
  tableHeader: {
    font: { bold: true, sz: 10, color: { rgb: C.white } },
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
    alignment: { horizontal: "right" },
    border: borderAll(C.border),
  },
  totalsRow: {
    font: { bold: true, sz: 10, color: { rgb: C.text } },
    fill: { patternType: "solid", fgColor: { rgb: C.rowGold } },
    border: borderAll(C.gold),
  },
  totalsCurrency: {
    font: { bold: true, sz: 10, color: { rgb: C.text } },
    fill: { patternType: "solid", fgColor: { rgb: C.rowGold } },
    numFmt: KES_FMT,
    alignment: { horizontal: "right" },
    border: borderAll(C.gold),
  },
  emptyMsg: {
    font: { italic: true, sz: 11, color: { rgb: C.muted } },
    alignment: { horizontal: "center" },
  },
  chartTitle: {
    font: { bold: true, sz: 11, color: { rgb: C.emerald } },
  },
  note: {
    font: { sz: 9, color: { rgb: C.muted }, italic: true },
  },
};

function borderAll(rgb: string) {
  const edge = { style: "thin", color: { rgb } };
  return { top: edge, bottom: edge, left: edge, right: edge };
}

function cellRef(r: number, c: number) {
  const col = String.fromCharCode(65 + (c % 26));
  return `${col}${r + 1}`;
}

function setCell(ws: WorkSheet, r: number, c: number, value: string | number, style?: object) {
  const ref = cellRef(r, c);
  const cell: Record<string, unknown> = { v: value, t: typeof value === "number" ? "n" : "s" };
  if (style) cell.s = style;
  ws[ref] = cell;
}

function mergeRow(ws: WorkSheet, r: number, c0: number, c1: number) {
  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({ s: { r, c: c0 }, e: { r, c: c1 } });
}

function freezeHeader(ws: WorkSheet, rowIndex: number) {
  ws["!freeze"] = {
    xSplit: 0,
    ySplit: rowIndex,
    topLeftCell: cellRef(rowIndex, 0),
    activePane: "bottomLeft",
    state: "frozen",
  };
}

function buildSummarySheet(input: WorkbookInput): WorkSheet {
  const { meta, kpis, paymentBreakdown, notes } = input;
  const cols = 6;
  const ws: WorkSheet = {};
  let r = 0;

  const addMerged = (text: string, style: object) => {
    setCell(ws, r, 0, text, style);
    mergeRow(ws, r, 0, cols - 1);
    r++;
  };

  addMerged("RAGEN RESORT POS", styles.brandTitle);
  addMerged(meta.reportTitle, { ...styles.reportTitle, alignment: { horizontal: "center" } });
  r++;

  const metaRows: [string, string][] = [
    ["Business", meta.settings.businessName],
    ...(meta.settings.businessAddress ? [["Address", meta.settings.businessAddress] as [string, string]] : []),
    ...((meta.settings.phone || meta.settings.email)
      ? [["Contact", [meta.settings.phone, meta.settings.email].filter(Boolean).join(" • ")] as [string, string]]
      : []),
    ["Date range", meta.dateRangeLabel],
    ["Generated at", formatDate(meta.generatedAt)],
    ["Generated by", meta.generatedBy],
  ];
  for (const [label, val] of metaRows) {
    setCell(ws, r, 0, label, styles.metaLabel);
    setCell(ws, r, 1, val, styles.metaValue);
    r++;
  }
  r++;

  addMerged("KPI Summary", styles.sectionHeader);
  for (const k of kpis) {
    setCell(ws, r, 0, k.label, styles.kpiLabel);
    if (typeof k.value === "number" && k.isCurrency) {
      setCell(ws, r, 1, k.value, styles.paymentValue);
    } else {
      setCell(ws, r, 1, k.value, styles.kpiValue);
    }
    r++;
  }

  if (paymentBreakdown) {
    r++;
    addMerged("Payment Method Breakdown", styles.sectionHeader);
    const payRows: [string, number][] = [
      [getPaymentMethodLabel("CASH"), paymentBreakdown.cash],
      [getPaymentMethodLabel("MPESA"), paymentBreakdown.mpesa],
      [getPaymentMethodLabel("CARD"), paymentBreakdown.card],
      [getPaymentMethodLabel("BANK"), paymentBreakdown.bank],
    ];
    if (paymentBreakdown.grandTotal != null) {
      payRows.push(["Grand Total", paymentBreakdown.grandTotal]);
    }
    for (const [label, val] of payRows) {
      setCell(ws, r, 0, label, styles.paymentHeader);
      setCell(ws, r, 1, val, styles.paymentValue);
      r++;
    }
  }

  if (notes?.length) {
    r++;
    addMerged("Notes", styles.sectionHeader);
    for (const n of notes) {
      setCell(ws, r, 0, n, styles.note);
      mergeRow(ws, r, 0, cols - 1);
      r++;
    }
  }

  r++;
  setCell(
    ws,
    r,
    0,
    "Charts: use the Chart Data sheet. Visual charts are in the RAGEN RESORT POS report preview.",
    styles.note
  );
  mergeRow(ws, r, 0, cols - 1);

  ws["!ref"] = `A1:F${r + 1}`;
  ws["!cols"] = [{ wch: 22 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  return ws;
}

function buildDetailsSheet(
  XLSX: { utils: { aoa_to_sheet: (data: (string | number)[][]) => WorkSheet } },
  table: DetailTableConfig
): WorkSheet {
  const { headers, rows, totalsRow, currencyColumnIndexes = [], emptyMessage } = table;
  const aoa: (string | number)[][] = [headers];
  if (rows.length === 0 && emptyMessage) {
    aoa.push([emptyMessage]);
  } else {
    for (const row of rows) aoa.push(row.map((c) => (c == null ? "" : c)) as (string | number)[]);
    if (totalsRow) aoa.push(totalsRow.map((c) => (c == null ? "" : c)) as (string | number)[]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const headerRow = 0;
  for (let c = 0; c < headers.length; c++) {
    setCell(ws, headerRow, c, headers[c], styles.tableHeader);
  }

  const dataStart = 1;
  const dataRows = rows.length === 0 && emptyMessage ? 1 : rows.length;
  for (let ri = 0; ri < dataRows; ri++) {
    const sheetR = dataStart + ri;
    const isAlt = ri % 2 === 1;
    const isEmpty = rows.length === 0;
    for (let c = 0; c < headers.length; c++) {
      const val = aoa[sheetR]?.[c] ?? "";
      const isCurrency = currencyColumnIndexes.includes(c) && typeof val === "number";
      let style: object = isAlt ? styles.tableCellAlt : styles.tableCell;
      if (isCurrency) style = { ...style, ...styles.tableCellCurrency };
      if (isEmpty) style = styles.emptyMsg;
      setCell(ws, sheetR, c, val as string | number, style);
      if (isEmpty && c === 0) mergeRow(ws, sheetR, 0, headers.length - 1);
    }
  }

  if (totalsRow && rows.length > 0) {
    const tr = dataStart + rows.length;
    for (let c = 0; c < headers.length; c++) {
      const val = totalsRow[c] ?? "";
      const isCurrency = currencyColumnIndexes.includes(c) && typeof val === "number";
      setCell(ws, tr, c, val as string | number, isCurrency ? styles.totalsCurrency : styles.totalsRow);
    }
  }

  ws["!cols"] = headers.map((h) => ({ wch: Math.min(36, Math.max(12, h.length + 4)) }));
  if (rows.length > 0) freezeHeader(ws, 1);
  return ws;
}

function buildChartDataSheet(
  XLSX: { utils: { aoa_to_sheet: (data: (string | number)[][]) => WorkSheet } },
  series: ChartSeries[]
): WorkSheet {
  const aoa: (string | number)[][] = [
    ["Chart Data — insert Excel charts from these ranges"],
    ["Visual charts are available in the RAGEN RESORT POS report preview."],
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
  ws["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
  return ws;
}

type XlsxStyleModule = {
  utils: {
    book_new: () => unknown;
    book_append_sheet: (wb: unknown, ws: WorkSheet, name: string) => void;
    aoa_to_sheet: (data: (string | number)[][]) => WorkSheet;
  };
  writeFile: (wb: unknown, filename: string) => void;
};

async function writeWorkbook(input: WorkbookInput): Promise<void> {
  const XLSX = (await import("xlsx-js-style")) as XlsxStyleModule;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(input), "Summary");
  XLSX.utils.book_append_sheet(wb, buildDetailsSheet(XLSX, input.details), "Details");
  if (input.chartSeries?.length) {
    XLSX.utils.book_append_sheet(wb, buildChartDataSheet(XLSX, input.chartSeries), "Chart Data");
  }
  XLSX.writeFile(wb, input.meta.filename);
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
      const totalOrders = orders.reduce((sum, o) => sum + o.total, 0);
      await writeWorkbook({
        meta: baseMeta("Sales Report", settings, dateRangeLabel, generatedAt, generatedBy, slug),
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
          totalsRow: orders.length ? ["", "", "", "TOTAL", totalOrders, ""] : undefined,
          currencyColumnIndexes: [4],
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
        kpis: [
          { label: "Grand Total (Payments)", value: p?.total ?? 0, isCurrency: true },
          { label: "Order Sales Total", value: p?.salesTotal ?? 0, isCurrency: true },
          { label: "Orders", value: p?.orderCount ?? 0 },
        ],
        paymentBreakdown: p
          ? { cash: p.cash, mpesa: p.mpesa, card: p.card, bank: p.bank, grandTotal: p.total }
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
          totalsRow: p ? ["Grand Total", p.total] : undefined,
          currencyColumnIndexes: [1],
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
          totalsRow: list.length
            ? ["TOTAL", list.reduce((s, c) => s + c.orders, 0), totalRev, list.reduce((s, c) => s + c.cash, 0), list.reduce((s, c) => s + c.mpesa, 0), list.reduce((s, c) => s + c.card, 0), list.reduce((s, c) => s + c.bank, 0), ""]
            : undefined,
          currencyColumnIndexes: [2, 3, 4, 5, 6],
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
        kpis: [
          { label: "Active SKUs", value: products.length },
          { label: "Low Stock Items", value: inv?.lowStock.length ?? 0 },
          { label: "Total Retail Value", value: totalRetail, isCurrency: true },
        ],
        details: {
          headers: ["Product", "SKU", "Category", "Stock", "Alert", "Cost Value", "Retail Value", "Low Stock"],
          rows: products.map((p) => [p.name, p.sku, p.category, p.stock, p.lowStockAlert, p.costValue, p.retailValue, p.isLowStock ? "Yes" : "No"]),
          totalsRow: products.length ? ["", "", "TOTAL", "", "", products.reduce((s, p) => s + p.costValue, 0), totalRetail, ""] : undefined,
          currencyColumnIndexes: [5, 6],
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
          totalsRow: rooms.length ? ["", "", "", "", "", "TOTAL", roomRevTotal] : undefined,
          currencyColumnIndexes: [6],
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
          totalsRow: undefined,
          currencyColumnIndexes: [1],
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
        kpis: [
          { label: "Total Expenses", value: total, isCurrency: true },
          { label: "Line Items", value: list.length },
        ],
        details: {
          headers: ["Date", "Category", "Description", "Amount (KES)", "Reference"],
          rows: list.map((e) => [formatDate(e.date), e.category, e.description, e.amount, e.reference ?? ""]),
          totalsRow: list.length ? ["", "", "TOTAL", total, ""] : undefined,
          currencyColumnIndexes: [3],
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
        kpis: [
          { label: "Products Sold", value: list.length },
          { label: "Total Revenue", value: totalRev, isCurrency: true },
          { label: "Total Margin", value: totalMargin, isCurrency: true },
        ],
        details: {
          headers: ["Product", "SKU", "Category", "Qty", "Revenue", "Cost", "Margin"],
          rows: list.map((p) => [p.name, p.sku, p.category, p.quantity, p.revenue, p.cost, p.margin]),
          totalsRow: list.length ? ["", "", "TOTAL", list.reduce((s, p) => s + p.quantity, 0), totalRev, list.reduce((s, p) => s + p.cost, 0), totalMargin] : undefined,
          currencyColumnIndexes: [4, 5, 6],
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
