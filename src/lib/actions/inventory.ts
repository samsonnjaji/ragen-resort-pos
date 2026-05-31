"use server";

import prisma from "@/lib/prisma";
import { getSession, logActivity } from "./dashboard";
import { revalidatePath } from "next/cache";
import { InventoryType } from "@prisma/client";

export async function getInventoryMovements(productId?: string) {
  return prisma.inventoryMovement.findMany({
    where: productId ? { productId } : {},
    include: {
      product: true,
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function stockIn(data: {
  productId: string;
  quantity: number;
  reason?: string;
  reference?: string;
}) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: data.productId },
      data: { stock: { increment: data.quantity } },
    });

    await tx.inventoryMovement.create({
      data: {
        productId: data.productId,
        type: InventoryType.STOCK_IN,
        quantity: data.quantity,
        reason: data.reason || "Stock In",
        reference: data.reference,
        userId: session!.user!.id,
      },
    });
  });

  await logActivity("STOCK_IN", "Product", data.productId, `Qty: ${data.quantity}`);
  revalidatePath("/inventory");
  revalidatePath("/products");
}

export async function stockOut(data: {
  productId: string;
  quantity: number;
  reason?: string;
}) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: data.productId },
      data: { stock: { decrement: data.quantity } },
    });

    await tx.inventoryMovement.create({
      data: {
        productId: data.productId,
        type: InventoryType.STOCK_OUT,
        quantity: -data.quantity,
        reason: data.reason || "Stock Out",
        userId: session!.user!.id,
      },
    });
  });

  await logActivity("STOCK_OUT", "Product", data.productId, `Qty: ${data.quantity}`);
  revalidatePath("/inventory");
  revalidatePath("/products");
}

export async function adjustStock(data: {
  productId: string;
  newStock: number;
  reason?: string;
}) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  const product = await prisma.product.findUnique({ where: { id: data.productId } });
  if (!product) throw new Error("Product not found");

  const diff = data.newStock - product.stock;

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: data.productId },
      data: { stock: data.newStock },
    });

    await tx.inventoryMovement.create({
      data: {
        productId: data.productId,
        type: InventoryType.ADJUSTMENT,
        quantity: diff,
        reason: data.reason || "Stock Adjustment",
        userId: session!.user!.id,
      },
    });
  });

  await logActivity("ADJUST", "Product", data.productId, `New stock: ${data.newStock}`);
  revalidatePath("/inventory");
  revalidatePath("/products");
}

export async function recordWastage(data: {
  productId: string;
  quantity: number;
  reason?: string;
}) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: data.productId },
      data: { stock: { decrement: data.quantity } },
    });

    await tx.inventoryMovement.create({
      data: {
        productId: data.productId,
        type: InventoryType.WASTAGE,
        quantity: -data.quantity,
        reason: data.reason || "Wastage",
        userId: session!.user!.id,
      },
    });
  });

  await logActivity("WASTAGE", "Product", data.productId, `Qty: ${data.quantity}`);
  revalidatePath("/inventory");
  revalidatePath("/products");
}

export async function getLowStockProducts() {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    include: { category: true },
  });
  return products.filter((p) => p.stock <= p.lowStockAlert);
}

export async function getAllProducts() {
  return prisma.product.findMany({
    include: { category: true },
    orderBy: { name: "asc" },
  });
}
