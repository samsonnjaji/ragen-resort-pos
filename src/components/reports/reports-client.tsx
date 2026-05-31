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
} from "@/lib/actions/admin";
import { formatCurrency, formatDate, formatDateOnly } from "@/lib/utils";
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

export function ReportsClient() {
  const [filter, setFilter] = useState("today");
  const [salesData, setSalesData] = useState<Awaited<ReturnType<typeof getSalesReport>>>([]);
  const [profitData, setProfitData] = useState<Awaited<ReturnType<typeof getProfitReport>> | null>(null);
  const [cashierData, setCashierData] = useState<Awaited<ReturnType<typeof getCashierPerformance>>>([]);
  const [inventoryData, setInventoryData] = useState<Awaited<ReturnType<typeof getInventoryReport>>>([]);
  const [occupancyData, setOccupancyData] = useState<Awaited<ReturnType<typeof getOccupancyReport>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const loadReports = async () => {
    setLoading(true);
    try {
      const start = filter === "custom" && customStart ? new Date(customStart) : undefined;
      const end = filter === "custom" && customEnd ? new Date(customEnd) : undefined;

      const [sales, profit, cashiers, inventory, occupancy] = await Promise.all([
        getSalesReport(filter, start, end),
        getProfitReport(filter),
        getCashierPerformance(filter),
        getInventoryReport(),
        getOccupancyReport(filter),
      ]);
      setSalesData(sales);
      setProfitData(profit);
      setCashierData(cashiers);
      setInventoryData(inventory);
      setOccupancyData(occupancy);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = (filename: string, headers: string, rows: string[]) => {
    const blob = new Blob([headers + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  const exportSalesCSV = () => {
    exportCSV(
      `sales-report-${filter}.csv`,
      "Order Number,Date,Total,Status,Cashier\n",
      salesData.map((o) =>
        `${o.orderNumber},${formatDate(o.createdAt)},${o.total},${o.status},${o.user.name}`
      )
    );
  };

  const exportInventoryCSV = () => {
    exportCSV(
      "inventory-report.csv",
      "Product,SKU,Category,Stock,Low Alert,Cost Value,Retail Value,Low Stock\n",
      inventoryData.map((p) =>
        `${p.name},${p.sku},${p.category},${p.stock},${p.lowStockAlert},${p.costValue},${p.retailValue},${p.isLowStock}`
      )
    );
  };

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const rows = salesData.map((o) => ({
      "Order Number": o.orderNumber,
      Date: formatDate(o.createdAt),
      Total: o.total,
      Status: o.status,
      Cashier: o.user.name,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales");
    XLSX.writeFile(wb, `sales-report-${filter}.xlsx`);
  };

  const totalRevenue = salesData.reduce((s, o) => s + o.total, 0);
  const occupancyChart = occupancyData
    ? Object.entries(occupancyData.statusBreakdown).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
      }))
    : [];

  return (
    <div>
      <PageHeader title="Reports" description="Business analytics and exports">
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={filter} onValueChange={setFilter}>
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
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-36" />
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-36" />
            </>
          )}
          <Button variant="gold" onClick={loadReports} disabled={loading}>
            Generate Report
          </Button>
        </div>
      </PageHeader>

      {profitData && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <StatCard title="Revenue" value={profitData.revenue} icon={FileSpreadsheet} variant="gold" />
          <StatCard title="Cost of Goods" value={profitData.cost} icon={FileSpreadsheet} />
          <StatCard title="Expenses" value={profitData.expenses} icon={FileSpreadsheet} variant="danger" />
          <StatCard title="Net Profit" value={profitData.profit} icon={FileSpreadsheet} variant="emerald" />
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
          <div className="flex gap-2 mb-4">
            {salesData.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={exportSalesCSV}><Download className="h-4 w-4 mr-1" /> CSV</Button>
                <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
              </>
            )}
          </div>
          {salesData.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Click Generate Report to load data</CardContent></Card>
          ) : (
            <>
              <p className="text-lg font-bold mb-4">Total: {formatCurrency(totalRevenue)} ({salesData.length} orders)</p>
              <div className="space-y-2">
                {salesData.slice(0, 20).map((order) => (
                  <Card key={order.id}>
                    <CardContent className="p-3 flex justify-between">
                      <div>
                        <span className="font-medium text-sm">{order.orderNumber}</span>
                        <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)} • {order.user.name}</p>
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
          {!profitData ? (
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
          {cashierData.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Click Generate Report to load data</CardContent></Card>
          ) : (
            <Card>
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
          )}
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          <div className="flex gap-2 mb-4">
            {inventoryData.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportInventoryCSV}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
            )}
          </div>
          {inventoryData.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Click Generate Report to load data</CardContent></Card>
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
          {!occupancyData ? (
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
