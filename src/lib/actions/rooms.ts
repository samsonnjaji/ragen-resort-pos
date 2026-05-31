"use server";

import prisma from "@/lib/prisma";
import { getSession, logActivity } from "./dashboard";
import { revalidatePath } from "next/cache";
import { BookingStatus, RoomStatus } from "@prisma/client";

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
    include: { roomCharges: true },
  });
  if (!booking) throw new Error("Booking not found");

  const chargesTotal = booking.roomCharges.reduce((sum, c) => sum + c.total, 0);
  const grandTotal = booking.totalAmount + chargesTotal;

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id },
      data: { status: BookingStatus.CHECKED_OUT, totalAmount: grandTotal },
    });
    await tx.room.update({
      where: { id: booking.roomId },
      data: { status: RoomStatus.CLEANING },
    });
  });

  await logActivity("CHECK_OUT", "Booking", id, `Total: ${grandTotal}`);
  revalidatePath("/bookings");
  revalidatePath("/rooms");
  revalidatePath("/room-charges");
  return { grandTotal, roomCharges: booking.roomCharges };
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

export async function addRoomCharge(data: {
  bookingId: string;
  roomId: string;
  productId?: string;
  type: string;
  description: string;
  quantity: number;
  unitPrice: number;
}) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const total = data.quantity * data.unitPrice;

  const charge = await prisma.roomCharge.create({
    data: {
      bookingId: data.bookingId,
      roomId: data.roomId,
      productId: data.productId,
      type: data.type as "FOOD" | "DRINKS" | "ALCOHOL" | "LAUNDRY" | "EXTRA_SERVICE" | "ACCOMMODATION",
      description: data.description,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      total,
    },
    include: { product: true },
  });

  await logActivity("CREATE", "RoomCharge", charge.id);
  revalidatePath("/room-charges");
  return charge;
}

export async function getActiveBookings() {
  return prisma.booking.findMany({
    where: { status: BookingStatus.CHECKED_IN },
    include: {
      guest: true,
      room: true,
      roomCharges: { include: { product: true } },
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
