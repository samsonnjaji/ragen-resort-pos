"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { sendPasswordResetEmail, isEmailConfigured } from "@/lib/mail";
import { logActivity } from "./dashboard";
import { AppError } from "@/lib/app-error";

const RESET_TOKEN_BYTES = 32;
const RESET_EXPIRY_MINUTES = 30;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

const forgotSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

const resetSchema = z
  .object({
    token: z.string().min(1, "Reset link is invalid"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[a-zA-Z]/, "Password must include letters")
      .regex(/[0-9]/, "Password must include a number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function requestPasswordReset(formData: { email: string }) {
  const parsed = forgotSchema.safeParse(formData);
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Invalid email");
  }

  const email = parsed.data.email.trim().toLowerCase();

  if (!checkRateLimit(`reset:${email}`)) {
    await logActivity("PASSWORD_RESET_FAILED", "User", undefined, "Rate limited", {
      email,
    });
    return { success: true as const };
  }

  if (!isEmailConfigured()) {
    console.error("[password-reset] SMTP not configured");
    await logActivity("PASSWORD_RESET_FAILED", "User", undefined, "SMTP not configured");
    return { success: true as const };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (user?.active) {
    const rawToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_EXPIRY_MINUTES * 60 * 1000);

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const mailResult = await sendPasswordResetEmail(user.email, rawToken);

    await logActivity("PASSWORD_RESET_REQUESTED", "User", user.id, user.email);

    if (mailResult.ok) {
      await logActivity("PASSWORD_RESET_EMAIL_SENT", "User", user.id, user.email);
    } else {
      await logActivity("PASSWORD_RESET_FAILED", "User", user.id, "Email send failed");
    }
  }

  return {
    success: true as const,
    message:
      "If this email exists in our system, reset instructions have been sent.",
  };
}

export async function validateResetToken(token: string): Promise<{ valid: boolean }> {
  if (!token?.trim()) return { valid: false };
  const tokenHash = hashToken(token.trim());
  const record = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  return { valid: !!record };
}

export async function completePasswordReset(formData: {
  token: string;
  password: string;
  confirmPassword: string;
}) {
  const parsed = resetSchema.safeParse(formData);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Invalid input";
    await logActivity("PASSWORD_RESET_FAILED", "User", undefined, msg);
    throw new AppError(msg);
  }

  const tokenHash = hashToken(parsed.data.token.trim());
  const record = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!record || !record.user.active) {
    await logActivity("PASSWORD_RESET_FAILED", "User", undefined, "Invalid or expired token");
    throw new AppError("This reset link is invalid or has expired. Request a new one.");
  }

  const hashed = await bcrypt.hash(parsed.data.password, 12);

  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        password: hashed,
        mustChangePassword: false,
        passwordSetAt: now,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.updateMany({
      where: {
        userId: record.userId,
        id: { not: record.id },
        usedAt: null,
      },
      data: { usedAt: new Date() },
    }),
  ]);

  await logActivity("PASSWORD_RESET_COMPLETED", "User", record.userId, record.user.email);

  return { success: true as const };
}
