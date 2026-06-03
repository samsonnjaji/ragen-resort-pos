"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession, logActivity } from "./dashboard";
import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/app-error";
import { generateSecureTempPassword } from "@/lib/temp-password";
import { sendWelcomeUserEmail, isEmailConfigured } from "@/lib/mail";
import { ROLE_LABELS } from "@/lib/utils";

async function requireAdmin() {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN" || !session.user.id) {
    throw new AppError("Unauthorized — admin access required.");
  }
  return session;
}

function getLoginUrl(): string {
  const base =
    process.env.APP_BASE_URL?.replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  return `${base}/login`;
}

export async function getUserDependencyCounts(userId: string) {
  const [orders, payments, activityLogs, inventoryMovements, archivedProducts] =
    await Promise.all([
      prisma.order.count({ where: { userId } }),
      prisma.payment.count({ where: { userId } }),
      prisma.activityLog.count({ where: { userId } }),
      prisma.inventoryMovement.count({ where: { userId } }),
      prisma.product.count({ where: { archivedById: userId } }),
    ]);

  return {
    orders,
    payments,
    activityLogs,
    inventoryMovements,
    archivedProducts,
    total: orders + payments + activityLogs + inventoryMovements + archivedProducts,
  };
}

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  role: z.enum(["ADMIN", "CASHIER", "RESTAURANT", "BAR", "ROOM_MANAGER"]),
});

export async function createUserWithTempPassword(data: {
  name: string;
  email: string;
  role: string;
}) {
  const session = await requireAdmin();
  const parsed = createUserSchema.safeParse({
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    role: data.role,
  });
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) throw new AppError("A user with this email already exists.");

  const temporaryPassword = generateSecureTempPassword();
  const hashedPassword = await bcrypt.hash(temporaryPassword, 12);
  const now = new Date();

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      password: hashedPassword,
      role: parsed.data.role,
      active: true,
      mustChangePassword: true,
      inviteSentAt: now,
    },
  });

  let emailSent = false;
  if (isEmailConfigured()) {
    const mailResult = await sendWelcomeUserEmail(user.email, {
      name: user.name,
      role: ROLE_LABELS[user.role] ?? user.role,
      loginUrl: getLoginUrl(),
      temporaryPassword,
    });
    emailSent = mailResult.ok;
    if (mailResult.ok) {
      await logActivity("USER_TEMP_PASSWORD_EMAIL_SENT", "User", user.id, user.email, {
        role: user.role,
        adminId: session.user.id,
      });
    } else {
      await logActivity("USER_TEMP_PASSWORD_EMAIL_FAILED", "User", user.id, user.email, {
        role: user.role,
        adminId: session.user.id,
      });
    }
  } else {
    await logActivity("USER_TEMP_PASSWORD_EMAIL_FAILED", "User", user.id, "SMTP not configured", {
      adminId: session.user.id,
    });
  }

  await logActivity("USER_CREATED", "User", user.id, user.email, {
    role: user.role,
    emailSent,
    adminId: session.user.id,
  });

  revalidatePath("/users");
  revalidatePath("/archive");

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    temporaryPassword,
    emailSent,
  };
}

export async function resetUserTempPassword(userId: string) {
  const session = await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("User not found.");
  if (!user.active) throw new AppError("Activate the user before resetting their temporary password.");

  const temporaryPassword = generateSecureTempPassword();
  const hashedPassword = await bcrypt.hash(temporaryPassword, 12);
  const now = new Date();

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      mustChangePassword: true,
      passwordSetAt: null,
      inviteSentAt: now,
      inviteAcceptedAt: null,
    },
  });

  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: now },
  });

  let emailSent = false;
  if (isEmailConfigured()) {
    const mailResult = await sendWelcomeUserEmail(user.email, {
      name: user.name,
      role: ROLE_LABELS[user.role] ?? user.role,
      loginUrl: getLoginUrl(),
      temporaryPassword,
    });
    emailSent = mailResult.ok;
    if (mailResult.ok) {
      await logActivity("USER_TEMP_PASSWORD_EMAIL_SENT", "User", userId, user.email, {
        reason: "admin_reset",
        adminId: session.user.id,
      });
    } else {
      await logActivity("USER_TEMP_PASSWORD_EMAIL_FAILED", "User", userId, user.email, {
        adminId: session.user.id,
      });
    }
  }

  await logActivity("USER_TEMP_PASSWORD_RESET", "User", userId, user.email, {
    emailSent,
    adminId: session.user.id,
  });

  revalidatePath("/users");
  return { temporaryPassword, emailSent };
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[a-zA-Z]/, "Password must include letters")
      .regex(/[0-9]/, "Password must include a number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function changePasswordOnFirstLogin(data: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const session = await getSession();
  if (!session?.user?.id) throw new AppError("Unauthorized");

  const parsed = changePasswordSchema.safeParse(data);
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.active) throw new AppError("Unauthorized");
  if (!user.mustChangePassword) {
    throw new AppError("Password change is not required for your account.");
  }

  const validCurrent = await bcrypt.compare(parsed.data.currentPassword, user.password);
  if (!validCurrent) throw new AppError("Current password is incorrect.");

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    throw new AppError("New password must be different from your temporary password.");
  }

  const sameAsOld = await bcrypt.compare(parsed.data.newPassword, user.password);
  if (sameAsOld) {
    throw new AppError("New password must be different from your temporary password.");
  }

  const hashed = await bcrypt.hash(parsed.data.newPassword, 12);
  const now = new Date();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      mustChangePassword: false,
      passwordSetAt: now,
      inviteAcceptedAt: now,
    },
  });

  await logActivity("USER_PASSWORD_CHANGED_FIRST_LOGIN", "User", user.id, user.email);

  return { success: true as const };
}

export async function updateUserProfile(
  id: string,
  data: Partial<{ name: string; email: string; role: string; active: boolean }>
) {
  const session = await requireAdmin();

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.email !== undefined) updateData.email = data.email.trim().toLowerCase();
  if (data.role !== undefined) updateData.role = data.role;

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
  });

  await logActivity("UPDATE", "User", id, user.email, { adminId: session.user.id });
  revalidatePath("/users");
  return user;
}
