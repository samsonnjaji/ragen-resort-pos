"use server";

import prisma from "@/lib/prisma";
import { getSession, logActivity } from "./dashboard";
import { revalidatePath } from "next/cache";
import { generateOrderNumber } from "@/lib/utils";
import {
  InventoryType,
  OrderStatus,
  OrderType,
  PaymentMethod,
  ProductStatus,
} from "@prisma/client";

export async function getProducts(categoryId?: string) {
  return prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      ...(categoryId ? { categoryId } : {}),
    },
    include: { category: true },
    orderBy: { name: "asc" },
  });
}

export async function getCategories() {
  return prisma.category.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
}

export async function getProduct(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: { category: true },
  });
}

export async function createProduct(data: {
  name: string;
  sku: string;
  barcode?: string;
  sellingPrice: number;
  costPrice: number;
  stock: number;
  lowStockAlert: number;
  categoryId: string;
}) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  const product = await prisma.product.create({ data });
  await logActivity("CREATE", "Product", product.id, product.name);
  revalidatePath("/products");
  return product;
}

export async function updateProduct(
  id: string,
  data: Partial<{
    name: string;
    sku: string;
    barcode: string;
    sellingPrice: number;
    costPrice: number;
    stock: number;
    lowStockAlert: number;
    categoryId: string;
    status: ProductStatus;
  }>
) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  const product = await prisma.product.update({ where: { id }, data });
  await logActivity("UPDATE", "Product", id);
  revalidatePath("/products");
  return product;
}

export async function deleteProduct(id: string) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.product.update({
    where: { id },
    data: { status: ProductStatus.INACTIVE },
  });
  await logActivity("DELETE", "Product", id);
  revalidatePath("/products");
}

export async function createCategory(data: { name: string; description?: string; type?: string }) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  const category = await prisma.category.create({ data });
  await logActivity("CREATE", "Category", category.id, category.name);
  revalidatePath("/products");
  return category;
}

export async function completeSale(data: {
  items: { productId: string; quantity: number; unitPrice: number }[];
  discount: number;
  tax: number;
  payments: { method: PaymentMethod; amount: number; reference?: string }[];
  type?: OrderType;
  notes?: string;
  roomId?: string;
  bookingId?: string;
}) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const subtotal = data.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const total = subtotal - data.discount + data.tax;

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        type: data.type || OrderType.POS,
        status: OrderStatus.COMPLETED,
        subtotal,
        discount: data.discount,
        tax: data.tax,
        total,
        notes: data.notes,
        roomId: data.roomId,
        bookingId: data.bookingId,
        userId: session.user.id,
        completedAt: new Date(),
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
          })),
        },
        payments: {
          create: data.payments.map((p) => ({
            method: p.method,
            amount: p.amount,
            reference: p.reference,
            userId: session.user.id,
          })),
        },
      },
      include: {
        items: { include: { product: true } },
        payments: true,
        user: { select: { name: true } },
      },
    });

    for (const item of data.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          type: InventoryType.SALE,
          quantity: -item.quantity,
          reason: "POS Sale",
          reference: newOrder.orderNumber,
          userId: session.user.id,
        },
      });
    }

    return newOrder;
  });

  await logActivity("CREATE", "Order", order.id, order.orderNumber);
  revalidatePath("/pos");
  revalidatePath("/dashboard");
  revalidatePath("/orders");
  return order;
}

export async function holdSale(data: {
  items: { productId: string; quantity: number; unitPrice: number }[];
  discount: number;
  tax: number;
  notes?: string;
}) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const subtotal = data.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const total = subtotal - data.discount + data.tax;

  const order = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      type: OrderType.POS,
      status: OrderStatus.ON_HOLD,
      subtotal,
      discount: data.discount,
      tax: data.tax,
      total,
      notes: data.notes,
      userId: session.user.id,
      items: {
        create: data.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
        })),
      },
    },
    include: { items: { include: { product: true } } },
  });

  revalidatePath("/pos");
  return order;
}

export async function getHeldSales() {
  return prisma.order.findMany({
    where: { status: OrderStatus.ON_HOLD },
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function cancelOrder(id: string) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.order.update({
    where: { id },
    data: { status: OrderStatus.CANCELLED },
  });

  await logActivity("CANCEL", "Order", id);
  revalidatePath("/pos");
  revalidatePath("/orders");
}

export async function getOrders(filters?: { status?: OrderStatus; type?: OrderType }) {
  return prisma.order.findMany({
    where: {
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.type ? { type: filters.type } : {}),
    },
    include: {
      items: { include: { product: true } },
      payments: true,
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
      payments: true,
      user: { select: { name: true } },
    },
  });
}

export async function createKitchenOrder(data: {
  items: { productId: string; quantity: number; unitPrice: number; notes?: string }[];
  type: OrderType;
  tableNumber?: string;
  notes?: string;
}) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const subtotal = data.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const settings = await prisma.settings.findUnique({ where: { id: "default" } });
  const taxRate = settings?.taxRate ?? 16;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const order = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      type: data.type,
      status: OrderStatus.PENDING,
      subtotal,
      discount: 0,
      tax,
      total,
      tableNumber: data.tableNumber,
      notes: data.notes,
      userId: session.user.id,
      items: {
        create: data.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
          notes: item.notes,
        })),
      },
    },
    include: { items: { include: { product: true } } },
  });

  await logActivity("CREATE", "Order", order.id, `${data.type} ticket`);
  revalidatePath("/restaurant");
  revalidatePath("/bar");
  revalidatePath("/orders");
  return order;
}

export async function getProductsByCategoryType(types: string[]) {
  return prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      category: { type: { in: types } },
    },
    include: { category: true },
    orderBy: { name: "asc" },
  });
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const order = await prisma.order.update({
    where: { id },
    data: {
      status,
      ...(status === OrderStatus.COMPLETED ? { completedAt: new Date() } : {}),
    },
  });

  await logActivity("UPDATE", "Order", id, `Status: ${status}`);
  revalidatePath("/orders");
  revalidatePath("/restaurant");
  revalidatePath("/bar");
  return order;
}
