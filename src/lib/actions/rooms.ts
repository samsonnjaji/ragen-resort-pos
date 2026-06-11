"use server";

import prisma from "@/lib/prisma";
import { getSession, logActivity } from "./dashboard";
import { revalidatePath } from "next/cache";
import { BookingStatus, RoomStatus } from "@prisma/client";
import { AppError } from "@/lib/app-error";

export async function getRooms() {
  return prisma.room.findMany({
    orderBy: { number: "asc" },
    include: {
      bookings: {
        where: { status: { in: ["CHECKED_IN", "RESERVED"] } },
        include: { guest: true },
        take: 1,
        orderBy: { checkIn: "desc" },
      },
    },
  });
}

export async function getRoom(id: string) {
  return prisma.room.findUnique({
    where: { id },
    include: {
      bookings: {
        include: { guest: true },
        orderBy: { checkIn: "desc" },
      },
      roomCharges: {
        where: { voidedAt: null },
        include: { product: true, booking: { include: { guest: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function createRoom(data: {
  number: string;
  type: string;
  pricePerNight: number;
  capacity: number;
  description?: string;
  floor?: number;
}) {
  const session = await getSession();
  if (!["ADMIN", "ROOM_MANAGER"].includes(session?.user?.role || "")) {
    throw new Error("Unauthorized");
  }

  const room = await prisma.room.create({ data });
  await logActivity("CREATE", "Room", room.id, room.number);
  revalidatePath("/rooms");
  return room;
}

export async function updateRoom(
  id: string,
  data: Partial<{
    number: string;
    type: string;
    pricePerNight: number;
    capacity: number;
    description: string;
    status: RoomStatus;
    floor: number;
  }>
) {
  const session = await getSession();
  if (!["ADMIN", "ROOM_MANAGER"].includes(session?.user?.role || "")) {
    throw new Error("Unauthorized");
  }

  const room = await prisma.room.update({ where: { id }, data });
  await logActivity("UPDATE", "Room", id);
  revalidatePath("/rooms");
  return room;
}

export async function updateRoomStatus(id: string, status: RoomStatus) {
  const session = await getSession();
  if (!["ADMIN", "ROOM_MANAGER"].includes(session?.user?.role || "")) {
    throw new Error("Unauthorized");
  }

  await prisma.room.update({ where: { id }, data: { status } });
  await logActivity("UPDATE", "Room", id, `Status: ${status}`);
  revalidatePath("/rooms");
}

export async function deleteRoom(id: string) {
  const session = await getSession();
  if (!["ADMIN", "ROOM_MANAGER"].includes(session?.user?.role || "")) {
    throw new AppError("Unauthorized");
  }

  const activeBookings = await prisma.booking.count({
    where: {
      roomId: id,
      status: { in: [BookingStatus.RESERVED, BookingStatus.CHECKED_IN] },
    },
  });
  if (activeBookings > 0) {
    throw new AppError("Cannot delete room — it has an active or reserved booking.");
  }

  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) throw new AppError("Room not found");

  await prisma.room.delete({ where: { id } });
  await logActivity("DELETE", "Room", id, room.number);
  revalidatePath("/rooms");
}

export async function getGuests() {
  return prisma.guest.findMany({ orderBy: { fullName: "asc" } });
}

export async function createGuest(data: {
  fullName: string;
  phone: string;
  email?: string;
  nationalId?: string;
}) {
  const session = await getSession();
  if (!["ADMIN", "ROOM_MANAGER"].includes(session?.user?.role || "")) {
    throw new Error("Unauthorized");
  }

  const guest = await prisma.guest.create({ data });
  await logActivity("CREATE", "Guest", guest.id, guest.fullName);
  revalidatePath("/bookings");
  return guest;
}

export async function getBookings(status?: BookingStatus) {
  return prisma.booking.findMany({
    where: status ? { status } : {},
    include: { guest: true, room: true },
    orderBy: { checkIn: "desc" },
  });
}

export async function createBooking(data: {
  guestId: string;
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  notes?: string;
}) {
  const session = await getSession();
  if (!["ADMIN", "ROOM_MANAGER"].includes(session?.user?.role || "")) {
    throw new Error("Unauthorized");
  }

  const room = await prisma.room.findUnique({ where: { id: data.roomId } });
  if (!room) throw new Error("Room not found");

  const nights = Math.ceil(
    (new Date(data.checkOut).getTime() - new Date(data.checkIn).getTime()) / (1000 * 60 * 60 * 24)
  );
  const totalAmount = nights * room.pricePerNight;

  const booking = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.create({
      data: { ...data, totalAmount, status: BookingStatus.RESERVED },
      include: { guest: true, room: true },
    });

    await tx.room.update({
      where: { id: data.roomId },
      data: { status: RoomStatus.RESERVED },
    });

    return b;
  });

  await logActivity("CREATE", "Booking", booking.id);
  revalidatePath("/bookings");
  revalidatePath("/rooms");
  return booking;
}

export async function checkInBooking(id: string) {
  const session = await getSession();
  if (!["ADMIN", "ROOM_MANAGER"].includes(session?.user?.role || "")) {
    throw new Error("Unauthorized");
  }

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new Error("Booking not found");

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id },
      data: { status: BookingStatus.CHECKED_IN },
    });
    await tx.room.update({
      where: { id: booking.roomId },
      data: { status: RoomStatus.OCCUPIED },
    });
  });

  await logActivity("CHECK_IN", "Booking", id);
  revalidatePath("/bookings");
  revalidatePath("/rooms");
}

export async function checkOutBooking(id: string) {
  const session = await getSession();
  if (!["ADMIN", "ROOM_MANAGER"].includes(session?.user?.role || "")) {
    throw new Error("Unauthorized");
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { room: true },
  });
  if (!booking) throw new Error("Booking not found");
  if (booking.status !== BookingStatus.CHECKED_IN) {
    throw new AppError("Only checked-in bookings can be checked out.");
  }

  const { checkoutRoom, getRoomAccount } = await import("./room-billing");
  const account = await getRoomAccount(booking.roomId);
  if (account.balanceDue > 0.009) {
    throw new AppError(
      `Balance due: KES ${account.balanceDue.toFixed(2)}. Complete payment on the room account before checkout.`
    );
  }

  return checkoutRoom({ roomId: booking.roomId });
}

export async function cancelBooking(id: string) {
  const session = await getSession();
  if (!["ADMIN", "ROOM_MANAGER"].includes(session?.user?.role || "")) {
    throw new Error("Unauthorized");
  }

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new Error("Booking not found");

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED },
    });
    await tx.room.update({
      where: { id: booking.roomId },
      data: { status: RoomStatus.AVAILABLE },
    });
  });

  await logActivity("CANCEL", "Booking", id);
  revalidatePath("/bookings");
  revalidatePath("/rooms");
}

export async function deleteBooking(id: string) {
  const session = await getSession();
  if (!["ADMIN", "ROOM_MANAGER"].includes(session?.user?.role || "")) {
    throw new AppError("Unauthorized");
  }

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new AppError("Booking not found");

  if (booking.status !== BookingStatus.CANCELLED) {
    throw new AppError("Only cancelled bookings can be deleted.");
  }

  await prisma.booking.delete({ where: { id } });
  await logActivity("DELETE", "Booking", id);
  revalidatePath("/bookings");
}

export async function addRoomCharge(data: {
  bookingId: string;
  roomId: string;
  productId?: string;
  type: string;
  description: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}) {
  const { addManualRoomCharge, addProductRoomCharge } = await import("./room-billing");

  if (data.productId) {
    return addProductRoomCharge({
      roomId: data.roomId,
      productId: data.productId,
      quantity: data.quantity,
    });
  }

  return addManualRoomCharge({
    roomId: data.roomId,
    type: data.type as "FOOD" | "DRINKS" | "ALCOHOL" | "LAUNDRY" | "EXTRA_SERVICE" | "ROOM_SERVICE" | "DAMAGE" | "OTHER" | "ACCOMMODATION",
    description: data.description,
    quantity: data.quantity,
    unitPrice: data.unitPrice,
    notes: data.notes,
  });
}

export async function updateRoomCharge(
  id: string,
  data: Partial<{ description: string; quantity: number; unitPrice: number; type: string; notes: string }>
) {
  const { updateRoomBillingCharge } = await import("./room-billing");
  return updateRoomBillingCharge(id, {
    description: data.description,
    quantity: data.quantity,
    unitPrice: data.unitPrice,
    type: data.type as Parameters<typeof updateRoomBillingCharge>[1]["type"],
    notes: data.notes,
  });
}

export async function deleteRoomCharge(id: string) {
  const { voidRoomBillingCharge } = await import("./room-billing");
  return voidRoomBillingCharge(id);
}

export async function getActiveBookings() {
  return prisma.booking.findMany({
    where: { status: BookingStatus.CHECKED_IN },
    include: {
      guest: true,
      room: true,
      roomCharges: { where: { voidedAt: null }, include: { product: true } },
    },
  });
}

export async function getRoomCharges(bookingId?: string) {
  return prisma.roomCharge.findMany({
    where: bookingId ? { bookingId } : {},
    include: {
      booking: { include: { guest: true, room: true } },
      product: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
