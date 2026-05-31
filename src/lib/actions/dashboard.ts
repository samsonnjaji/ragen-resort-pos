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
  details?: string
) {
  const session = await getSession();
  await prisma.activityLog.create({
    data: {
      userId: session?.user?.id,
      action,
      entity,
      entityId,
      details,
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
  ] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: { gte: today, lt: tomorrow },
        status: "COMPLETED",
      },
      include: { items: { include: { product: { include: { category: true } } } } },
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
  ]);

  const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);
  const todayOrderCount = todayOrders.length;

  let roomRevenue = 0;
  let foodRevenue = 0;
  let barRevenue = 0;

  for (const order of todayOrders) {
    if (order.type === "ROOM_SERVICE" || order.roomId) {
      roomRevenue += order.total;
    }
    for (const item of order.items) {
      const catType = item.product.category.type;
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
    const name = item.product.category.name;
    categoryMap.set(name, (categoryMap.get(name) || 0) + item.total);
  }

  return Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
}

export async function getTopProducts() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        createdAt: { gte: today },
        status: "COMPLETED",
      },
    },
    include: { product: true },
  });

  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const item of items) {
    const existing = productMap.get(item.productId) || {
      name: item.product.name,
      quantity: 0,
      revenue: 0,
    };
    existing.quantity += item.quantity;
    existing.revenue += item.total;
    productMap.set(item.productId, existing);
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
