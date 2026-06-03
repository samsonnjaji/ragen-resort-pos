"use client";

import { useState } from "react";
import { PageHeader, StatCard } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getSalesReport,
  getProfitReport,
  getCashierPerformance,
  getInventoryReport,
  getOccupancyReport,
  getPaymentSummary,
  getExpensesForReport,
  logReportExported,
} from "@/lib/actions/admin";
import { getPaymentMethodLabel } from "@/lib/payments";
import { formatCurrency, formatDate, formatDateOnly } from "@/lib/utils";
import { buildCsv, downloadCsvFile, reportDateSuffix } from "@/lib/report-export";
import { useToast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet, Package, BedDouble } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const OCCUPANCY_COLORS = ["#10B981", "#EF4444", "#EAB308", "#3B82F6", "#6B7280"];
const NO_DATA_ROW = ["No records found for this period"];

export function ReportsClient() {
  const [filter, setFilter] = useState("today");
  const [salesData, setSalesData] = useState<Awaited<ReturnType<typeof getSalesReport>>>([]);
  const [profitData, setProfitData] = useState<Awaited<ReturnType<typeof getProfitReport>> | null>(null);
  const [cashierData, setCashierData] = useState<Awaited<ReturnType<typeof getCashierPerformance>>>([]);
  const [inventoryData, setInventoryData] = useState<Awaited<ReturnType<typeof getInventoryReport>>>([]);
  const [occupancyData, setOccupancyData] = useState<Awaited<ReturnType<typeof getOccupancyReport>> | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<Awaited<ReturnType<typeof getPaymentSummary>> | null>(null);
  const [expensesData, setExpensesData] = useState<Awaited<ReturnType<typeof getExpensesForReport>>>([]);
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const { toast } = useToast();

  const dateSuffix = reportDateSuffix(filter, customStart, customEnd);

  const resolveDates = () => {
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
  };

  const loadReports = async () => {
    const dates = resolveDates();
    if (filter === "custom" && !dates) return;

    setLoading(true);
    try {
      const start = dates?.start;
      const end = dates?.end;

      const [sales, profit, cashiers, inventory, occupancy, payments, expenses] =
        await Promise.all([
          getSalesReport(filter, start, end),
          getProfitReport(filter, start, end),
          getCashierPerformance(filter, start, end),
          getInventoryReport(),
          getOccupancyReport(filter, start, end),
          getPaymentSummary(filter, start, end),
          getExpensesForReport(filter, start, end),
        ]);
      setSalesData(sales);
      setProfitData(profit);
      setCashierData(cashiers);
      setInventoryData(inventory);
      setOccupancyData(occupancy);
      setPaymentSummary(payments);
      setExpensesData(expenses);
      setReportsLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  const requireLoaded = (): boolean => {
    if (!reportsLoaded) {
      toast({
        title: "Generate report first",
        description: "Click Generate Report before exporting.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const finishExport = async (type: string, rowCount: number, filename: string, csv: string) => {
    downloadCsvFile(filename, csv);
    await logReportExported(type, filter, rowCount);
    toast({ title: "Export complete", description: filename });
  };

  const exportSalesCSV = async () => {
    if (!requireLoaded()) return;
    setExporting(true);
    try {
      const rows =
        salesData.length > 0
          ? salesData.map((o) => {
              const pay =
                o.payments?.length > 0
                  ? o.payments.map((p) => `${getPaymentMethodLabel(p.method)} ${p.amount}`).join("; ")
                  : "";
              return [
                o.orderNumber,
                formatDate(o.createdAt),
                formatCurrency(o.total),
                o.status,
                o.user.name,
                pay,
              ];
            })
          : [NO_DATA_ROW];
      const csv = buildCsv(
        ["Order Number", "Date", "Total (KES)", "Status", "Cashier", "Payments"],
        rows
      );
      await finishExport("sales", salesData.length, `sales-report-${dateSuffix}.csv`, csv);
    } finally {
      setExporting(false);
    }
  };

  const exportPaymentCSV = async () => {
    if (!requireLoaded() || !paymentSummary) return;
    setExporting(true);
    try {
      const rows: (string | number)[][] = [
        ["Cash", formatCurrency(paymentSummary.cash)],
        ["M-Pesa", formatCurrency(paymentSummary.mpesa)],
        ["Card", formatCurrency(paymentSummary.card)],
        ["Bank", formatCurrency(paymentSummary.bank)],
        ["Grand Total", formatCurrency(paymentSummary.total)],
        ["Total Sales (orders)", formatCurrency(paymentSummary.salesTotal)],
        ["Order Count", paymentSummary.orderCount],
      ];
      if (paymentSummary.legacySplit > 0) {
        rows.push(["Legacy Split", formatCurrency(paymentSummary.legacySplit)]);
      }
      const csv = buildCsv(["Payment Method", "Amount (KES)"], rows);
      await finishExport("payments", rows.length, `payment-summary-${dateSuffix}.csv`, csv);
    } finally {
      setExporting(false);
    }
  };

  const exportCashierCSV = async () => {
    if (!requireLoaded()) return;
    setExporting(true);
    try {
      const rows =
        cashierData.length > 0
          ? cashierData.map((c) => [
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
      const csv = buildCsv(
        [
          "Cashier",
          "Orders",
          "Revenue (KES)",
          "Cash (KES)",
          "M-Pesa (KES)",
          "Card (KES)",
          "Bank (KES)",
          "Cancellations",
        ],
        rows
      );
      await finishExport("cashiers", cashierData.length, `cashier-report-${dateSuffix}.csv`, csv);
    } finally {
      setExporting(false);
    }
  };

  const exportProfitCSV = async () => {
    if (!requireLoaded() || !profitData) return;
    setExporting(true);
    try {
      const csv = buildCsv(
        ["Metric", "Amount (KES)"],
        [
          ["Revenue", formatCurrency(profitData.revenue)],
          ["Cost of Goods", formatCurrency(profitData.cost)],
          ["Expenses", formatCurrency(profitData.expenses)],
          ["Net Profit", formatCurrency(profitData.profit)],
          ["Orders", profitData.orderCount],
        ]
      );
      await finishExport("profit", 1, `profit-report-${dateSuffix}.csv`, csv);
    } finally {
      setExporting(false);
    }
  };

  const exportExpensesCSV = async () => {
    if (!requireLoaded()) return;
    setExporting(true);
    try {
      const rows =
        expensesData.length > 0
          ? expensesData.map((e) => [
              formatDate(e.date),
              e.category,
              e.description,
              formatCurrency(e.amount),
              e.reference ?? "",
            ])
          : [NO_DATA_ROW];
      const csv = buildCsv(
        ["Date", "Category", "Description", "Amount (KES)", "Reference"],
        rows
      );
      await finishExport("expenses", expensesData.length, `expenses-report-${dateSuffix}.csv`, csv);
    } finally {
      setExporting(false);
    }
  };

  const exportInventoryCSV = async () => {
    if (!requireLoaded()) return;
    setExporting(true);
    try {
      const rows =
        inventoryData.length > 0
          ? inventoryData.map((p) => [
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
      const csv = buildCsv(
        [
          "Product",
          "SKU",
          "Category",
          "Stock",
          "Low Alert",
          "Cost Value (KES)",
          "Retail Value (KES)",
          "Low Stock",
        ],
        rows
      );
      await finishExport("inventory", inventoryData.length, `inventory-report-${dateSuffix}.csv`, csv);
    } finally {
      setExporting(false);
    }
  };

  const exportOccupancyCSV = async () => {
    if (!requireLoaded() || !occupancyData) return;
    setExporting(true);
    try {
      const statusRows = Object.entries(occupancyData.statusBreakdown).map(([k, v]) => [
        k,
        v,
      ]);
      const bookingRows =
        occupancyData.bookings.length > 0
          ? occupancyData.bookings.map((b) => [
              b.guest.fullName,
              b.room.number,
              b.status,
              formatDateOnly(b.checkIn),
              formatDateOnly(b.checkOut),
            ])
          : [["No bookings in period", "", "", "", ""]];

      const csv =
        buildCsv(["Room Status", "Count"], statusRows) +
        "\n" +
        buildCsv(
          ["Guest", "Room", "Status", "Check In", "Check Out"],
          bookingRows
        );
      await finishExport(
        "occupancy",
        occupancyData.bookings.length,
        `occupancy-report-${dateSuffix}.csv`,
        csv
      );
    } finally {
      setExporting(false);
    }
  };

  const exportExcel = async () => {
    if (!requireLoaded()) return;
    if (salesData.length === 0) {
      toast({
        title: "No sales data",
        description: "Generate a report with completed sales to export Excel.",
        variant: "destructive",
      });
      return;
    }
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const rows = salesData.map((o) => ({
        "Order Number": o.orderNumber,
        Date: formatDate(o.createdAt),
        "Total (KES)": o.total,
        Status: o.status,
        Cashier: o.user.name,
        Payments:
          o.payments?.map((p) => `${getPaymentMethodLabel(p.method)} ${p.amount}`).join("; ") ?? "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sales");
      XLSX.writeFile(wb, `sales-report-${dateSuffix}.xlsx`);
      await logReportExported("sales-excel", filter, salesData.length);
      toast({ title: "Export complete", description: `sales-report-${dateSuffix}.xlsx` });
    } finally {
      setExporting(false);
    }
  };

  const totalRevenue = salesData.reduce((s, o) => s + o.total, 0);

  const paymentMethodSales = paymentSummary
    ? {
        cash: paymentSummary.cash,
        mpesa: paymentSummary.mpesa,
        card: paymentSummary.card,
        bank: paymentSummary.bank,
      }
    : null;

  const occupancyChart = occupancyData
    ? Object.entries(occupancyData.statusBreakdown).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
      }))
    : [];

  const exportDisabled = loading || exporting;

  return (
    <div>
      <PageHeader title="Reports" description="Business analytics and exports">
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={filter} onValueChange={(v) => { setFilter(v); setReportsLoaded(false); }}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {filter === "custom" && (
            <>
              <Input type="date" value={customStart} onChange={(e) => { setCustomStart(e.target.value); setReportsLoaded(false); }} className="w-36" />
              <Input type="date" value={customEnd} onChange={(e) => { setCustomEnd(e.target.value); setReportsLoaded(false); }} className="w-36" />
            </>
          )}
          <Button variant="gold" onClick={loadReports} disabled={loading}>
            {loading ? "Loading…" : "Generate Report"}
          </Button>
        </div>
      </PageHeader>

      {reportsLoaded && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Button variant="outline" size="sm" disabled={exportDisabled} onClick={exportSalesCSV}>
            <Download className="h-4 w-4 mr-1" /> Sales CSV
          </Button>
          <Button variant="outline" size="sm" disabled={exportDisabled} onClick={exportPaymentCSV}>
            <Download className="h-4 w-4 mr-1" /> Payments CSV
          </Button>
          <Button variant="outline" size="sm" disabled={exportDisabled} onClick={exportCashierCSV}>
            <Download className="h-4 w-4 mr-1" /> Cashiers CSV
          </Button>
          <Button variant="outline" size="sm" disabled={exportDisabled} onClick={exportProfitCSV}>
            <Download className="h-4 w-4 mr-1" /> Profit CSV
          </Button>
          <Button variant="outline" size="sm" disabled={exportDisabled} onClick={exportExpensesCSV}>
            <Download className="h-4 w-4 mr-1" /> Expenses CSV
          </Button>
          <Button variant="outline" size="sm" disabled={exportDisabled} onClick={exportInventoryCSV}>
            <Download className="h-4 w-4 mr-1" /> Inventory CSV
          </Button>
          <Button variant="outline" size="sm" disabled={exportDisabled} onClick={exportOccupancyCSV}>
            <Download className="h-4 w-4 mr-1" /> Occupancy CSV
          </Button>
          <Button variant="outline" size="sm" disabled={exportDisabled} onClick={exportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Sales Excel
          </Button>
        </div>
      )}

      {paymentSummary && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Daily Payment Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <div className="flex justify-between sm:flex-col sm:gap-1 p-2 rounded-lg bg-emerald-500/10">
              <span>{getPaymentMethodLabel("CASH")} Total</span>
              <span className="font-bold">{formatCurrency(paymentSummary.cash)}</span>
            </div>
            <div className="flex justify-between sm:flex-col sm:gap-1 p-2 rounded-lg bg-amber-500/10">
              <span>{getPaymentMethodLabel("MPESA")} Total</span>
              <span className="font-bold">{formatCurrency(paymentSummary.mpesa)}</span>
            </div>
            <div className="flex justify-between sm:flex-col sm:gap-1 p-2 rounded-lg bg-blue-500/10">
              <span>{getPaymentMethodLabel("CARD")} Total</span>
              <span className="font-bold">{formatCurrency(paymentSummary.card)}</span>
            </div>
            <div className="flex justify-between sm:flex-col sm:gap-1 p-2 rounded-lg bg-slate-500/10">
              <span>{getPaymentMethodLabel("BANK")} Total</span>
              <span className="font-bold">{formatCurrency(paymentSummary.bank)}</span>
            </div>
            {paymentSummary.splitOrderCount > 0 && (
              <div className="flex justify-between sm:flex-col sm:gap-1 p-2 rounded-lg border border-dashed">
                <span>Split orders</span>
                <span className="font-bold">{paymentSummary.splitOrderCount}</span>
              </div>
            )}
            {paymentSummary.legacySplit > 0 && (
              <div className="flex justify-between sm:flex-col sm:gap-1 p-2 rounded-lg border">
                <span>Legacy split rows</span>
                <span className="font-bold">{formatCurrency(paymentSummary.legacySplit)}</span>
              </div>
            )}
            <div className="flex justify-between sm:flex-col sm:gap-1 p-2 rounded-lg bg-gold/10 sm:col-span-2 lg:col-span-3">
              <span className="font-medium">Grand Total (payments)</span>
              <span className="font-bold text-gold text-lg">{formatCurrency(paymentSummary.total)}</span>
            </div>
            <div className="flex justify-between sm:flex-col sm:gap-1 text-muted-foreground sm:col-span-2 lg:col-span-3 text-xs">
              <span>Total sales (orders): {formatCurrency(paymentSummary.salesTotal)} • {paymentSummary.orderCount} orders</span>
            </div>
          </CardContent>
        </Card>
      )}

      {profitData && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <StatCard title="Revenue" value={profitData.revenue} icon={FileSpreadsheet} variant="gold" />
          <StatCard title="Cost of Goods" value={profitData.cost} icon={FileSpreadsheet} />
          <StatCard title="Expenses" value={profitData.expenses} icon={FileSpreadsheet} variant="danger" />
          <StatCard title="Net Profit" value={profitData.profit} icon={FileSpreadsheet} variant="emerald" />
        </div>
      )}

      {paymentMethodSales && reportsLoaded && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
          <StatCard title="Total Sales" value={totalRevenue} icon={FileSpreadsheet} variant="gold" />
          <StatCard title="Cash Sales" value={paymentMethodSales.cash} icon={FileSpreadsheet} variant="emerald" />
          <StatCard title="M-Pesa Sales" value={paymentMethodSales.mpesa} icon={FileSpreadsheet} />
          <StatCard title="Card Sales" value={paymentMethodSales.card} icon={FileSpreadsheet} />
          <StatCard title="Bank Sales" value={paymentMethodSales.bank} icon={FileSpreadsheet} />
        </div>
      )}

      {occupancyData && (
        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <StatCard title="Occupancy Rate" value={`${occupancyData.occupancyRate}%`} icon={BedDouble} variant="emerald" subtitle={`${occupancyData.totalRooms} total rooms`} />
          <StatCard title="Occupied Now" value={String(occupancyData.statusBreakdown.occupied)} icon={BedDouble} variant="gold" subtitle={`${occupancyData.statusBreakdown.available} available`} />
        </div>
      )}

      <Tabs defaultValue="sales">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="profit">Profit</TabsTrigger>
          <TabsTrigger value="cashiers">Cashiers</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-4">
          {!reportsLoaded ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Click Generate Report to load data</CardContent></Card>
          ) : salesData.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No completed sales in this period</CardContent></Card>
          ) : (
            <>
              <p className="text-lg font-bold mb-4">Total: {formatCurrency(totalRevenue)} ({salesData.length} orders)</p>
              <div className="space-y-2">
                {salesData.slice(0, 20).map((order) => (
                  <Card key={order.id}>
                    <CardContent className="p-3 flex flex-col sm:flex-row sm:justify-between gap-2">
                      <div>
                        <span className="font-medium text-sm">{order.orderNumber}</span>
                        <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)} • {order.user.name}</p>
                        {order.payments?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {order.payments.map((p) => (
                              <Badge key={p.id} variant="outline" className="text-[10px]">
                                {getPaymentMethodLabel(p.method)} {formatCurrency(p.amount)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="font-bold text-gold">{formatCurrency(order.total)}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="profit" className="mt-4">
          {!reportsLoaded || !profitData ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Click Generate Report to load data</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-6 space-y-3">
                <div className="flex justify-between"><span>Revenue</span><span className="font-bold text-gold">{formatCurrency(profitData.revenue)}</span></div>
                <div className="flex justify-between"><span>Cost of Goods</span><span>{formatCurrency(profitData.cost)}</span></div>
                <div className="flex justify-between"><span>Expenses</span><span className="text-red-400">{formatCurrency(profitData.expenses)}</span></div>
                <div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Net Profit</span><span className="text-emerald-400">{formatCurrency(profitData.profit)}</span></div>
                <p className="text-sm text-muted-foreground">{profitData.orderCount} orders in period</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="cashiers" className="mt-4">
          {!reportsLoaded ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Click Generate Report to load data</CardContent></Card>
          ) : cashierData.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No cashier data in this period</CardContent></Card>
          ) : (
            <>
              <Card className="mb-4">
                <CardHeader><CardTitle className="font-serif">Cashier Performance</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={cashierData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="revenue" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <div className="space-y-2">
                {cashierData.map((c) => (
                  <Card key={c.name}>
                    <CardContent className="p-4">
                      <div className="flex flex-wrap justify-between gap-2 mb-2">
                        <span className="font-medium">{c.name}</span>
                        <span className="font-bold text-gold">{formatCurrency(c.revenue)}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                        <span>{getPaymentMethodLabel("CASH")}: {formatCurrency(c.cash)}</span>
                        <span>{getPaymentMethodLabel("MPESA")}: {formatCurrency(c.mpesa)}</span>
                        <span>{getPaymentMethodLabel("CARD")}: {formatCurrency(c.card)}</span>
                        <span>{getPaymentMethodLabel("BANK")}: {formatCurrency(c.bank)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {c.orders} orders
                        {c.cancellations > 0 && ` • ${c.cancellations} cancelled`}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          {!reportsLoaded ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Click Generate Report to load data</CardContent></Card>
          ) : inventoryData.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No active products</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {inventoryData.map((p) => (
                <Card key={p.sku}>
                  <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-gold" />
                        <span className="font-medium">{p.name}</span>
                        {p.isLowStock && <Badge variant="destructive">Low Stock</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{p.category} • {p.sku}</p>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span>Stock: <strong>{p.stock}</strong></span>
                      <span>Cost: {formatCurrency(p.costValue)}</span>
                      <span>Retail: {formatCurrency(p.retailValue)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="occupancy" className="mt-4">
          {!reportsLoaded || !occupancyData ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Click Generate Report to load data</CardContent></Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="font-serif">Room Status</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={occupancyChart.filter((d) => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {occupancyChart.map((_, i) => (
                          <Cell key={i} fill={OCCUPANCY_COLORS[i % OCCUPANCY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="font-serif">Recent Bookings</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {occupancyData.bookings.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No bookings in period</p>
                  ) : (
                    occupancyData.bookings.slice(0, 10).map((b) => (
                      <div key={b.id} className="flex justify-between text-sm border-b pb-2">
                        <div>
                          <p className="font-medium">{b.guest.fullName}</p>
                          <p className="text-xs text-muted-foreground">Room {b.room.number}</p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <Badge variant="outline">{b.status.replace("_", " ")}</Badge>
                          <p>{formatDateOnly(b.checkIn)} – {formatDateOnly(b.checkOut)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
