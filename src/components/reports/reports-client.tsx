"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ReportViewer,
  ReportSection,
  ReportTable,
  printReport,
  type ReportSettingsInfo,
  type ReportKpi,
} from "@/components/reports/report-viewer";
import {
  ReportLineChart,
  ReportBarChart,
  ReportPieChart,
  ReportGroupedBarChart,
} from "@/components/reports/report-charts";
import { REPORT_MODULES, getDateRangeLabel, type ReportModuleId } from "@/components/reports/report-modules";
import {
  getSalesReportAnalytics,
  getPaymentSummary,
  getCashierPerformance,
  getInventoryAnalytics,
  getStockMovementReport,
  getOccupancyReport,
  getRoomRevenueTable,
  getProfitReport,
  getExpensesForReport,
  getProductPerformanceReport,
} from "@/lib/actions/reports";
import { logReportExported } from "@/lib/actions/admin";
import { getPaymentMethodLabel } from "@/lib/payments";
import { formatCurrency, formatDate, formatDateOnly } from "@/lib/utils";
import { buildCsv, downloadCsvFile, reportDateSuffix } from "@/lib/report-export";
import { exportReportExcel, EXCEL_REPORT_IDS, type ReportExcelData } from "@/lib/report-excel-export";
import { useToast } from "@/hooks/use-toast";
import {
  Download,
  FileSpreadsheet,
  Printer,
  Loader2,
  FileBarChart,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NO_DATA_ROW = ["No records found for this period"];

type ReportsClientProps = {
  settings: ReportSettingsInfo;
};

type LoadedReports = Partial<{
  sales: Awaited<ReturnType<typeof getSalesReportAnalytics>>;
  payment: Awaited<ReturnType<typeof getPaymentSummary>>;
  cashier: Awaited<ReturnType<typeof getCashierPerformance>>;
  inventory: Awaited<ReturnType<typeof getInventoryAnalytics>>;
  stockMovement: Awaited<ReturnType<typeof getStockMovementReport>>;
  occupancy: Awaited<ReturnType<typeof getOccupancyReport>>;
  roomRevenue: Awaited<ReturnType<typeof getRoomRevenueTable>>;
  profit: Awaited<ReturnType<typeof getProfitReport>>;
  expenses: Awaited<ReturnType<typeof getExpensesForReport>>;
  productPerformance: Awaited<ReturnType<typeof getProductPerformanceReport>>;
}>;

export function ReportsClient({ settings }: ReportsClientProps) {
  const { data: session } = useSession();
  const [filter, setFilter] = useState("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [activeReport, setActiveReport] = useState<ReportModuleId | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [data, setData] = useState<LoadedReports>({});
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const dateSuffix = reportDateSuffix(filter, customStart, customEnd);
  const dateRangeLabel = getDateRangeLabel(filter, customStart, customEnd);
  const generatedBy = session?.user?.name ?? "Administrator";

  const resolveDates = useCallback(() => {
    if (filter === "custom") {
      if (!customStart || !customEnd) {
        toast({
          title: "Select date range",
          description: "Choose both start and end dates for a custom report.",
          variant: "destructive",
        });
        return null;
      }
      if (customStart > customEnd) {
        toast({
          title: "Invalid range",
          description: "Start date must be before end date.",
          variant: "destructive",
        });
        return null;
      }
      return { start: new Date(customStart), end: new Date(customEnd) };
    }
    return { start: undefined, end: undefined };
  }, [filter, customStart, customEnd, toast]);

  const generateReport = async (moduleId: ReportModuleId) => {
    const dates = resolveDates();
    if (filter === "custom" && !dates) return;

    setActiveReport(moduleId);
    setLoading(true);
    const start = dates?.start;
    const end = dates?.end;

    try {
      const next: LoadedReports = { ...data };
      switch (moduleId) {
        case "sales":
          next.sales = await getSalesReportAnalytics(filter, start, end);
          break;
        case "payment":
          next.payment = await getPaymentSummary(filter, start, end);
          break;
        case "cashier":
          next.cashier = await getCashierPerformance(filter, start, end);
          break;
        case "inventory":
          next.inventory = await getInventoryAnalytics();
          break;
        case "stock-movement":
          next.stockMovement = await getStockMovementReport(filter, start, end);
          break;
        case "occupancy": {
          const [occ, rooms] = await Promise.all([
            getOccupancyReport(filter, start, end),
            getRoomRevenueTable(filter, start, end),
          ]);
          next.occupancy = occ;
          next.roomRevenue = rooms;
          break;
        }
        case "profit":
          next.profit = await getProfitReport(filter, start, end);
          break;
        case "expense":
          next.expenses = await getExpensesForReport(filter, start, end);
          break;
        case "product-performance":
          next.productPerformance = await getProductPerformanceReport(filter, start, end);
          break;
      }
      setData(next);
      setGeneratedAt(new Date());
    } catch (error) {
      console.error("[Reports]", error);
      toast({
        title: "Report failed",
        description: "Could not load report data. Try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmEmptyExport = (rowCount: number): boolean => {
    if (rowCount > 0) return true;
    return window.confirm(
      "No records found for this date range. Export anyway with a placeholder row?"
    );
  };

  const finishExport = async (type: string, rowCount: number, filename: string, csv: string) => {
    if (!confirmEmptyExport(rowCount)) return;
    downloadCsvFile(filename, csv);
    await logReportExported(type, filter, rowCount);
    toast({ title: "Export complete", description: filename });
  };

  const exportSalesCSV = async () => {
    const sales = data.sales;
    if (!sales) return;
    setExporting(true);
    try {
      const rows =
        sales.orders.length > 0
          ? sales.orders.map((o) => [
              o.orderNumber,
              formatDate(o.createdAt),
              formatCurrency(o.total),
              o.status,
              o.user.name,
              o.payments?.map((p) => `${getPaymentMethodLabel(p.method)} ${p.amount}`).join("; ") ?? "",
            ])
          : [NO_DATA_ROW];
      await finishExport(
        "sales",
        sales.orders.length,
        `sales-report-${dateSuffix}.csv`,
        buildCsv(["Order Number", "Date", "Total (KES)", "Status", "Cashier", "Payments"], rows)
      );
    } finally {
      setExporting(false);
    }
  };

  const exportPaymentCSV = async () => {
    const p = data.payment;
    if (!p) return;
    setExporting(true);
    try {
      const rows: (string | number)[][] = [
        ["Cash", formatCurrency(p.cash)],
        ["M-Pesa", formatCurrency(p.mpesa)],
        ["Card", formatCurrency(p.card)],
        ["Bank", formatCurrency(p.bank)],
        ["Grand Total", formatCurrency(p.total)],
        ["Total Sales (orders)", formatCurrency(p.salesTotal)],
        ["Order Count", p.orderCount],
      ];
      await finishExport("payments", rows.length, `payment-summary-${dateSuffix}.csv`, buildCsv(["Payment Method", "Amount (KES)"], rows));
    } finally {
      setExporting(false);
    }
  };

  const exportCashierCSV = async () => {
    const cashiers = data.cashier;
    if (!cashiers) return;
    setExporting(true);
    try {
      const rows =
        cashiers.length > 0
          ? cashiers.map((c) => [
              c.name,
              c.orders,
              formatCurrency(c.revenue),
              formatCurrency(c.cash),
              formatCurrency(c.mpesa),
              formatCurrency(c.card),
              formatCurrency(c.bank),
              c.cancellations,
            ])
          : [NO_DATA_ROW];
      await finishExport(
        "cashiers",
        cashiers.length,
        `cashier-report-${dateSuffix}.csv`,
        buildCsv(
          ["Cashier", "Orders", "Revenue (KES)", "Cash (KES)", "M-Pesa (KES)", "Card (KES)", "Bank (KES)", "Cancellations"],
          rows
        )
      );
    } finally {
      setExporting(false);
    }
  };

  const exportProfitCSV = async () => {
    const profit = data.profit;
    if (!profit) return;
    setExporting(true);
    try {
      await finishExport(
        "profit",
        1,
        `profit-report-${dateSuffix}.csv`,
        buildCsv(
          ["Metric", "Amount (KES)"],
          [
            ["Revenue", formatCurrency(profit.revenue)],
            ["Cost of Goods", formatCurrency(profit.cost)],
            ["Expenses", formatCurrency(profit.expenses)],
            ["Net Profit", formatCurrency(profit.profit)],
            ["Orders", profit.orderCount],
          ]
        )
      );
    } finally {
      setExporting(false);
    }
  };

  const exportExpensesCSV = async () => {
    const expenses = data.expenses;
    if (!expenses) return;
    setExporting(true);
    try {
      const rows =
        expenses.length > 0
          ? expenses.map((e) => [formatDate(e.date), e.category, e.description, formatCurrency(e.amount), e.reference ?? ""])
          : [NO_DATA_ROW];
      await finishExport(
        "expenses",
        expenses.length,
        `expenses-report-${dateSuffix}.csv`,
        buildCsv(["Date", "Category", "Description", "Amount (KES)", "Reference"], rows)
      );
    } finally {
      setExporting(false);
    }
  };

  const exportInventoryCSV = async () => {
    const inv = data.inventory;
    if (!inv) return;
    setExporting(true);
    try {
      const rows =
        inv.products.length > 0
          ? inv.products.map((p) => [
              p.name,
              p.sku,
              p.category,
              p.stock,
              p.lowStockAlert,
              formatCurrency(p.costValue),
              formatCurrency(p.retailValue),
              p.isLowStock ? "Yes" : "No",
            ])
          : [NO_DATA_ROW];
      await finishExport(
        "inventory",
        inv.products.length,
        `inventory-report-${dateSuffix}.csv`,
        buildCsv(
          ["Product", "SKU", "Category", "Stock", "Low Alert", "Cost Value (KES)", "Retail Value (KES)", "Low Stock"],
          rows
        )
      );
    } finally {
      setExporting(false);
    }
  };

  const exportStockMovementCSV = async () => {
    const moves = data.stockMovement;
    if (!moves) return;
    setExporting(true);
    try {
      const rows =
        moves.length > 0
          ? moves.map((m) => [
              formatDate(m.createdAt),
              m.product.name,
              m.product.sku,
              m.type,
              m.quantity,
              m.reason ?? "",
              m.user?.name ?? "System",
            ])
          : [NO_DATA_ROW];
      await finishExport(
        "stock-movement",
        moves.length,
        `stock-movement-${dateSuffix}.csv`,
        buildCsv(["Date", "Product", "SKU", "Type", "Qty", "Reason", "User"], rows)
      );
    } finally {
      setExporting(false);
    }
  };

  const exportOccupancyCSV = async () => {
    const occ = data.occupancy;
    if (!occ) return;
    setExporting(true);
    try {
      const statusRows = Object.entries(occ.statusBreakdown).map(([k, v]) => [k, v]);
      const bookingRows =
        occ.bookings.length > 0
          ? occ.bookings.map((b) => [b.guest.fullName, b.room.number, b.status, formatDateOnly(b.checkIn), formatDateOnly(b.checkOut)])
          : [["No bookings in period", "", "", "", ""]];
      const csv =
        buildCsv(["Room Status", "Count"], statusRows) +
        "\n" +
        buildCsv(["Guest", "Room", "Status", "Check In", "Check Out"], bookingRows);
      await finishExport("occupancy", occ.bookings.length, `occupancy-report-${dateSuffix}.csv`, csv);
    } finally {
      setExporting(false);
    }
  };

  const exportProductPerformanceCSV = async () => {
    const perf = data.productPerformance;
    if (!perf) return;
    setExporting(true);
    try {
      const rows =
        perf.length > 0
          ? perf.map((p) => [p.name, p.sku, p.category, p.quantity, formatCurrency(p.revenue), formatCurrency(p.cost), formatCurrency(p.margin)])
          : [NO_DATA_ROW];
      await finishExport(
        "product-performance",
        perf.length,
        `product-performance-${dateSuffix}.csv`,
        buildCsv(["Product", "SKU", "Category", "Qty", "Revenue (KES)", "Cost (KES)", "Margin (KES)"], rows)
      );
    } finally {
      setExporting(false);
    }
  };

  const toExcelData = (): ReportExcelData => ({
    sales: data.sales,
    payment: data.payment ?? undefined,
    cashier: data.cashier,
    inventory: data.inventory,
    occupancy: data.occupancy,
    roomRevenue: data.roomRevenue,
    profit: data.profit ?? undefined,
    expenses: data.expenses,
    productPerformance: data.productPerformance,
  });

  const exportExcelReport = async (reportId: ReportModuleId) => {
    if (!EXCEL_REPORT_IDS.includes(reportId)) return;
    if (!generatedAt) {
      toast({ title: "Generate report first", description: "Click Generate before exporting Excel.", variant: "destructive" });
      return;
    }
    setExporting(true);
    try {
      const mod = REPORT_MODULES.find((m) => m.id === reportId);
      const rowCount = await exportReportExcel(
        reportId,
        settings,
        dateRangeLabel,
        generatedAt,
        generatedBy,
        dateSuffix,
        toExcelData()
      );
      await logReportExported(`${reportId}-excel`, filter, rowCount);
      toast({
        title: "Excel report exported",
        description: `${mod?.title ?? reportId} — ${reportId}-report-${dateSuffix}.xlsx`,
      });
    } catch (error) {
      console.error("[Reports Excel]", error);
      toast({ title: "Excel export failed", description: "Could not create the workbook.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleExport = () => {
    if (!activeReport) return;
    switch (activeReport) {
      case "sales":
        exportSalesCSV();
        break;
      case "payment":
        exportPaymentCSV();
        break;
      case "cashier":
        exportCashierCSV();
        break;
      case "inventory":
        exportInventoryCSV();
        break;
      case "stock-movement":
        exportStockMovementCSV();
        break;
      case "occupancy":
        exportOccupancyCSV();
        break;
      case "profit":
        exportProfitCSV();
        break;
      case "expense":
        exportExpensesCSV();
        break;
      case "product-performance":
        exportProductPerformanceCSV();
        break;
    }
  };

  const exportDisabled = loading || exporting || !activeReport || !generatedAt;
  const moduleMeta = REPORT_MODULES.find((m) => m.id === activeReport);

  return (
    <div className="reports-page">
      <PageHeader title="Reports" description="Professional report generation, preview, print, and export">
        <div className="no-print flex flex-wrap gap-2 items-center">
          <Select
            value={filter}
            onValueChange={(v) => {
              setFilter(v);
              setGeneratedAt(null);
            }}
          >
            <SelectTrigger className="w-36 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {filter === "custom" && (
            <>
              <Input
                type="date"
                value={customStart}
                onChange={(e) => {
                  setCustomStart(e.target.value);
                  setGeneratedAt(null);
                }}
                className="w-36"
              />
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => {
                  setCustomEnd(e.target.value);
                  setGeneratedAt(null);
                }}
                className="w-36"
              />
            </>
          )}
        </div>
      </PageHeader>

      <p className="no-print -mt-4 mb-6 text-xs text-muted-foreground">
        CSV is raw data. Excel exports are formatted reports (Summary, Details, and Chart Data sheets).
      </p>

      <div className="no-print mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {REPORT_MODULES.map((mod) => {
          const Icon = mod.icon;
          const isActive = activeReport === mod.id;
          return (
            <Card
              key={mod.id}
              className={cn(
                "border-border/80 transition-shadow hover:shadow-md",
                isActive && "ring-2 ring-emerald-500/50"
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-serif">{mod.title}</CardTitle>
                    <CardDescription className="text-xs mt-1">{mod.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 pt-0">
                <Button
                  variant="gold"
                  size="sm"
                  disabled={loading && activeReport === mod.id}
                  onClick={() => generateReport(mod.id)}
                >
                  {loading && activeReport === mod.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generating…
                    </>
                  ) : (
                    <>
                      <FileBarChart className="h-4 w-4 mr-1" /> Generate
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!generatedAt || activeReport !== mod.id}
                  onClick={() => {
                    setActiveReport(mod.id);
                    handleExportFor(mod.id);
                  }}
                  title="Plain CSV for import and analysis"
                >
                  <Download className="h-4 w-4 mr-1" /> Export CSV Raw Data
                </Button>
                {EXCEL_REPORT_IDS.includes(mod.id) && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!generatedAt || activeReport !== mod.id || exporting}
                    onClick={() => {
                      setActiveReport(mod.id);
                      exportExcelReport(mod.id);
                    }}
                    title="Formatted workbook with Summary, Details, and Chart Data"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-1" /> Export Excel Report
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {activeReport && generatedAt && (
        <div
          data-report-actions
          className="no-print sticky bottom-4 z-30 mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-800/40 bg-emerald-950/95 px-4 py-3 shadow-xl backdrop-blur"
        >
          <span className="text-sm text-emerald-100 mr-auto">
            <strong className="text-gold">{moduleMeta?.title}</strong>
            <span className="text-emerald-300/80 ml-2">• {dateRangeLabel}</span>
          </span>
          <Button variant="outline" size="sm" disabled={exportDisabled} onClick={handleExport} title="Plain CSV for import and analysis">
            <Download className="h-4 w-4 mr-1" /> Export CSV Raw Data
          </Button>
          {activeReport && EXCEL_REPORT_IDS.includes(activeReport) && (
            <Button
              variant="outline"
              size="sm"
              disabled={exportDisabled}
              onClick={() => exportExcelReport(activeReport!)}
              title="Formatted workbook with Summary, Details, and Chart Data"
            >
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Export Excel Report
            </Button>
          )}
          <Button variant="gold" size="sm" onClick={printReport}>
            <Printer className="h-4 w-4 mr-1" /> Print Report
          </Button>
        </div>
      )}

      {loading && activeReport && (
        <div className="no-print mb-6 space-y-3">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
        </div>
      )}

      {!loading && activeReport && generatedAt && (
        <ReportPreview
          reportId={activeReport}
          settings={settings}
          dateRangeLabel={dateRangeLabel}
          generatedBy={generatedBy}
          generatedAt={generatedAt}
          data={data}
        />
      )}

      {!activeReport && (
        <Card className="no-print border-dashed">
          <CardContent className="py-16 text-center text-muted-foreground">
            <FileBarChart className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p className="font-medium">Select a report and click Generate</p>
            <p className="text-sm mt-1">Choose a date range above, then open any report module.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  function handleExportFor(id: ReportModuleId) {
    setActiveReport(id);
    switch (id) {
      case "sales":
        exportSalesCSV();
        break;
      case "payment":
        exportPaymentCSV();
        break;
      case "cashier":
        exportCashierCSV();
        break;
      case "inventory":
        exportInventoryCSV();
        break;
      case "stock-movement":
        exportStockMovementCSV();
        break;
      case "occupancy":
        exportOccupancyCSV();
        break;
      case "profit":
        exportProfitCSV();
        break;
      case "expense":
        exportExpensesCSV();
        break;
      case "product-performance":
        exportProductPerformanceCSV();
        break;
    }
  }
}

function ReportPreview({
  reportId,
  settings,
  dateRangeLabel,
  generatedBy,
  generatedAt,
  data,
}: {
  reportId: ReportModuleId;
  settings: ReportSettingsInfo;
  dateRangeLabel: string;
  generatedBy: string;
  generatedAt: Date;
  data: LoadedReports;
}) {
  const mod = REPORT_MODULES.find((m) => m.id === reportId)!;

  switch (reportId) {
    case "sales":
      return <SalesReportView mod={mod} settings={settings} dateRangeLabel={dateRangeLabel} generatedBy={generatedBy} generatedAt={generatedAt} sales={data.sales} />;
    case "payment":
      return <PaymentReportView mod={mod} settings={settings} dateRangeLabel={dateRangeLabel} generatedBy={generatedBy} generatedAt={generatedAt} payment={data.payment} />;
    case "cashier":
      return <CashierReportView mod={mod} settings={settings} dateRangeLabel={dateRangeLabel} generatedBy={generatedBy} generatedAt={generatedAt} cashiers={data.cashier} />;
    case "inventory":
      return <InventoryReportView mod={mod} settings={settings} dateRangeLabel={dateRangeLabel} generatedBy={generatedBy} generatedAt={generatedAt} inventory={data.inventory} />;
    case "stock-movement":
      return <StockMovementReportView mod={mod} settings={settings} dateRangeLabel={dateRangeLabel} generatedBy={generatedBy} generatedAt={generatedAt} movements={data.stockMovement} />;
    case "occupancy":
      return <OccupancyReportView mod={mod} settings={settings} dateRangeLabel={dateRangeLabel} generatedBy={generatedBy} generatedAt={generatedAt} occupancy={data.occupancy} roomRevenue={data.roomRevenue} />;
    case "profit":
      return <ProfitReportView mod={mod} settings={settings} dateRangeLabel={dateRangeLabel} generatedBy={generatedBy} generatedAt={generatedAt} profit={data.profit} />;
    case "expense":
      return <ExpenseReportView mod={mod} settings={settings} dateRangeLabel={dateRangeLabel} generatedBy={generatedBy} generatedAt={generatedAt} expenses={data.expenses} />;
    case "product-performance":
      return <ProductPerformanceReportView mod={mod} settings={settings} dateRangeLabel={dateRangeLabel} generatedBy={generatedBy} generatedAt={generatedAt} products={data.productPerformance} />;
    default:
      return null;
  }
}

type ViewBase = {
  mod: { title: string; description: string };
  settings: ReportSettingsInfo;
  dateRangeLabel: string;
  generatedBy: string;
  generatedAt: Date;
};

function SalesReportView({
  mod,
  settings,
  dateRangeLabel,
  generatedBy,
  generatedAt,
  sales,
}: ViewBase & { sales?: LoadedReports["sales"] }) {
  const empty = !sales?.orderCount;
  const kpis: ReportKpi[] = sales
    ? [
        { label: "Total Revenue", value: sales.totalRevenue, accent: "gold" },
        { label: "Orders", value: String(sales.orderCount), accent: "emerald" },
        { label: "Categories", value: String(sales.salesByCategory.length), accent: "neutral" },
        { label: "Top Products", value: String(sales.topProducts.length), accent: "neutral" },
      ]
    : [];

  return (
    <ReportViewer title={mod.title} subtitle={mod.description} settings={settings} dateRangeLabel={dateRangeLabel} generatedBy={generatedBy} generatedAt={generatedAt} kpis={kpis} empty={empty}>
      <div className="grid gap-8 lg:grid-cols-2">
        <ReportSection title="Revenue by Day">
          <ReportLineChart data={sales?.revenueByDay ?? []} />
        </ReportSection>
        <ReportSection title="Sales by Category">
          <ReportPieChart data={sales?.salesByCategory ?? []} innerRadius={40} />
        </ReportSection>
      </div>
      <ReportSection title="Top Products">
        <ReportBarChart data={sales?.topProducts ?? []} dataKey="revenue" nameKey="name" layout="vertical" />
      </ReportSection>
      <ReportSection title="Order Detail">
        <ReportTable
          columns={["Order", "Date", "Cashier", "Total (KES)", "Payments"]}
          rows={
            sales?.orders.slice(0, 50).map((o) => [
              o.orderNumber,
              formatDate(o.createdAt),
              o.user.name,
              formatCurrency(o.total),
              o.payments?.map((p) => `${getPaymentMethodLabel(p.method)} ${formatCurrency(p.amount)}`).join(", ") ?? "—",
            ]) ?? []
          }
        />
      </ReportSection>
    </ReportViewer>
  );
}

function PaymentReportView({
  mod,
  settings,
  dateRangeLabel,
  generatedBy,
  generatedAt,
  payment,
}: ViewBase & { payment?: LoadedReports["payment"] }) {
  const empty = !payment?.orderCount;
  const chartData = payment
    ? [
        { name: "Cash", value: payment.cash },
        { name: "M-Pesa", value: payment.mpesa },
        { name: "Card", value: payment.card },
        { name: "Bank", value: payment.bank },
      ]
    : [];

  const kpis: ReportKpi[] = payment
    ? [
        { label: "Cash", value: payment.cash, accent: "emerald" },
        { label: "M-Pesa", value: payment.mpesa, accent: "gold" },
        { label: "Card", value: payment.card, accent: "neutral" },
        { label: "Grand Total", value: payment.total, accent: "gold", sublabel: `${payment.orderCount} orders` },
      ]
    : [];

  return (
    <ReportViewer title={mod.title} subtitle={mod.description} settings={settings} dateRangeLabel={dateRangeLabel} generatedBy={generatedBy} generatedAt={generatedAt} kpis={kpis} empty={empty}>
      <div className="grid gap-8 lg:grid-cols-2">
        <ReportSection title="Payment Methods">
          <ReportBarChart data={chartData} dataKey="value" nameKey="name" />
        </ReportSection>
        <ReportSection title="Method Share">
          <ReportPieChart data={chartData} innerRadius={50} />
        </ReportSection>
      </div>
      <ReportSection title="Summary">
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Cash {formatCurrency(payment?.cash ?? 0)}</Badge>
          <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">M-Pesa {formatCurrency(payment?.mpesa ?? 0)}</Badge>
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Card {formatCurrency(payment?.card ?? 0)}</Badge>
          <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100">Bank {formatCurrency(payment?.bank ?? 0)}</Badge>
        </div>
        <p className="mt-4 text-sm text-slate-600">
          Order sales total: {formatCurrency(payment?.salesTotal ?? 0)} • Bank + Card + Cash + M-Pesa grand total:{" "}
          <strong>{formatCurrency(payment?.total ?? 0)}</strong>
        </p>
      </ReportSection>
    </ReportViewer>
  );
}

function CashierReportView({
  mod,
  settings,
  dateRangeLabel,
  generatedBy,
  generatedAt,
  cashiers,
}: ViewBase & { cashiers?: LoadedReports["cashier"] }) {
  const empty = !cashiers?.length;
  const kpis: ReportKpi[] = cashiers?.length
    ? [
        { label: "Cashiers", value: String(cashiers.length), accent: "emerald" },
        {
          label: "Top Revenue",
          value: cashiers[0]?.revenue ?? 0,
          accent: "gold",
          sublabel: cashiers[0]?.name,
        },
        { label: "Total Orders", value: String(cashiers.reduce((s, c) => s + c.orders, 0)), accent: "neutral" },
      ]
    : [];

  const barData = cashiers?.map((c) => ({ name: c.name, revenue: c.revenue, orders: c.orders })) ?? [];

  return (
    <ReportViewer title={mod.title} subtitle={mod.description} settings={settings} dateRangeLabel={dateRangeLabel} generatedBy={generatedBy} generatedAt={generatedAt} kpis={kpis} empty={empty}>
      <ReportSection title="Sales per Cashier">
        <ReportBarChart data={barData} dataKey="revenue" />
      </ReportSection>
      <ReportSection title="Cashier Detail">
        <ReportTable
          columns={["Cashier", "Orders", "Revenue", "Cash", "M-Pesa", "Card", "Bank", "Cancelled"]}
          rows={
            cashiers?.map((c) => [
              c.name,
              c.orders,
              formatCurrency(c.revenue),
              formatCurrency(c.cash),
              formatCurrency(c.mpesa),
              formatCurrency(c.card),
              formatCurrency(c.bank),
              c.cancellations,
            ]) ?? []
          }
        />
      </ReportSection>
    </ReportViewer>
  );
}

function InventoryReportView({
  mod,
  settings,
  dateRangeLabel,
  generatedBy,
  generatedAt,
  inventory,
}: ViewBase & { inventory?: LoadedReports["inventory"] }) {
  const empty = !inventory?.products.length;
  const totalRetail = inventory?.products.reduce((s, p) => s + p.retailValue, 0) ?? 0;
  const lowCount = inventory?.lowStock.length ?? 0;

  return (
    <ReportViewer
      title={mod.title}
      subtitle={mod.description}
      settings={settings}
      dateRangeLabel={dateRangeLabel}
      generatedBy={generatedBy}
      generatedAt={generatedAt}
      empty={empty}
      kpis={[
        { label: "Active SKUs", value: String(inventory?.products.length ?? 0), accent: "emerald" },
        { label: "Low Stock Items", value: String(lowCount), accent: lowCount ? "danger" : "neutral" },
        { label: "Retail Value", value: totalRetail, accent: "gold" },
      ]}
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <ReportSection title="Low Stock">
          <ReportBarChart
            data={inventory?.lowStock.map((p) => ({ name: p.name, stock: p.stock })) ?? []}
            dataKey="stock"
            formatter={(v) => String(v)}
          />
        </ReportSection>
        <ReportSection title="Stock Value by Category">
          <ReportGroupedBarChart
            data={inventory?.stockByCategory.map((c) => ({ name: c.name, retail: c.retailValue, cost: c.costValue })) ?? []}
            keys={["retail", "cost"]}
            labels={["Retail (KES)", "Cost (KES)"]}
          />
        </ReportSection>
      </div>
      <ReportSection title="Inventory Table">
        <ReportTable
          columns={["Product", "SKU", "Category", "Stock", "Alert", "Cost Val.", "Retail Val."]}
          rows={
            inventory?.products.map((p) => [
              p.name,
              p.sku,
              p.category,
              p.stock,
              p.lowStockAlert,
              formatCurrency(p.costValue),
              formatCurrency(p.retailValue),
            ]) ?? []
          }
        />
      </ReportSection>
    </ReportViewer>
  );
}

function StockMovementReportView({
  mod,
  settings,
  dateRangeLabel,
  generatedBy,
  generatedAt,
  movements,
}: ViewBase & { movements?: LoadedReports["stockMovement"] }) {
  const empty = !movements?.length;

  return (
    <ReportViewer title={mod.title} subtitle={mod.description} settings={settings} dateRangeLabel={dateRangeLabel} generatedBy={generatedBy} generatedAt={generatedAt} empty={empty} kpis={[{ label: "Movements", value: String(movements?.length ?? 0), accent: "emerald" }]}>
      <ReportSection title="Inventory Movements">
        <ReportTable
          columns={["Date", "Product", "SKU", "Type", "Qty", "Reason", "User"]}
          rows={
            movements?.map((m) => [
              formatDate(m.createdAt),
              m.product.name,
              m.product.sku,
              m.type,
              m.quantity,
              m.reason ?? "—",
              m.user?.name ?? "System",
            ]) ?? []
          }
        />
      </ReportSection>
    </ReportViewer>
  );
}

function OccupancyReportView({
  mod,
  settings,
  dateRangeLabel,
  generatedBy,
  generatedAt,
  occupancy,
  roomRevenue,
}: ViewBase & { occupancy?: LoadedReports["occupancy"]; roomRevenue?: LoadedReports["roomRevenue"] }) {
  const chartData = occupancy
    ? Object.entries(occupancy.statusBreakdown).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
      }))
    : [];

  return (
    <ReportViewer
      title={mod.title}
      subtitle={mod.description}
      settings={settings}
      dateRangeLabel={dateRangeLabel}
      generatedBy={generatedBy}
      generatedAt={generatedAt}
      kpis={[
        { label: "Occupancy Rate", value: `${occupancy?.occupancyRate ?? 0}%`, accent: "emerald" },
        { label: "Total Rooms", value: String(occupancy?.totalRooms ?? 0), accent: "neutral" },
        { label: "Occupied", value: String(occupancy?.statusBreakdown.occupied ?? 0), accent: "gold" },
        { label: "Available", value: String(occupancy?.statusBreakdown.available ?? 0), accent: "emerald" },
      ]}
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <ReportSection title="Room Status">
          <ReportPieChart data={chartData} />
        </ReportSection>
        <ReportSection title="Room Revenue">
          <ReportTable
            columns={["Room", "Type", "Orders", "Revenue (KES)"]}
            rows={
              roomRevenue?.map((r) => [r.number, r.type, r.orders, formatCurrency(r.revenue)]) ?? []
            }
            emptyLabel="No room-attributed sales in period"
          />
        </ReportSection>
      </div>
      <ReportSection title="Bookings in Period">
        <ReportTable
          columns={["Guest", "Room", "Status", "Check In", "Check Out"]}
          rows={
            occupancy?.bookings.map((b) => [
              b.guest.fullName,
              b.room.number,
              b.status.replace("_", " "),
              formatDateOnly(b.checkIn),
              formatDateOnly(b.checkOut),
            ]) ?? []
          }
          emptyLabel="No bookings in period"
        />
      </ReportSection>
    </ReportViewer>
  );
}

function ProfitReportView({
  mod,
  settings,
  dateRangeLabel,
  generatedBy,
  generatedAt,
  profit,
}: ViewBase & { profit?: LoadedReports["profit"] }) {
  const chartData = profit
    ? [
        { name: "Revenue", revenue: profit.revenue },
        { name: "Expenses", revenue: profit.expenses },
        { name: "COGS", revenue: profit.cost },
      ]
    : [];

  return (
    <ReportViewer
      title={mod.title}
      subtitle={mod.description}
      settings={settings}
      dateRangeLabel={dateRangeLabel}
      generatedBy={generatedBy}
      generatedAt={generatedAt}
      kpis={[
        { label: "Revenue", value: profit?.revenue ?? 0, accent: "gold" },
        { label: "COGS", value: profit?.cost ?? 0, accent: "neutral" },
        { label: "Expenses", value: profit?.expenses ?? 0, accent: "danger" },
        { label: "Net Profit", value: profit?.profit ?? 0, accent: "emerald", sublabel: `${profit?.orderCount ?? 0} orders` },
      ]}
    >
      <ReportSection title="Revenue vs Expenses">
        <ReportBarChart data={chartData} dataKey="revenue" />
      </ReportSection>
      <ReportSection title="Gross Profit Summary">
        <ReportTable
          columns={["Metric", "Amount (KES)"]}
          rows={[
            ["Revenue", formatCurrency(profit?.revenue ?? 0)],
            ["Cost of Goods", formatCurrency(profit?.cost ?? 0)],
            ["Operating Expenses", formatCurrency(profit?.expenses ?? 0)],
            ["Net Profit", formatCurrency(profit?.profit ?? 0)],
          ]}
        />
      </ReportSection>
    </ReportViewer>
  );
}

function ExpenseReportView({
  mod,
  settings,
  dateRangeLabel,
  generatedBy,
  generatedAt,
  expenses,
}: ViewBase & { expenses?: LoadedReports["expenses"] }) {
  const total = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0;
  const empty = !expenses?.length;

  return (
    <ReportViewer
      title={mod.title}
      subtitle={mod.description}
      settings={settings}
      dateRangeLabel={dateRangeLabel}
      generatedBy={generatedBy}
      generatedAt={generatedAt}
      empty={empty}
      kpis={[
        { label: "Total Expenses", value: total, accent: "danger" },
        { label: "Line Items", value: String(expenses?.length ?? 0), accent: "neutral" },
      ]}
    >
      <ReportSection title="Expense Detail">
        <ReportTable
          columns={["Date", "Category", "Description", "Amount (KES)", "Reference"]}
          rows={
            expenses?.map((e) => [
              formatDate(e.date),
              e.category,
              e.description,
              formatCurrency(e.amount),
              e.reference ?? "—",
            ]) ?? []
          }
        />
      </ReportSection>
    </ReportViewer>
  );
}

function ProductPerformanceReportView({
  mod,
  settings,
  dateRangeLabel,
  generatedBy,
  generatedAt,
  products,
}: ViewBase & { products?: LoadedReports["productPerformance"] }) {
  const empty = !products?.length;
  const top = products?.slice(0, 10) ?? [];

  return (
    <ReportViewer
      title={mod.title}
      subtitle={mod.description}
      settings={settings}
      dateRangeLabel={dateRangeLabel}
      generatedBy={generatedBy}
      generatedAt={generatedAt}
      empty={empty}
      kpis={[
        { label: "Products Sold", value: String(products?.length ?? 0), accent: "emerald" },
        { label: "Top Revenue", value: products?.[0]?.revenue ?? 0, accent: "gold", sublabel: products?.[0]?.name },
      ]}
    >
      <ReportSection title="Revenue by Product">
        <ReportBarChart data={top} dataKey="revenue" nameKey="name" layout="vertical" />
      </ReportSection>
      <ReportSection title="Product Performance Table">
        <ReportTable
          columns={["Product", "SKU", "Category", "Qty", "Revenue", "Cost", "Margin"]}
          rows={
            products?.map((p) => [
              p.name,
              p.sku,
              p.category,
              p.quantity,
              formatCurrency(p.revenue),
              formatCurrency(p.cost),
              formatCurrency(p.margin),
            ]) ?? []
          }
        />
      </ReportSection>
    </ReportViewer>
  );
}
