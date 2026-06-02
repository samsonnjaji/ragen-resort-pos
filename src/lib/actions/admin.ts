"use server";

import prisma from "@/lib/prisma";
import { getSession, logActivity } from "./dashboard";
import { revalidatePath } from "next/cache";
import { generatePurchaseNumber } from "@/lib/utils";
import { ExpenseCategory, PurchaseStatus } from "@prisma/client";
import { getDateRange } from "@/lib/utils";
import { AppError } from "@/lib/app-error";
import { aggregatePaymentTotals } from "@/lib/payments";
import { PaymentMethod } from "@prisma/client";

export async function getExpenses(filter = "month") {
  const { start, end } = getDateRange(filter === "today" ? "today" : filter === "week" ? "week" : "month");

  return prisma.expense.findMany({
    where: { date: { gte: start, lte: end } },
    orderBy: { date: "desc" },
  });
}

export async function createExpense(data: {
  category: ExpenseCategory;
  description: string;
  amount: number;
  date?: Date;
  reference?: string;
}) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  const expense = await prisma.expense.create({ data });
  await logActivity("CREATE", "Expense", expense.id);
  revalidatePath("/expenses");
  return expense;
}

export async function updateExpense(
  id: string,
  data: Partial<{
    category: ExpenseCategory;
    description: string;
    amount: number;
    date: Date;
    reference: string;
  }>
) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new AppError("Unauthorized");

  const expense = await prisma.expense.update({ where: { id }, data });
  await logActivity("UPDATE", "Expense", id);
  revalidatePath("/expenses");
  return expense;
}

export async function deleteExpense(id: string) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.expense.delete({ where: { id } });
  await logActivity("DELETE", "Expense", id);
  revalidatePath("/expenses");
}

export async function getExpenseSummary() {
  const today = getDateRange("today");
  const month = getDateRange("month");

  const [dailyExpenses, monthlyExpenses] = await Promise.all([
    prisma.expense.aggregate({
      where: { date: { gte: today.start, lte: today.end } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { date: { gte: month.start, lte: month.end } },
      _sum: { amount: true },
    }),
  ]);

  return {
    daily: dailyExpenses._sum.amount || 0,
    monthly: monthlyExpenses._sum.amount || 0,
  };
}

export async function getSuppliers() {
  return prisma.supplier.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createSupplier(data: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  const supplier = await prisma.supplier.create({ data });
  await logActivity("CREATE", "Supplier", supplier.id);
  revalidatePath("/purchases");
  return supplier;
}

export async function updateSupplier(
  id: string,
  data: Partial<{ name: string; phone: string; email: string; address: string; active: boolean }>
) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new AppError("Unauthorized");

  const supplier = await prisma.supplier.update({ where: { id }, data });
  await logActivity("UPDATE", "Supplier", id, supplier.name);
  revalidatePath("/purchases");
  return supplier;
}

export async function deleteSupplier(id: string) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new AppError("Unauthorized");

  const pending = await prisma.purchase.count({
    where: { supplierId: id, status: PurchaseStatus.PENDING },
  });
  if (pending > 0) {
    throw new AppError("Cannot delete supplier — pending purchase orders exist.");
  }

  await prisma.supplier.update({ where: { id }, data: { active: false } });
  await logActivity("DELETE", "Supplier", id, "Deactivated");
  revalidatePath("/purchases");
}

export async function getPurchases() {
  return prisma.purchase.findMany({
    include: {
      supplier: true,
      items: { include: { product: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createPurchase(data: {
  supplierId: string;
  items: { productId: string; quantity: number; unitCost: number }[];
  notes?: string;
}) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  const totalAmount = data.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);

  const purchase = await prisma.purchase.create({
    data: {
      supplierId: data.supplierId,
      purchaseNumber: generatePurchaseNumber(),
      totalAmount,
      notes: data.notes,
      items: {
        create: data.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          total: item.quantity * item.unitCost,
        })),
      },
    },
    include: { supplier: true, items: { include: { product: true } } },
  });

  await logActivity("CREATE", "Purchase", purchase.id, purchase.purchaseNumber);
  revalidatePath("/purchases");
  return purchase;
}

export async function receivePurchase(id: string) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!purchase) throw new Error("Purchase not found");

  await prisma.$transaction(async (tx) => {
    for (const item of purchase.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          type: "STOCK_IN",
          quantity: item.quantity,
          reason: "Purchase Received",
          reference: purchase.purchaseNumber,
          userId: session!.user!.id,
        },
      });
    }

    await tx.purchase.update({
      where: { id },
      data: { status: PurchaseStatus.RECEIVED, receivedAt: new Date() },
    });
  });

  await logActivity("RECEIVE", "Purchase", id);
  revalidatePath("/purchases");
  revalidatePath("/inventory");
}

export async function deletePurchase(id: string) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new AppError("Unauthorized");

  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!purchase) throw new AppError("Purchase not found");

  if (purchase.status === PurchaseStatus.RECEIVED) {
    await prisma.$transaction(async (tx) => {
      for (const item of purchase.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) continue;
        const newStock = Math.max(0, product.stock - item.quantity);
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: newStock },
        });
        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: "STOCK_OUT",
            quantity: -item.quantity,
            reason: "Purchase deleted — stock reversed",
            reference: purchase.purchaseNumber,
            userId: session!.user!.id,
          },
        });
      }
      await tx.purchase.update({
        where: { id },
        data: { status: PurchaseStatus.CANCELLED },
      });
    });
    await logActivity("DELETE", "Purchase", id, `${purchase.purchaseNumber} — stock reversed`);
  } else if (purchase.status === PurchaseStatus.PENDING) {
    await prisma.purchase.delete({ where: { id } });
    await logActivity("DELETE", "Purchase", id, purchase.purchaseNumber);
  } else {
    throw new AppError("Purchase is already cancelled.");
  }

  revalidatePath("/purchases");
  revalidatePath("/inventory");
}

export async function getPaymentSummary(filter: string, startDate?: Date, endDate?: Date) {
  const orders = await getSalesReport(filter, startDate, endDate);
  const totals = aggregatePaymentTotals(orders);
  const splitOrderCount = orders.filter(
    (o) =>
      o.payments.length > 1 ||
      o.payments.some((p) => p.method === PaymentMethod.SPLIT)
  ).length;
  const salesTotal = orders.reduce((s, o) => s + o.total, 0);

  return {
    ...totals,
    salesTotal,
    orderCount: orders.length,
    splitOrderCount,
  };
}

export async function getSalesReport(filter: string, startDate?: Date, endDate?: Date) {
  let start: Date;
  let end: Date;

  if (filter === "custom" && startDate && endDate) {
    start = startDate;
    end = endDate;
    end.setHours(23, 59, 59, 999);
  } else {
    const range = getDateRange(filter);
    start = range.start;
    end = range.end;
  }

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      status: "COMPLETED",
    },
    include: {
      items: { include: { product: { include: { category: true } } } },
      payments: true,
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders;
}

export async function getProfitReport(filter: string) {
  const { start, end } = getDateRange(filter);

  const [orders, expenses] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end }, status: "COMPLETED" },
      include: { items: { include: { product: true } } },
    }),
    prisma.expense.findMany({
      where: { date: { gte: start, lte: end } },
    }),
  ]);

  const revenue = orders.reduce((sum, o) => sum + o.total, 0);
  const cost = orders.reduce(
    (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity * i.product.costPrice, 0),
    0
  );
  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const profit = revenue - cost - expenseTotal;

  return { revenue, cost, expenses: expenseTotal, profit, orderCount: orders.length };
}

export async function getCashierPerformance(filter: string) {
  const { start, end } = getDateRange(filter);

  const [orders, cancelled] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end }, status: "COMPLETED" },
      include: {
        user: { select: { id: true, name: true } },
        payments: true,
      },
    }),
    prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: "CANCELLED",
      },
      select: { userId: true },
    }),
  ]);

  const cancelCountByUser = new Map<string, number>();
  for (const o of cancelled) {
    cancelCountByUser.set(o.userId, (cancelCountByUser.get(o.userId) ?? 0) + 1);
  }

  const cashierMap = new Map<
    string,
    {
      name: string;
      orders: number;
      revenue: number;
      cash: number;
      mpesa: number;
      card: number;
      bank: number;
      cancellations: number;
    }
  >();

  for (const order of orders) {
    const existing = cashierMap.get(order.userId) || {
      name: order.user.name,
      orders: 0,
      revenue: 0,
      cash: 0,
      mpesa: 0,
      card: 0,
      bank: 0,
      cancellations: cancelCountByUser.get(order.userId) ?? 0,
    };
    existing.orders += 1;
    existing.revenue += order.total;
    for (const p of order.payments) {
      switch (p.method) {
        case "CASH":
          existing.cash += p.amount;
          break;
        case "MPESA":
          existing.mpesa += p.amount;
          break;
        case "CARD":
          existing.card += p.amount;
          break;
        case "BANK":
          existing.bank += p.amount;
          break;
        default:
          break;
      }
    }
    cashierMap.set(order.userId, existing);
  }

  for (const [userId, count] of cancelCountByUser) {
    if (!cashierMap.has(userId)) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      if (user) {
        cashierMap.set(userId, {
          name: user.name,
          orders: 0,
          revenue: 0,
          cash: 0,
          mpesa: 0,
          card: 0,
          bank: 0,
          cancellations: count,
        });
      }
    }
  }

  return Array.from(cashierMap.values())
    .map((c) => ({
      ...c,
      cash: Math.round(c.cash * 100) / 100,
      mpesa: Math.round(c.mpesa * 100) / 100,
      card: Math.round(c.card * 100) / 100,
      bank: Math.round(c.bank * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export async function getInventoryReport() {
  const products = await prisma.product.findMany({
    where: { isActive: true, deletedAt: null, status: "ACTIVE" },
    include: { category: true },
    orderBy: { name: "asc" },
  });

  return products.map((p) => ({
    name: p.name,
    sku: p.sku,
    category: p.category.name,
    stock: p.stock,
    lowStockAlert: p.lowStockAlert,
    costValue: p.stock * p.costPrice,
    retailValue: p.stock * p.sellingPrice,
    isLowStock: p.stock <= p.lowStockAlert,
  }));
}

export async function getOccupancyReport(filter: string) {
  const { start, end } = getDateRange(filter);

  const [rooms, bookings] = await Promise.all([
    prisma.room.findMany({ orderBy: { number: "asc" } }),
    prisma.booking.findMany({
      where: {
        OR: [
          { checkIn: { gte: start, lte: end } },
          { checkOut: { gte: start, lte: end } },
          { status: "CHECKED_IN" },
        ],
      },
      include: { guest: true, room: true },
    }),
  ]);

  const statusBreakdown = {
    available: rooms.filter((r) => r.status === "AVAILABLE").length,
    occupied: rooms.filter((r) => r.status === "OCCUPIED").length,
    reserved: rooms.filter((r) => r.status === "RESERVED").length,
    cleaning: rooms.filter((r) => r.status === "CLEANING").length,
    maintenance: rooms.filter((r) => r.status === "MAINTENANCE").length,
  };

  const occupancyRate =
    rooms.length > 0
      ? Math.round(((statusBreakdown.occupied + statusBreakdown.reserved) / rooms.length) * 100)
      : 0;

  return { rooms, bookings, statusBreakdown, occupancyRate, totalRooms: rooms.length };
}

export async function getUsers() {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { name: "asc" },
  });
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role: string;
}) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  const bcrypt = await import("bcryptjs");
  const hashedPassword = await bcrypt.hash(data.password, 12);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: data.role as "ADMIN" | "CASHIER" | "RESTAURANT" | "BAR" | "ROOM_MANAGER",
    },
  });

  await logActivity("CREATE", "User", user.id, user.name);
  revalidatePath("/users");
  return user;
}

export async function updateUser(
  id: string,
  data: Partial<{ name: string; email: string; role: string; active: boolean; password?: string }>
) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new AppError("Unauthorized");

  if (data.active === false) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (existing?.role === "ADMIN") {
      const otherAdmins = await prisma.user.count({
        where: { role: "ADMIN", active: true, id: { not: id } },
      });
      if (otherAdmins === 0) {
        throw new AppError("Cannot deactivate the last admin account.");
      }
    }
  }

  const updateData: Record<string, unknown> = { ...data };
  delete updateData.password;

  if (data.password) {
    const bcrypt = await import("bcryptjs");
    updateData.password = await bcrypt.hash(data.password, 12);
  }

  if (data.role) {
    updateData.role = data.role;
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
  });

  await logActivity("UPDATE", "User", id);
  revalidatePath("/users");
  return user;
}
