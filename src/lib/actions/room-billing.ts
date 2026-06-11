"use server";

import prisma from "@/lib/prisma";
import { getSession, logActivity } from "./dashboard";
import { revalidatePath } from "next/cache";
import {
  BookingStatus,
  InventoryType,
  OrderStatus,
  OrderType,
  RoomChargeType,
  RoomStatus,
} from "@prisma/client";
import { AppError } from "@/lib/app-error";
import { generateOrderNumber } from "@/lib/utils";
import {
  formatPaymentBreakdownForLog,
  PaymentLineInput,
  validateAndNormalizePayments,
} from "@/lib/payments";
import {
  accommodationDescription,
  calcAccommodationSubtotal,
  calcBookedNights,
  calcNightsStayed,
  FOLIO_PAYMENT_NOTE,
  isProductSellable,
  isRoomBillingDisabled,
  mapProductCategoryToChargeType,
  ROOM_CHECKOUT_NOTE,
  ROOM_PAYMENT_ORDER_NOTES,
  WALK_IN_ROOM_SALE_NOTE,
} from "@/lib/room-billing";

const ROOM_BILLING_ROLES = ["ADMIN", "ROOM_MANAGER", "CASHIER"];

function requireRoomBillingAccess(role?: string) {
  if (!role || !ROOM_BILLING_ROLES.includes(role)) {
    throw new AppError("Unauthorized");
  }
}

async function getCheckedInBookingForRoom(roomId: string) {
  const booking = await prisma.booking.findFirst({
    where: { roomId, status: BookingStatus.CHECKED_IN },
    include: {
      guest: true,
      room: true,
      roomCharges: {
        where: { voidedAt: null },
        include: { product: { include: { category: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!booking) throw new AppError("No active checked-in booking for this room.");
  if (booking.room.status !== RoomStatus.OCCUPIED) {
    throw new AppError("Room must be occupied to manage billing.");
  }
  return booking;
}

async function sumBookingPayments(bookingId: string) {
  const orders = await prisma.order.findMany({
    where: {
      bookingId,
      status: OrderStatus.COMPLETED,
      notes: { in: [...ROOM_PAYMENT_ORDER_NOTES] },
    },
    include: { payments: true },
  });

  let paid = 0;
  for (const order of orders) {
    paid += order.payments.reduce((s, p) => s + p.amount, 0);
  }
  return Math.round(paid * 100) / 100;
}

function getActiveAccommodationCharge(
  charges: { id: string; type: RoomChargeType; checkoutOrderId: string | null; voidedAt?: Date | null }[]
) {
  return charges.find(
    (c) => c.type === RoomChargeType.ACCOMMODATION && !c.checkoutOrderId && !c.voidedAt
  );
}

function computeFolioTotals(booking: {
  checkIn: Date;
  checkOut: Date;
  room: { pricePerNight: number };
  roomCharges: {
    total: number;
    checkoutOrderId: string | null;
    type: RoomChargeType;
    quantity: number;
  }[];
}) {
  const activeCharges = booking.roomCharges.filter((c) => !c.checkoutOrderId);
  const accommodation = activeCharges.find((c) => c.type === RoomChargeType.ACCOMMODATION);
  const accommodationSubtotal = accommodation?.total ?? 0;
  const nightsStayed =
    accommodation?.quantity ?? calcNightsStayed(booking.checkIn, booking.checkOut);
  const postedChargesSubtotal = activeCharges
    .filter((c) => c.type !== RoomChargeType.ACCOMMODATION)
    .reduce((s, c) => s + c.total, 0);
  const grandTotal = Math.round((accommodationSubtotal + postedChargesSubtotal) * 100) / 100;
  return {
    nightsStayed,
    accommodationSubtotal,
    postedChargesSubtotal,
    grandTotal,
    hasAccommodation: !!accommodation,
  };
}

export async function ensureAccommodationForBooking(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      room: true,
      roomCharges: {
        where: { voidedAt: null, type: RoomChargeType.ACCOMMODATION, checkoutOrderId: null },
      },
    },
  });
  if (!booking) throw new AppError("Booking not found.");
  if (booking.status !== BookingStatus.CHECKED_IN) {
    throw new AppError("Guest must be checked in to add room rate.");
  }
  if (isRoomBillingDisabled(booking.room.status)) {
    throw new AppError("Cannot add room rate while room is cleaning or under maintenance.");
  }

  const existing = getActiveAccommodationCharge(booking.roomCharges);
  if (existing) return existing;

  const nights = calcBookedNights(booking.checkIn, booking.checkOut);
  const unitPrice = booking.room.pricePerNight;
  const total = calcAccommodationSubtotal(nights, unitPrice);

  const charge = await prisma.roomCharge.create({
    data: {
      bookingId: booking.id,
      roomId: booking.roomId,
      type: RoomChargeType.ACCOMMODATION,
      description: accommodationDescription(booking.room.number),
      quantity: nights,
      unitPrice,
      total,
      userId,
    },
  });

  await logActivity("ROOM_ACCOMMODATION_ADDED", "RoomCharge", charge.id, charge.description, {
    roomId: booking.roomId,
    nights,
    unitPrice,
    total,
  });

  return charge;
}

export async function addRoomAccommodation(data: { roomId: string; nights?: number }) {
  const session = await getSession();
  if (!session?.user?.id) throw new AppError("Unauthorized");
  requireRoomBillingAccess(session.user.role);

  const booking = await getCheckedInBookingForRoom(data.roomId);
  const existing = getActiveAccommodationCharge(booking.roomCharges);
  if (existing) {
    return existing;
  }

  const nights = data.nights ?? calcBookedNights(booking.checkIn, booking.checkOut);
  const unitPrice = booking.room.pricePerNight;
  const total = calcAccommodationSubtotal(nights, unitPrice);

  const charge = await prisma.roomCharge.create({
    data: {
      bookingId: booking.id,
      roomId: data.roomId,
      type: RoomChargeType.ACCOMMODATION,
      description: accommodationDescription(booking.room.number),
      quantity: nights,
      unitPrice,
      total,
      userId: session.user.id,
    },
  });

  await logActivity("ROOM_ACCOMMODATION_ADDED", "RoomCharge", charge.id, charge.description, {
    roomId: data.roomId,
    nights,
    unitPrice,
    total,
  });

  revalidateRoomBilling(data.roomId);
  return charge;
}

export async function updateRoomAccommodation(data: {
  roomId: string;
  nights: number;
  unitPrice?: number;
}) {
  const session = await getSession();
  if (!session?.user?.id) throw new AppError("Unauthorized");
  requireRoomBillingAccess(session.user.role);

  if (data.nights < 1) throw new AppError("Nights must be at least 1.");

  const booking = await getCheckedInBookingForRoom(data.roomId);
  const existing = getActiveAccommodationCharge(booking.roomCharges);
  if (!existing) throw new AppError("No room rate on this bill to update.");

  const full = await prisma.roomCharge.findUnique({ where: { id: existing.id } });
  if (!full || full.voidedAt) throw new AppError("Room rate charge not found.");
  if (full.checkoutOrderId) throw new AppError("Cannot edit a settled room rate.");

  const unitPrice = data.unitPrice ?? full.unitPrice;
  const charge = await prisma.roomCharge.update({
    where: { id: full.id },
    data: {
      quantity: data.nights,
      unitPrice,
      total: calcAccommodationSubtotal(data.nights, unitPrice),
    },
  });

  await logActivity("ROOM_ACCOMMODATION_UPDATED", "RoomCharge", charge.id, charge.description, {
    roomId: data.roomId,
    nights: data.nights,
    unitPrice,
    total: charge.total,
  });

  revalidateRoomBilling(data.roomId);
  return charge;
}

export async function quickCheckInWithRoomRate(data: {
  roomId: string;
  guestId: string;
  nights: number;
  bookingId?: string;
}) {
  const session = await getSession();
  if (!session?.user?.id) throw new AppError("Unauthorized");
  requireRoomBillingAccess(session.user.role);

  const nights = Math.max(1, data.nights);
  const room = await prisma.room.findUnique({ where: { id: data.roomId } });
  if (!room) throw new AppError("Room not found.");
  if (isRoomBillingDisabled(room.status)) {
    throw new AppError("Room is not available for billing (cleaning or maintenance).");
  }

  let bookingId: string;

  if (room.status === RoomStatus.OCCUPIED) {
    const booking = await prisma.booking.findFirst({
      where: { roomId: data.roomId, status: BookingStatus.CHECKED_IN },
    });
    if (!booking) throw new AppError("No active check-in for this room.");
    bookingId = booking.id;
  } else if (room.status === RoomStatus.RESERVED && data.bookingId) {
    const booking = await prisma.booking.findUnique({ where: { id: data.bookingId } });
    if (!booking || booking.roomId !== data.roomId || booking.status !== BookingStatus.RESERVED) {
      throw new AppError("Invalid reservation for this room.");
    }
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CHECKED_IN },
      });
      await tx.room.update({
        where: { id: data.roomId },
        data: { status: RoomStatus.OCCUPIED },
      });
    });
    await logActivity("CHECK_IN", "Booking", booking.id);
    bookingId = booking.id;
  } else if (room.status === RoomStatus.AVAILABLE) {
    const checkIn = new Date();
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + nights);

    const booking = await prisma.$transaction(async (tx) => {
      const b = await tx.booking.create({
        data: {
          guestId: data.guestId,
          roomId: data.roomId,
          checkIn,
          checkOut,
          adults: 1,
          children: 0,
          status: BookingStatus.CHECKED_IN,
          totalAmount: 0,
        },
      });
      await tx.room.update({
        where: { id: data.roomId },
        data: { status: RoomStatus.OCCUPIED },
      });
      return b;
    });
    await logActivity("CREATE", "Booking", booking.id);
    await logActivity("CHECK_IN", "Booking", booking.id);
    bookingId = booking.id;
  } else {
    throw new AppError("Room is not available for check-in.");
  }

  const existingAcc = await prisma.roomCharge.findFirst({
    where: {
      bookingId,
      type: RoomChargeType.ACCOMMODATION,
      voidedAt: null,
      checkoutOrderId: null,
    },
  });

  if (!existingAcc) {
    const unitPrice = room.pricePerNight;
    const total = calcAccommodationSubtotal(nights, unitPrice);
    const charge = await prisma.roomCharge.create({
      data: {
        bookingId,
        roomId: data.roomId,
        type: RoomChargeType.ACCOMMODATION,
        description: accommodationDescription(room.number),
        quantity: nights,
        unitPrice,
        total,
        userId: session.user.id,
      },
    });
    await logActivity("ROOM_ACCOMMODATION_ADDED", "RoomCharge", charge.id, charge.description, {
      roomId: data.roomId,
      nights,
      unitPrice,
      total,
    });
  }

  revalidateRoomBilling(data.roomId);
  revalidatePath("/bookings");
  return { roomId: data.roomId, bookingId };
}

async function resolveWalkInGuest(
  tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">,
  customerName?: string,
  customerPhone?: string
) {
  const fullName = customerName?.trim() || "Walk-in Guest";
  const phone = customerPhone?.trim();

  if (phone) {
    const existing = await tx.guest.findFirst({ where: { phone } });
    if (existing) {
      if (customerName?.trim()) {
        return tx.guest.update({
          where: { id: existing.id },
          data: { fullName: customerName.trim() },
        });
      }
      return existing;
    }
  }

  return tx.guest.create({
    data: {
      fullName,
      phone: phone || `WALKIN-${Date.now()}`,
    },
  });
}

/** POS-style walk-in room sale: pay now, room becomes occupied. */
export async function completeWalkInRoomSale(data: {
  roomId: string;
  nights?: number;
  customerName?: string;
  customerPhone?: string;
  payments: PaymentLineInput[];
  bookingId?: string;
}) {
  const session = await getSession();
  if (!session?.user?.id) throw new AppError("Unauthorized");
  requireRoomBillingAccess(session.user.role);

  const nights = Math.max(1, data.nights ?? 1);
  const room = await prisma.room.findUnique({ where: { id: data.roomId } });
  if (!room) throw new AppError("Room not found.");
  if (isRoomBillingDisabled(room.status)) {
    throw new AppError("Room is not available for sale (cleaning or maintenance).");
  }

  if (room.status === RoomStatus.OCCUPIED) {
    throw new AppError("Room is already occupied. Open Room Bill to add charges.");
  }

  const total = calcAccommodationSubtotal(nights, room.pricePerNight);
  const { payments: normalizedPayments, changeGiven, isSplit } =
    validateAndNormalizePayments(data.payments, total);

  const result = await prisma.$transaction(async (tx) => {
    const checkIn = new Date();
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + nights);

    let bookingId: string;
    let guest;

    if (room.status === RoomStatus.RESERVED && data.bookingId) {
      const existing = await tx.booking.findUnique({
        where: { id: data.bookingId },
        include: { guest: true },
      });
      if (!existing || existing.roomId !== data.roomId || existing.status !== BookingStatus.RESERVED) {
        throw new AppError("Invalid reservation for this room.");
      }
      guest = existing.guest;
      if (data.customerName?.trim() || data.customerPhone?.trim()) {
        guest = await tx.guest.update({
          where: { id: guest.id },
          data: {
            fullName: data.customerName?.trim() || guest.fullName,
            phone: data.customerPhone?.trim() || guest.phone,
          },
        });
      }
      await tx.booking.update({
        where: { id: existing.id },
        data: { status: BookingStatus.CHECKED_IN, checkIn, checkOut, totalAmount: 0 },
      });
      bookingId = existing.id;
    } else if (room.status === RoomStatus.AVAILABLE) {
      guest = await resolveWalkInGuest(tx, data.customerName, data.customerPhone);
      const booking = await tx.booking.create({
        data: {
          guestId: guest.id,
          roomId: data.roomId,
          checkIn,
          checkOut,
          adults: 1,
          children: 0,
          status: BookingStatus.CHECKED_IN,
          totalAmount: 0,
        },
      });
      bookingId = booking.id;
    } else {
      throw new AppError("Room is not available for walk-in sale.");
    }

    await tx.room.update({
      where: { id: data.roomId },
      data: { status: RoomStatus.OCCUPIED },
    });

    const charge = await tx.roomCharge.create({
      data: {
        bookingId,
        roomId: data.roomId,
        type: RoomChargeType.ACCOMMODATION,
        description: accommodationDescription(room.number),
        quantity: nights,
        unitPrice: room.pricePerNight,
        total,
        userId: session.user.id,
      },
    });

    const order = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        type: OrderType.ROOM_SERVICE,
        status: OrderStatus.COMPLETED,
        subtotal: total,
        total,
        changeGiven,
        notes: WALK_IN_ROOM_SALE_NOTE,
        roomId: data.roomId,
        bookingId,
        userId: session.user.id,
        completedAt: new Date(),
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
        payments: true,
        user: { select: { name: true } },
        room: true,
        booking: { include: { guest: true } },
      },
    });

    return { order, charge, guest, bookingId };
  });

  await logActivity("ROOM_SALE_COMPLETED", "Order", result.order.id, result.order.orderNumber, {
    roomId: data.roomId,
    roomNumber: room.number,
    nights,
    total,
    customer: result.guest.fullName,
  });
  await logActivity("ROOM_ACCOMMODATION_ADDED", "RoomCharge", result.charge.id, result.charge.description, {
    roomId: data.roomId,
    nights,
    total,
  });

  for (const p of result.order.payments) {
    await logActivity(
      isSplit ? "SPLIT_PAYMENT_RECORDED" : "ROOM_PAYMENT_RECORDED",
      "Payment",
      p.id,
      `${result.order.orderNumber} — ${p.method} ${p.amount}`,
      { method: p.method, amount: p.amount }
    );
  }

  revalidateRoomBilling(data.roomId);
  revalidatePath("/bookings");
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return result.order;
}

/** Customer left — settle folio and mark room for cleaning. */
export async function releaseRoom(data: { roomId: string; adminOverride?: boolean }) {
  const session = await getSession();
  if (!session?.user?.id) throw new AppError("Unauthorized");
  requireRoomBillingAccess(session.user.role);

  const account = await getRoomAccount(data.roomId);
  if (!account.booking) throw new AppError("No active room stay to release.");

  if (account.balanceDue > 0.009) {
    if (data.adminOverride && session.user.role === "ADMIN") {
      // allow release with outstanding balance
    } else {
      throw new AppError(
        `Cannot release room — balance due ${account.balanceDue.toFixed(2)}. Collect payment first.`
      );
    }
  }

  const order = await checkoutRoom({
    roomId: data.roomId,
    adminOverride: data.adminOverride,
  });

  await logActivity("ROOM_RELEASED", "Room", data.roomId, account.room.number, {
    orderId: order.id,
    total: order.total,
  });

  return order;
}

function revalidateRoomBilling(roomId?: string) {
  revalidatePath("/rooms");
  revalidatePath("/room-charges");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  if (roomId) revalidatePath(`/rooms/${roomId}`);
}

export async function getRoomAccount(roomId: string) {
  const session = await getSession();
  requireRoomBillingAccess(session?.user?.role);

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new AppError("Room not found");

  const booking = await prisma.booking.findFirst({
    where: { roomId, status: BookingStatus.CHECKED_IN },
    include: {
      guest: true,
      room: true,
      roomCharges: {
        where: { voidedAt: null },
        include: { product: { include: { category: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!booking) {
    return {
      room,
      booking: null,
      nightsStayed: 0,
      accommodationSubtotal: 0,
      postedChargesSubtotal: 0,
      paymentsMade: 0,
      balanceDue: 0,
      grandTotal: 0,
      hasAccommodation: false,
      accommodationCharge: null,
      otherCharges: [],
      charges: [],
      payments: [],
    };
  }

  const { nightsStayed, accommodationSubtotal, postedChargesSubtotal, grandTotal, hasAccommodation } =
    computeFolioTotals(booking);
  const paymentsMade = await sumBookingPayments(booking.id);
  const balanceDue = Math.round(Math.max(0, grandTotal - paymentsMade) * 100) / 100;

  const activeCharges = booking.roomCharges.filter((c) => !c.checkoutOrderId);
  const accommodationCharge = activeCharges.find((c) => c.type === RoomChargeType.ACCOMMODATION) ?? null;
  const otherCharges = activeCharges.filter((c) => c.type !== RoomChargeType.ACCOMMODATION);

  const folioPayments = await prisma.order.findMany({
    where: {
      bookingId: booking.id,
      status: OrderStatus.COMPLETED,
      notes: { in: [...ROOM_PAYMENT_ORDER_NOTES] },
    },
    include: { payments: true, user: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return {
    room,
    booking,
    nightsStayed,
    accommodationSubtotal,
    postedChargesSubtotal,
    paymentsMade,
    balanceDue,
    grandTotal,
    hasAccommodation,
    accommodationCharge,
    otherCharges,
    charges: activeCharges,
    payments: folioPayments,
  };
}

export async function getRoomFolioSummaries() {
  const bookings = await prisma.booking.findMany({
    where: { status: BookingStatus.CHECKED_IN },
    include: {
      guest: true,
      room: true,
      roomCharges: { where: { voidedAt: null, checkoutOrderId: null } },
    },
  });

  const summaries = await Promise.all(
    bookings.map(async (booking) => {
      const { nightsStayed, grandTotal } = computeFolioTotals(booking);
      const paymentsMade = await sumBookingPayments(booking.id);
      return {
        roomId: booking.roomId,
        guestName: booking.guest.fullName,
        nightsStayed,
        balanceDue: Math.round(Math.max(0, grandTotal - paymentsMade) * 100) / 100,
      };
    })
  );

  return Object.fromEntries(summaries.map((s) => [s.roomId, s]));
}

export async function addProductRoomCharge(data: {
  roomId: string;
  productId: string;
  quantity: number;
}) {
  const session = await getSession();
  if (!session?.user?.id) throw new AppError("Unauthorized");
  requireRoomBillingAccess(session.user.role);

  if (data.quantity < 1) throw new AppError("Quantity must be at least 1.");

  const booking = await getCheckedInBookingForRoom(data.roomId);

  const charge = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: data.productId },
      include: { category: true },
    });
    if (!product) throw new AppError("Product not found.");
    if (!isProductSellable(product)) throw new AppError("Product is inactive or archived.");

    if (product.stock < data.quantity) {
      throw new AppError(`Insufficient stock for ${product.name}. Available: ${product.stock}`);
    }

    const unitPrice = product.sellingPrice;
    const total = Math.round(data.quantity * unitPrice * 100) / 100;
    const chargeType = mapProductCategoryToChargeType(product.category.type);

    const newCharge = await tx.roomCharge.create({
      data: {
        bookingId: booking.id,
        roomId: data.roomId,
        productId: product.id,
        type: chargeType,
        description: product.name,
        quantity: data.quantity,
        unitPrice,
        total,
        userId: session.user.id,
      },
      include: { product: { include: { category: true } } },
    });

    await tx.product.update({
      where: { id: product.id },
      data: { stock: { decrement: data.quantity } },
    });

    await tx.inventoryMovement.create({
      data: {
        productId: product.id,
        type: InventoryType.ROOM_CHARGE,
        quantity: -data.quantity,
        reason: `Room ${booking.room.number} charge`,
        reference: newCharge.id,
        userId: session.user.id,
      },
    });

    return newCharge;
  });

  await logActivity("ROOM_PRODUCT_CHARGE_ADDED", "RoomCharge", charge.id, charge.description, {
    roomId: data.roomId,
    productId: data.productId,
    quantity: data.quantity,
    total: charge.total,
  });

  revalidateRoomBilling(data.roomId);
  return charge;
}

export async function addManualRoomCharge(data: {
  roomId: string;
  type: RoomChargeType;
  description: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}) {
  const session = await getSession();
  if (!session?.user?.id) throw new AppError("Unauthorized");
  requireRoomBillingAccess(session.user.role);

  if (data.quantity < 1) throw new AppError("Quantity must be at least 1.");
  if (!data.description.trim()) throw new AppError("Description is required.");

  if (data.type === RoomChargeType.ACCOMMODATION) {
    throw new AppError("Use Add Room Rate to add accommodation charges.");
  }

  const booking = await getCheckedInBookingForRoom(data.roomId);
  const total = Math.round(data.quantity * data.unitPrice * 100) / 100;

  const charge = await prisma.roomCharge.create({
    data: {
      bookingId: booking.id,
      roomId: data.roomId,
      type: data.type,
      description: data.description.trim(),
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      total,
      notes: data.notes?.trim() || undefined,
      userId: session.user.id,
    },
  });

  await logActivity("ROOM_CHARGE_ADDED", "RoomCharge", charge.id, charge.description, {
    roomId: data.roomId,
    type: data.type,
    total,
  });

  revalidateRoomBilling(data.roomId);
  return charge;
}

export async function updateRoomBillingCharge(
  id: string,
  data: Partial<{
    description: string;
    type: RoomChargeType;
    quantity: number;
    unitPrice: number;
    notes: string;
  }>
) {
  const session = await getSession();
  if (!session?.user?.id) throw new AppError("Unauthorized");
  requireRoomBillingAccess(session.user.role);

  const existing = await prisma.roomCharge.findUnique({ where: { id } });
  if (!existing || existing.voidedAt) throw new AppError("Charge not found.");
  if (existing.checkoutOrderId) throw new AppError("Cannot edit a settled charge.");

  const quantity = data.quantity ?? existing.quantity;
  const unitPrice = data.unitPrice ?? existing.unitPrice;

  const charge = await prisma.roomCharge.update({
    where: { id },
    data: {
      description: data.description?.trim() ?? existing.description,
      type: data.type ?? existing.type,
      quantity,
      unitPrice,
      total: Math.round(quantity * unitPrice * 100) / 100,
      notes: data.notes !== undefined ? data.notes.trim() || null : existing.notes,
    },
  });

  const logAction =
    existing.type === RoomChargeType.ACCOMMODATION || charge.type === RoomChargeType.ACCOMMODATION
      ? "ROOM_ACCOMMODATION_UPDATED"
      : "ROOM_CHARGE_EDITED";
  await logActivity(logAction, "RoomCharge", id, charge.description, data);
  revalidateRoomBilling(existing.roomId);
  return charge;
}

export async function voidRoomBillingCharge(id: string) {
  const session = await getSession();
  if (!session?.user?.id) throw new AppError("Unauthorized");
  requireRoomBillingAccess(session.user.role);

  const existing = await prisma.roomCharge.findUnique({
    where: { id },
    include: { room: true, booking: true },
  });
  if (!existing || existing.voidedAt) throw new AppError("Charge not found.");
  if (existing.checkoutOrderId) throw new AppError("Cannot remove a settled charge.");

  await prisma.$transaction(async (tx) => {
    if (existing.productId) {
      await tx.product.update({
        where: { id: existing.productId },
        data: { stock: { increment: existing.quantity } },
      });
      await tx.inventoryMovement.create({
        data: {
          productId: existing.productId,
          type: InventoryType.ADJUSTMENT,
          quantity: existing.quantity,
          reason: "Room charge voided",
          reference: existing.id,
          userId: session.user.id,
        },
      });
    }

    await tx.roomCharge.update({
      where: { id },
      data: { voidedAt: new Date(), voidedById: session.user.id },
    });
  });

  await logActivity(
    existing.type === RoomChargeType.ACCOMMODATION ? "ROOM_ACCOMMODATION_VOIDED" : "ROOM_CHARGE_REMOVED",
    "RoomCharge",
    id,
    existing.description
  );
  revalidateRoomBilling(existing.roomId);
}

export async function recordRoomPayment(data: {
  roomId: string;
  payments: PaymentLineInput[];
}) {
  const session = await getSession();
  if (!session?.user?.id) throw new AppError("Unauthorized");
  requireRoomBillingAccess(session.user.role);

  const account = await getRoomAccount(data.roomId);
  if (!account.booking) throw new AppError("No active booking for this room.");
  if (account.balanceDue <= 0) throw new AppError("No balance due on this room account.");

  const { payments: normalizedPayments, changeGiven, isSplit } =
    validateAndNormalizePayments(data.payments, account.balanceDue);

  const paymentTotal = normalizedPayments.reduce((s, p) => s + p.amount, 0);

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        type: OrderType.ROOM_SERVICE,
        status: OrderStatus.COMPLETED,
        subtotal: paymentTotal,
        total: paymentTotal,
        changeGiven,
        notes: FOLIO_PAYMENT_NOTE,
        roomId: data.roomId,
        bookingId: account.booking!.id,
        userId: session.user.id,
        completedAt: new Date(),
        payments: {
          create: normalizedPayments.map((p) => ({
            method: p.method,
            amount: p.amount,
            reference: p.reference,
            userId: session.user.id,
          })),
        },
      },
      include: { payments: true },
    });
    return newOrder;
  });

  const breakdown = formatPaymentBreakdownForLog(order.payments, changeGiven);
  await logActivity("ROOM_PAYMENT_RECORDED", "Order", order.id, order.orderNumber, {
    roomId: data.roomId,
    bookingId: account.booking.id,
    amount: paymentTotal,
    changeGiven,
    isSplit,
    payments: breakdown,
  });

  revalidateRoomBilling(data.roomId);
  return order;
}

export async function checkoutRoom(data: {
  roomId: string;
  payments?: PaymentLineInput[];
  adminOverride?: boolean;
}) {
  const session = await getSession();
  if (!session?.user?.id) throw new AppError("Unauthorized");
  requireRoomBillingAccess(session.user.role);

  const account = await getRoomAccount(data.roomId);
  if (!account.booking) throw new AppError("No active booking for this room.");

  const booking = account.booking;
  const subtotal = account.grandTotal!;
  const remainingDue = account.balanceDue;

  let finalPayments: ReturnType<typeof validateAndNormalizePayments>["payments"] = [];
  let changeGiven = 0;

  if (remainingDue > 0.009) {
    if (data.adminOverride && session.user.role === "ADMIN") {
      // allow checkout with outstanding balance
    } else if (!data.payments?.length) {
      throw new AppError("Payment required — balance due before checkout.");
    } else {
      const normalized = validateAndNormalizePayments(data.payments, remainingDue);
      finalPayments = normalized.payments;
      changeGiven = normalized.changeGiven;
    }
  }

  const unpaidCharges = account.charges.filter((c) => !c.checkoutOrderId);
  const productItems = unpaidCharges.filter((c) => c.productId);

  const checkoutOrder = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        type: OrderType.ROOM_SERVICE,
        status: OrderStatus.COMPLETED,
        subtotal,
        total: subtotal,
        changeGiven,
        notes: ROOM_CHECKOUT_NOTE,
        roomId: data.roomId,
        bookingId: booking.id,
        userId: session.user.id,
        completedAt: new Date(),
        items: {
          create: productItems.map((c) => ({
            productId: c.productId!,
            quantity: c.quantity,
            unitPrice: c.unitPrice,
            total: c.total,
            notes: c.description,
          })),
        },
        payments:
          finalPayments.length > 0
            ? {
                create: finalPayments.map((p) => ({
                  method: p.method,
                  amount: p.amount,
                  reference: p.reference,
                  userId: session.user.id,
                })),
              }
            : undefined,
      },
      include: {
        items: { include: { product: true } },
        payments: true,
        user: { select: { name: true } },
        room: true,
        booking: { include: { guest: true } },
      },
    });

    if (unpaidCharges.length > 0) {
      await tx.roomCharge.updateMany({
        where: { id: { in: unpaidCharges.map((c) => c.id) } },
        data: { checkoutOrderId: newOrder.id },
      });
    }

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CHECKED_OUT,
        totalAmount: subtotal,
      },
    });

    await tx.room.update({
      where: { id: data.roomId },
      data: { status: RoomStatus.CLEANING },
    });

    return newOrder;
  });

  await logActivity("ROOM_CHECKOUT_COMPLETED", "Booking", booking.id, checkoutOrder.orderNumber, {
    roomId: data.roomId,
    total: checkoutOrder.total,
    orderId: checkoutOrder.id,
  });

  for (const p of checkoutOrder.payments) {
    await logActivity("ROOM_PAYMENT_RECORDED", "Payment", p.id, checkoutOrder.orderNumber, {
      method: p.method,
      amount: p.amount,
    });
  }

  revalidateRoomBilling(data.roomId);
  revalidatePath("/bookings");
  return checkoutOrder;
}

export async function getRoomCheckoutInvoice(orderId: string) {
  const session = await getSession();
  requireRoomBillingAccess(session?.user?.role);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { name: true } },
      room: true,
      booking: { include: { guest: true } },
      payments: true,
      roomCharges: {
        where: { voidedAt: null },
        include: { product: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!order || order.notes !== ROOM_CHECKOUT_NOTE) {
    throw new AppError("Checkout invoice not found.");
  }

  const nightsStayed = order.booking
    ? calcNightsStayed(order.booking.checkIn, order.booking.checkOut, order.completedAt ?? new Date())
    : 0;
  const accCharge = order.roomCharges.find((c) => c.type === RoomChargeType.ACCOMMODATION);
  const accommodationSubtotal = accCharge?.total ?? 0;

  const folioPayments = await prisma.order.findMany({
    where: {
      bookingId: order.bookingId ?? undefined,
      status: OrderStatus.COMPLETED,
      notes: { in: [...ROOM_PAYMENT_ORDER_NOTES] },
    },
    include: { payments: true },
    orderBy: { createdAt: "asc" },
  });

  return {
    order,
    nightsStayed,
    accommodationSubtotal,
    charges: order.roomCharges,
    allPayments: folioPayments.flatMap((o) => o.payments),
  };
}

export async function getOutstandingRoomBalances() {
  await getSession();
  const bookings = await prisma.booking.findMany({
    where: { status: BookingStatus.CHECKED_IN },
    include: {
      guest: true,
      room: true,
      roomCharges: { where: { voidedAt: null, checkoutOrderId: null } },
    },
  });

  const rows = await Promise.all(
    bookings.map(async (booking) => {
      const { grandTotal } = computeFolioTotals(booking);
      const paid = await sumBookingPayments(booking.id);
      const balance = Math.round(Math.max(0, grandTotal - paid) * 100) / 100;
      return {
        roomNumber: booking.room.number,
        guestName: booking.guest.fullName,
        grandTotal,
        paid,
        balance,
      };
    })
  );

  return rows.filter((r) => r.balance > 0);
}

export async function getTodayRoomBillingStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [checkoutOrders, walkInSales, todayCharges, outstanding] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: { gte: today, lt: tomorrow },
        status: OrderStatus.COMPLETED,
        notes: ROOM_CHECKOUT_NOTE,
      },
    }),
    prisma.order.findMany({
      where: {
        createdAt: { gte: today, lt: tomorrow },
        status: OrderStatus.COMPLETED,
        notes: WALK_IN_ROOM_SALE_NOTE,
      },
    }),
    prisma.roomCharge.findMany({
      where: {
        createdAt: { gte: today, lt: tomorrow },
        voidedAt: null,
      },
    }),
    getOutstandingRoomBalances(),
  ]);

  return {
    todayRoomRevenue:
      checkoutOrders.reduce((s, o) => s + o.total, 0) +
      walkInSales.reduce((s, o) => s + o.total, 0),
    todayPostedCharges: todayCharges.reduce((s, c) => s + c.total, 0),
    outstandingBalances: outstanding.reduce((s, r) => s + r.balance, 0),
    outstandingCount: outstanding.length,
  };
}

export async function getRoomBillingReport(filter: string, startDate?: Date, endDate?: Date) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") throw new AppError("Unauthorized");

  const { resolveReportDateRange } = await import("@/lib/utils");
  const { start, end } = resolveReportDateRange(filter, startDate, endDate);

  const charges = await prisma.roomCharge.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      voidedAt: null,
    },
    include: {
      booking: { include: { guest: true, room: true } },
      product: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return charges.map((c) => ({
    date: c.createdAt,
    room: c.booking.room.number,
    guest: c.booking.guest.fullName,
    type: c.type,
    description: c.description,
    quantity: c.quantity,
    unitPrice: c.unitPrice,
    total: c.total,
    settled: !!c.checkoutOrderId,
  }));
}
