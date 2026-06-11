"use server";

import prisma from "@/lib/prisma";
import { resolveReportDateRange } from "@/lib/utils";
import { getSession } from "./dashboard";
import { getSalesReport, getProfitReport, getCashierPerformance, getInventoryReport, getOccupancyReport, getPaymentSummary, getExpensesForReport } from "./admin";
import { AppError } from "@/lib/app-error";

async function requireAdmin() {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new AppError("Unauthorized");
  return session;
}

export async function getSalesReportAnalytics(filter: string, startDate?: Date, endDate?: Date) {
  await requireAdmin();
  const orders = await getSalesReport(filter, startDate, endDate);

  const dayMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();
  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();

  for (const order of orders) {
    const dayKey = new Date(order.createdAt).toLocaleDateString("en-KE", {
      month: "short",
      day: "numeric",
    });
    dayMap.set(dayKey, (dayMap.get(dayKey) ?? 0) + order.total);

    for (const item of order.items) {
      const catName = item.product?.category?.name ?? "Uncategorized";
      categoryMap.set(catName, (categoryMap.get(catName) ?? 0) + item.total);

      if (!item.product) continue;
      const existing = productMap.get(item.productId) ?? {
        name: item.product.name,
        quantity: 0,
        revenue: 0,
      };
      existing.quantity += item.quantity;
      existing.revenue += item.total;
      productMap.set(item.productId, existing);
    }
  }

  const revenueByDay = Array.from(dayMap.entries()).map(([date, revenue]) => ({ date, revenue }));
  const salesByCategory = Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return {
    orders,
    revenueByDay,
    salesByCategory,
    topProducts,
    totalRevenue: orders.reduce((s, o) => s + o.total, 0),
    orderCount: orders.length,
  };
}

export async function getStockMovementReport(filter: string, startDate?: Date, endDate?: Date) {
  await requireAdmin();
  const { start, end } = resolveReportDateRange(filter, startDate, endDate);

  return prisma.inventoryMovement.findMany({
    where: { createdAt: { gte: start, lte: end } },
    include: {
      product: { select: { name: true, sku: true, category: { select: { name: true } } } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProductPerformanceReport(filter: string, startDate?: Date, endDate?: Date) {
  await requireAdmin();
  const { start, end } = resolveReportDateRange(filter, startDate, endDate);

  const [items, roomCharges] = await Promise.all([
    prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: start, lte: end },
          status: "COMPLETED",
        },
      },
      include: {
        product: { include: { category: true } },
      },
    }),
    prisma.roomCharge.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        voidedAt: null,
        productId: { not: null },
      },
      include: { product: { include: { category: true } } },
    }),
  ]);

  const map = new Map<
    string,
    {
      name: string;
      sku: string;
      category: string;
      quantity: number;
      revenue: number;
      cost: number;
    }
  >();

  for (const item of items) {
    if (!item.product) continue;
    const existing = map.get(item.productId) ?? {
      name: item.product.name,
      sku: item.product.sku,
      category: item.product.category?.name ?? "Unknown",
      quantity: 0,
      revenue: 0,
      cost: 0,
    };
    existing.quantity += item.quantity;
    existing.revenue += item.total;
    existing.cost += item.quantity * (item.product.costPrice ?? 0);
    map.set(item.productId, existing);
  }

  for (const charge of roomCharges) {
    if (!charge.productId || !charge.product) continue;
    const existing = map.get(charge.productId) ?? {
      name: charge.product.name,
      sku: charge.product.sku,
      category: charge.product.category?.name ?? "Unknown",
      quantity: 0,
      revenue: 0,
      cost: 0,
    };
    existing.quantity += charge.quantity;
    existing.revenue += charge.total;
    existing.cost += charge.quantity * (charge.product.costPrice ?? 0);
    map.set(charge.productId, existing);
  }

  return Array.from(map.values())
    .map((p) => ({
      ...p,
      margin: p.revenue - p.cost,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export async function getInventoryAnalytics() {
  await requireAdmin();
  const products = await getInventoryReport();

  const categoryValue = new Map<string, { cost: number; retail: number }>();
  for (const p of products) {
    const existing = categoryValue.get(p.category) ?? { cost: 0, retail: 0 };
    existing.cost += p.costValue;
    existing.retail += p.retailValue;
    categoryValue.set(p.category, existing);
  }

  const stockByCategory = Array.from(categoryValue.entries()).map(([name, v]) => ({
    name,
    costValue: v.cost,
    retailValue: v.retail,
  }));

  const lowStock = products
    .filter((p) => p.isLowStock)
    .map((p) => ({ name: p.name, stock: p.stock, alert: p.lowStockAlert }));

  return { products, stockByCategory, lowStock };
}

export async function getRoomRevenueTable(filter: string, startDate?: Date, endDate?: Date) {
  await requireAdmin();
  const { start, end } = resolveReportDateRange(filter, startDate, endDate);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      status: "COMPLETED",
      roomId: { not: null },
    },
    include: { room: { select: { number: true, type: true } } },
    orderBy: { createdAt: "desc" },
  });

  const roomMap = new Map<string, { number: string; type: string; orders: number; revenue: number }>();
  for (const o of orders) {
    if (!o.room) continue;
    const key = o.roomId!;
    const existing = roomMap.get(key) ?? {
      number: o.room.number,
      type: o.room.type,
      orders: 0,
      revenue: 0,
    };
    existing.orders += 1;
    existing.revenue += o.total;
    roomMap.set(key, existing);
  }

  return Array.from(roomMap.values()).sort((a, b) => b.revenue - a.revenue);
}
