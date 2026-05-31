"use server";

import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { getSession, logActivity } from "./dashboard";
import { revalidatePath } from "next/cache";
import { ProductStatus } from "@prisma/client";
import { AppError } from "@/lib/app-error";

async function requireAdmin() {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN" || !session.user.id) {
    throw new AppError("Unauthorized — admin access required.");
  }
  return session;
}

async function getProductDependencyCounts(productId: string) {
  const [orderItems, inventoryMovements, roomCharges, purchaseItems] = await Promise.all([
    prisma.orderItem.count({ where: { productId } }),
    prisma.inventoryMovement.count({ where: { productId } }),
    prisma.roomCharge.count({ where: { productId } }),
    prisma.purchaseItem.count({ where: { productId } }),
  ]);

  return {
    orderItems,
    inventoryMovements,
    roomCharges,
    purchaseItems,
    total: orderItems + inventoryMovements + roomCharges + purchaseItems,
  };
}

export async function getArchivedProducts() {
  await requireAdmin();

  const products = await prisma.product.findMany({
    where: { deletedAt: { not: null } },
    include: {
      category: { select: { id: true, name: true } },
      archivedBy: { select: { id: true, name: true, email: true } },
      _count: {
        select: {
          orderItems: true,
          inventoryMovements: true,
          roomCharges: true,
          purchaseItems: true,
        },
      },
    },
    orderBy: [{ archivedAt: "desc" }, { deletedAt: "desc" }],
  });

  return products.map((p) => {
    const historyCount =
      p._count.orderItems +
      p._count.inventoryMovements +
      p._count.roomCharges +
      p._count.purchaseItems;

    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      stock: p.stock,
      sellingPrice: p.sellingPrice,
      archiveReason: p.archiveReason,
      categoryName: p.category?.name ?? "Unknown",
      archivedAt: (p.archivedAt ?? p.deletedAt)?.toISOString() ?? null,
      archivedByName: p.archivedBy?.name ?? "Unknown",
      archivedByEmail: p.archivedBy?.email ?? null,
      hasHistory: historyCount > 0,
      historyCount,
    };
  });
}

export async function getArchivedSuppliers() {
  await requireAdmin();
  return prisma.supplier.findMany({
    where: { active: false },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, phone: true, email: true, updatedAt: true },
  });
}

export async function getArchivedCategories() {
  await requireAdmin();
  return prisma.category.findMany({
    where: { active: false },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, description: true, type: true, updatedAt: true },
  });
}

export async function getDeactivatedUsers() {
  await requireAdmin();
  return prisma.user.findMany({
    where: { active: false },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, email: true, role: true, updatedAt: true },
  });
}

export async function archiveProduct(id: string, archiveReason?: string) {
  const session = await requireAdmin();

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new AppError("Product not found.");
  if (product.deletedAt) throw new AppError("Product is already archived.");

  const now = new Date();

  await prisma.product.update({
    where: { id },
    data: {
      isActive: false,
      deletedAt: now,
      archivedAt: now,
      archivedById: session.user.id,
      archiveReason: archiveReason?.trim() || null,
      status: ProductStatus.INACTIVE,
    },
  });

  await logActivity("ARCHIVE_PRODUCT", "Product", id, `Archived: ${product.name}`, {
    productName: product.name,
    productSku: product.sku,
    archiveReason: archiveReason?.trim() || null,
  });

  revalidatePath("/products");
  revalidatePath("/pos");
  revalidatePath("/archive");
}

export async function restoreProduct(id: string) {
  await requireAdmin();

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new AppError("Product not found.");
  if (!product.deletedAt) throw new AppError("Product is not archived.");

  await prisma.product.update({
    where: { id },
    data: {
      isActive: true,
      deletedAt: null,
      archivedAt: null,
      archivedById: null,
      archiveReason: null,
      status: ProductStatus.ACTIVE,
    },
  });

  await logActivity("RESTORE_PRODUCT", "Product", id, `Restored: ${product.name}`, {
    productName: product.name,
  });

  revalidatePath("/products");
  revalidatePath("/pos");
  revalidatePath("/archive");
}

export async function permanentDeleteProduct(input: {
  id: string;
  confirmName: string;
  password: string;
  irreversibleConfirmed: boolean;
}) {
  const session = await requireAdmin();

  const product = await prisma.product.findUnique({ where: { id: input.id } });
  if (!product) throw new AppError("Product not found.");
  if (!product.deletedAt) {
    throw new AppError("Only archived products can be permanently deleted.");
  }

  await logActivity("PERMANENT_DELETE_PRODUCT_ATTEMPT", "Product", product.id, product.name, {
    productName: product.name,
  });

  if (!input.irreversibleConfirmed) {
    throw new AppError("You must confirm this action is irreversible.");
  }

  if (input.confirmName.trim() !== product.name.trim()) {
    throw new AppError("Product name does not match.");
  }

  const admin = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!admin) throw new AppError("Admin account not found.");

  const passwordValid = await bcrypt.compare(input.password, admin.password);
  if (!passwordValid) {
    throw new AppError("Incorrect admin password.");
  }

  const deps = await getProductDependencyCounts(product.id);
  if (deps.total > 0) {
    await logActivity("PERMANENT_DELETE_PRODUCT_BLOCKED", "Product", product.id, product.name, {
      productName: product.name,
      orderItems: deps.orderItems,
      inventoryMovements: deps.inventoryMovements,
      roomCharges: deps.roomCharges,
      purchaseItems: deps.purchaseItems,
    });
    throw new AppError(
      "This product has historical records and cannot be permanently deleted. It can remain archived."
    );
  }

  await prisma.product.delete({ where: { id: product.id } });

  await logActivity("PERMANENT_DELETE_PRODUCT_SUCCESS", "Product", product.id, product.name, {
    productName: product.name,
  });

  revalidatePath("/archive");
  revalidatePath("/products");
}

export async function restoreSupplier(id: string) {
  await requireAdmin();
  const supplier = await prisma.supplier.update({
    where: { id },
    data: { active: true },
  });
  await logActivity("RESTORE", "Supplier", id, supplier.name);
  revalidatePath("/archive");
  revalidatePath("/purchases");
}

export async function restoreCategory(id: string) {
  await requireAdmin();
  const category = await prisma.category.update({
    where: { id },
    data: { active: true },
  });
  await logActivity("RESTORE", "Category", id, category.name);
  revalidatePath("/archive");
  revalidatePath("/products");
}

export async function restoreArchivedUser(id: string) {
  const session = await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError("User not found.");

  await prisma.user.update({ where: { id }, data: { active: true } });
  await logActivity("RESTORE", "User", id, user.email);
  revalidatePath("/archive");
  revalidatePath("/users");
}
