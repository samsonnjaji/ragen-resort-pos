import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "KES"): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function formatDateOnly(date: Date | string): string {
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
  }).format(new Date(date));
}

export function generateOrderNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `ORD-${date}-${random}`;
}

export function generatePurchaseNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `PO-${date}-${random}`;
}

/** Resolve report date range; custom requires both start and end. */
export function resolveReportDateRange(
  filter: string,
  startDate?: Date,
  endDate?: Date
): { start: Date; end: Date } {
  if (filter === "custom" && startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  return getDateRange(filter === "custom" ? "today" : filter);
}

export function getDateRange(filter: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (filter) {
    case "week": {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "today":
    default: {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
  }
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  CASHIER: "Cashier",
  RESTAURANT: "Restaurant",
  BAR: "Bar",
  ROOM_MANAGER: "Room Manager",
};

export const ROOM_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "bg-emerald-500",
  OCCUPIED: "bg-red-500",
  RESERVED: "bg-yellow-500",
  CLEANING: "bg-blue-500",
  MAINTENANCE: "bg-gray-500",
};

export const ROOM_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  OCCUPIED: "Occupied",
  RESERVED: "Reserved",
  CLEANING: "Cleaning",
  MAINTENANCE: "Maintenance",
};
