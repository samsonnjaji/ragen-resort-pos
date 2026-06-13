"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function logActivity(
  action: string,
  entity: string,
  entityId?: string,
  details?: string,
  metadata?: Record<string, string | number | boolean | null | undefined>
) {
  const session = await getSession();
  const payload = {
    message: details ?? null,
    userEmail: session?.user?.email ?? null,
    ...metadata,
  };

  await prisma.activityLog.create({
    data: {
      userId: session?.user?.id,
      action,
      entity,
      entityId,
      details: JSON.stringify(payload),
    },
  });
}

export async function getSettings() {
  let settings = await prisma.settings.findUnique({ where: { id: "default" } });
  if (!settings) {
    settings = await prisma.settings.create({ data: { id: "default" } });
  }
  return settings;
}

export async function updateSettings(data: {
  businessName?: string;
  businessAddress?: string;
  phone?: string;
  email?: string;
  receiptFooter?: string;
  receiptSize?: string;
  receiptAlignment?: string;
  receiptCompact?: boolean;
  receiptFontSize?: string;
  receiptBoldText?: boolean;
  receiptSpacing?: string;
  taxRate?: number;
  currency?: string;
}) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  const settings = await prisma.settings.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  });

  await logActivity("UPDATE", "Settings", "default");
  revalidatePath("/settings");
  revalidatePath("/settings/hardware");
  return settings;
}

export async function getDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    todayOrders,
    rooms,
    lowStockProducts,
    recentActivity,
    settings,
    roomBillingStats,
  ] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: { gte: today, lt: tomorrow },
        status: "COMPLETED",
      },
      include: {
        items: { include: { product: { include: { category: true } } } },
        payments: true,
      },
    }),
    prisma.room.findMany(),
    prisma.product.findMany({
      where: { status: "ACTIVE" },
    }),
    prisma.activityLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    }),
    getSettings(),
    import("./room-billing").then((m) => m.getTodayRoomBillingStats()),
  ]);

  const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);
  const todayOrderCount = todayOrders.length;

  let todayCash = 0;
  let todayMpesa = 0;
  let todayCardBank = 0;

  for (const order of todayOrders) {
    for (const p of order.payments) {
      switch (p.method) {
        case "CASH":
          todayCash += p.amount;
          break;
        case "MPESA":
          todayMpesa += p.amount;
          break;
        case "CARD":
        case "BANK":
          todayCardBank += p.amount;
          break;
        default:
          break;
      }
    }
  }

  let roomRevenue = 0;
  let foodRevenue = 0;
  let barRevenue = 0;

  for (const order of todayOrders) {
    if (order.type === "ROOM_SERVICE" || order.roomId) {
      roomRevenue += order.total;
    }
    for (const item of order.items) {
      const catType = item.product?.category?.type;
      if (!catType) continue;
      if (catType === "FOOD" || catType === "ROOM_SERVICE") {
        foodRevenue += item.total;
      } else if (catType === "BAR" || catType === "ALCOHOL") {
        barRevenue += item.total;
      }
    }
  }

  const occupiedRooms = rooms.filter((r) => r.status === "OCCUPIED").length;
  const availableRooms = rooms.filter((r) => r.status === "AVAILABLE").length;
  const lowStock = lowStockProducts.filter((p) => p.stock <= p.lowStockAlert);

  return {
    todayRevenue,
    todayCash: Math.round(todayCash * 100) / 100,
    todayMpesa: Math.round(todayMpesa * 100) / 100,
    todayCardBank: Math.round(todayCardBank * 100) / 100,
    roomRevenue,
    foodRevenue,
    barRevenue,
    todayOrderCount,
    occupiedRooms,
    availableRooms,
    totalRooms: rooms.length,
    lowStock,
    recentActivity,
    settings,
    todayRoomCheckoutRevenue: roomBillingStats.todayRoomRevenue,
    todayPostedRoomCharges: roomBillingStats.todayPostedCharges,
    outstandingRoomBalances: roomBillingStats.outstandingBalances,
    outstandingRoomCount: roomBillingStats.outstandingCount,
  };
}

export async function getRevenueTrend(days = 7) {
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: date, lt: nextDate },
        status: "COMPLETED",
      },
    });

    data.push({
      date: date.toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric" }),
      revenue: orders.reduce((sum, o) => sum + o.total, 0),
    });
  }
  return data;
}

export async function getSalesByCategory() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        createdAt: { gte: today },
        status: "COMPLETED",
      },
    },
    include: { product: { include: { category: true } } },
  });

  const categoryMap = new Map<string, number>();
  for (const item of items) {
    const name = item.product?.category?.name ?? "Uncategorized";
    categoryMap.set(name, (categoryMap.get(name) || 0) + item.total);
  }

  return Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
}

export async function getTopProducts() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [items, roomProductCharges] = await Promise.all([
    prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: today },
          status: "COMPLETED",
        },
      },
      include: { product: true },
    }),
    prisma.roomCharge.findMany({
      where: {
        createdAt: { gte: today },
        voidedAt: null,
        productId: { not: null },
      },
      include: { product: true },
    }),
  ]);

  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const item of items) {
    if (!item.product) continue;
    const existing = productMap.get(item.productId) || {
      name: item.product.name,
      quantity: 0,
      revenue: 0,
    };
    existing.quantity += item.quantity;
    existing.revenue += item.total;
    productMap.set(item.productId, existing);
  }

  for (const charge of roomProductCharges) {
    if (!charge.productId || !charge.product) continue;
    const existing = productMap.get(charge.productId) || {
      name: charge.product.name,
      quantity: 0,
      revenue: 0,
    };
    existing.quantity += charge.quantity;
    existing.revenue += charge.total;
    productMap.set(charge.productId, existing);
  }

  return Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
}

export async function getRoomOccupancy() {
  const rooms = await prisma.room.findMany();
  const statusCounts = {
    Available: rooms.filter((r) => r.status === "AVAILABLE").length,
    Occupied: rooms.filter((r) => r.status === "OCCUPIED").length,
    Reserved: rooms.filter((r) => r.status === "RESERVED").length,
    Cleaning: rooms.filter((r) => r.status === "CLEANING").length,
    Maintenance: rooms.filter((r) => r.status === "MAINTENANCE").length,
  };

  return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
}
