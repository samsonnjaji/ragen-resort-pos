import { PageHeader, StatCard } from "@/components/layout/stat-card";
import {
  getDashboardStats,
  getRevenueTrend,
  getSalesByCategory,
  getTopProducts,
  getRoomOccupancy,
} from "@/lib/actions/dashboard";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  DollarSign,
  BedDouble,
  UtensilsCrossed,
  Wine,
  ShoppingBag,
  AlertTriangle,
  Banknote,
  Smartphone,
  CreditCard,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardCharts } from "@/components/dashboard/charts";

export default async function DashboardPage() {
  const [stats, revenueTrend, salesByCategory, topProducts, roomOccupancy] = await Promise.all([
    getDashboardStats(),
    getRevenueTrend(7),
    getSalesByCategory(),
    getTopProducts(),
    getRoomOccupancy(),
  ]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome to ${stats.settings.businessName} — Today's overview`}
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Today's Revenue" value={stats.todayRevenue} icon={DollarSign} variant="gold" />
        <StatCard title="Today Cash" value={stats.todayCash} icon={Banknote} variant="emerald" />
        <StatCard title="Today M-Pesa" value={stats.todayMpesa} icon={Smartphone} />
        <StatCard title="Today Card/Bank" value={stats.todayCardBank} icon={CreditCard} />
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <StatCard title="Room Revenue" value={stats.roomRevenue} icon={BedDouble} variant="emerald" />
        <StatCard title="Food Revenue" value={stats.foodRevenue} icon={UtensilsCrossed} />
        <StatCard title="Bar Revenue" value={stats.barRevenue} icon={Wine} />
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Today's Orders" value={stats.todayOrderCount} icon={ShoppingBag} subtitle="Completed sales" />
        <StatCard title="Occupied Rooms" value={stats.occupiedRooms} icon={BedDouble} variant="danger" subtitle={`of ${stats.totalRooms} total`} />
        <StatCard title="Available Rooms" value={stats.availableRooms} icon={BedDouble} variant="emerald" />
        <StatCard title="Low Stock Alerts" value={stats.lowStock.length} icon={AlertTriangle} variant="danger" subtitle="Products need restocking" />
      </div>

      <DashboardCharts
        revenueTrend={revenueTrend}
        salesByCategory={salesByCategory}
        topProducts={topProducts}
        roomOccupancy={roomOccupancy}
      />

      <div className="grid gap-6 lg:grid-cols-2 mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif">Low Stock Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.lowStock.length === 0 ? (
              <p className="text-muted-foreground text-sm">All products are well stocked</p>
            ) : (
              <div className="space-y-3">
                {stats.lowStock.slice(0, 5).map((product) => (
                  <div key={product.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.sku}</p>
                    </div>
                    <Badge variant="destructive">{product.stock} left</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentActivity.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {stats.recentActivity.map((log) => (
                  <div key={log.id} className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm">
                        <span className="font-medium">{log.action}</span>{" "}
                        <span className="text-muted-foreground">{log.entity}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.user?.name || "System"} • {formatDate(log.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
