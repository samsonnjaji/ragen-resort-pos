"use server";

import prisma from "@/lib/prisma";
import { getSession, logActivity } from "./dashboard";
import { revalidatePath } from "next/cache";
import { generateOrderNumber } from "@/lib/utils";
import {
  InventoryType,
  OrderStatus,
  OrderType,
  ProductStatus,
} from "@prisma/client";
import { AppError, rethrowPrisma } from "@/lib/app-error";
import { archiveProduct } from "./archive";
import {
  formatPaymentBreakdownForLog,
  type PaymentLineInput,
  validateAndNormalizePayments,
} from "@/lib/payments";

async function validateProductInput(
  data: {
    name: string;
    sku: string;
    categoryId: string;
    sellingPrice: number;
    costPrice: number;
    stock: number;
    lowStockAlert: number;
  },
  excludeProductId?: string
) {
  const name = data.name?.trim();
  const sku = data.sku?.trim();
  const categoryId = data.categoryId?.trim();

  if (!name) throw new AppError("Product name is required.");
  if (!sku) throw new AppError("SKU is required.");
  if (!categoryId) throw new AppError("Please select a category.");

  if (Number.isNaN(data.sellingPrice) || data.sellingPrice < 0) {
    throw new AppError("Selling price must be a valid number.");
  }

  const category = await prisma.category.findFirst({
    where: { id: categoryId, active: true },
  });
  if (!category) {
    throw new AppError("Invalid category. Please select an active category.");
  }

  const existingSku = await prisma.product.findUnique({
    where: { sku },
    select: { id: true, name: true, deletedAt: true },
  });
  if (existingSku && existingSku.id !== excludeProductId) {
    if (existingSku.deletedAt) {
      throw new AppError(
        `SKU "${sku}" belongs to archived product "${existingSku.name}". Restore it from Archive or use a different SKU.`
      );
    }
    throw new AppError(`SKU "${sku}" is already used by "${existingSku.name}".`);
  }

  return { name, sku, categoryId, category };
}

const activeProductFilter = {
  isActive: true,
  deletedAt: null,
  status: ProductStatus.ACTIVE,
};

export async function getProducts(categoryId?: string) {
  return prisma.product.findMany({
    where: {
      ...activeProductFilter,
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

export async function getAllCategories() {
  return prisma.category.findMany({
    include: {
      _count: {
        select: {
          products: { where: { deletedAt: null, isActive: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getAllProductsAdmin() {
  return prisma.product.findMany({
    where: { deletedAt: null, isActive: true },
    include: { category: true, _count: { select: { orderItems: true } } },
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
  if (session?.user?.role !== "ADMIN") throw new AppError("Unauthorized");

  try {
    const validated = await validateProductInput(data);

    const product = await prisma.product.create({
      data: {
        name: validated.name,
        sku: validated.sku,
        barcode: data.barcode?.trim() || null,
        sellingPrice: data.sellingPrice,
        costPrice: data.costPrice ?? 0,
        stock: data.stock ?? 0,
        lowStockAlert: data.lowStockAlert ?? 5,
        categoryId: validated.categoryId,
        isActive: true,
        status: ProductStatus.ACTIVE,
      },
    });

    await logActivity("CREATE", "Product", product.id, product.name);
    revalidatePath("/products");
    revalidatePath("/pos");
    return product;
  } catch (error) {
    rethrowPrisma(error);
  }
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
  if (session?.user?.role !== "ADMIN") throw new AppError("Unauthorized");

  try {
    if (data.name !== undefined || data.sku !== undefined || data.categoryId !== undefined) {
      const current = await prisma.product.findUnique({ where: { id } });
      if (!current) throw new AppError("Product not found.");
      await validateProductInput(
        {
          name: data.name ?? current.name,
          sku: data.sku ?? current.sku,
          categoryId: data.categoryId ?? current.categoryId,
          sellingPrice: data.sellingPrice ?? current.sellingPrice,
          costPrice: data.costPrice ?? current.costPrice,
          stock: data.stock ?? current.stock,
          lowStockAlert: data.lowStockAlert ?? current.lowStockAlert,
        },
        id
      );
    }

    const product = await prisma.product.update({ where: { id }, data });
    await logActivity("UPDATE", "Product", id);
    revalidatePath("/products");
    revalidatePath("/pos");
    return product;
  } catch (error) {
    rethrowPrisma(error);
  }
}

export async function deleteProduct(id: string, archiveReason?: string) {
  return archiveProduct(id, archiveReason);
}

export async function updateCategory(
  id: string,
  data: Partial<{ name: string; description: string; type: string; active: boolean }>
) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new AppError("Unauthorized");

  const category = await prisma.category.update({ where: { id }, data });
  await logActivity("UPDATE", "Category", id, category.name);
  revalidatePath("/products");
  return category;
}

export async function deleteCategory(id: string) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new AppError("Unauthorized");

  const count = await prisma.product.count({
    where: { categoryId: id, deletedAt: null },
  });
  if (count > 0) {
    throw new AppError(
      `Cannot delete category — ${count} product(s) still assigned. Move or delete them first.`
    );
  }

  await prisma.category.delete({ where: { id } });
  await logActivity("DELETE", "Category", id);
  revalidatePath("/products");
}

export async function createCategory(data: { name: string; description?: string; type?: string }) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new AppError("Unauthorized");

  const name = data.name?.trim();
  if (!name) throw new AppError("Category name is required.");

  try {
    const category = await prisma.category.create({
      data: {
        name,
        description: data.description?.trim() || null,
        type: data.type?.trim() || "GENERAL",
      },
    });
    await logActivity("CREATE", "Category", category.id, category.name);
    revalidatePath("/products");
    return category;
  } catch (error) {
    rethrowPrisma(error);
  }
}

export async function completeSale(data: {
  items: { productId: string; quantity: number; unitPrice: number }[];
  discount: number;
  tax: number;
  payments: PaymentLineInput[];
  type?: OrderType;
  notes?: string;
  roomId?: string;
  bookingId?: string;
}) {
  const session = await getSession();
  if (!session?.user?.id) throw new AppError("Unauthorized");

  if (!data.items.length) throw new AppError("Cart is empty.");

  const subtotal = data.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const total = subtotal - data.discount + data.tax;

  const { payments: normalizedPayments, changeGiven, isSplit } =
    validateAndNormalizePayments(data.payments, total);

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
        changeGiven,
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
          create: normalizedPayments.map((p) => ({
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

  const breakdown = formatPaymentBreakdownForLog(order.payments, changeGiven);

  await logActivity("SALE_COMPLETED", "Order", order.id, order.orderNumber, {
    total,
    changeGiven,
    isSplit,
    cashier: session.user.name ?? session.user.email,
    payments: breakdown,
  });

  for (const p of order.payments) {
    await logActivity(
      isSplit ? "SPLIT_PAYMENT_RECORDED" : "PAYMENT_RECORDED",
      "Payment",
      p.id,
      `${order.orderNumber} — ${p.method} ${p.amount}`,
      {
        orderNumber: order.orderNumber,
        method: p.method,
        amount: p.amount,
        reference: p.reference,
      }
    );
  }

  revalidatePath("/pos");
  revalidatePath("/dashboard");
  revalidatePath("/orders");
  revalidatePath("/reports");
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
  if (!session?.user?.id) throw new AppError("Unauthorized");

  const order = await prisma.order.findUnique({
    where: { id },
    include: { payments: true },
  });
  if (!order) throw new AppError("Order not found");

  if (order.status === OrderStatus.COMPLETED && order.payments.length > 0) {
    throw new AppError("Cannot cancel a paid order. Contact an admin for refunds.");
  }

  await prisma.order.update({
    where: { id },
    data: { status: OrderStatus.CANCELLED },
  });

  await logActivity("CANCEL", "Order", id, order.orderNumber);
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
      ...activeProductFilter,
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

export async function deleteOrder(id: string) {
  const session = await getSession();
  if (!session?.user?.id) throw new AppError("Unauthorized");

  const order = await prisma.order.findUnique({
    where: { id },
    include: { payments: true },
  });
  if (!order) throw new AppError("Order not found");

  if (order.status === OrderStatus.COMPLETED && order.payments.length > 0) {
    throw new AppError("Cannot delete a paid order. Cancel it instead to preserve audit history.");
  }

  const deletableStatuses: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.ON_HOLD, OrderStatus.PENDING];
  if (!deletableStatuses.includes(order.status)) {
    throw new AppError("Only cancelled, on-hold, or pending orders can be deleted.");
  }

  await prisma.order.delete({ where: { id } });
  await logActivity("DELETE", "Order", id, order.orderNumber);
  revalidatePath("/orders");
  revalidatePath("/pos");
}
