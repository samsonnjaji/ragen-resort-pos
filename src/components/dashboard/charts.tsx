"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const COLORS = ["#059669", "#D4AF37", "#3B82F6", "#EF4444", "#8B5CF6", "#F59E0B"];

interface DashboardChartsProps {
  revenueTrend: { date: string; revenue: number }[];
  salesByCategory: { name: string; value: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  roomOccupancy: { name: string; value: number }[];
}

export function DashboardCharts({
  revenueTrend,
  salesByCategory,
  topProducts,
  roomOccupancy,
}: DashboardChartsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-serif">Revenue Trend (7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ background: "#1a1a1a", border: "1px solid #374151" }} />
              <Line type="monotone" dataKey="revenue" stroke="#D4AF37" strokeWidth={2} dot={{ fill: "#D4AF37" }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-serif">Sales by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {salesByCategory.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-16">No sales data today</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={salesByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name}>
                  {salesByCategory.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-serif">Top Products</CardTitle>
        </CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-16">No sales data today</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="revenue" fill="#059669" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-serif">Room Occupancy</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={roomOccupancy.filter((r) => r.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                {roomOccupancy.map((entry, i) => {
                  const colorMap: Record<string, string> = {
                    Available: "#10B981",
                    Occupied: "#EF4444",
                    Reserved: "#EAB308",
                    Cleaning: "#3B82F6",
                    Maintenance: "#6B7280",
                  };
                  return <Cell key={i} fill={colorMap[entry.name] || COLORS[i % COLORS.length]} />;
                })}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
