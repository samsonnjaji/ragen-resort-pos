import { BookingsClient } from "@/components/bookings/bookings-client";
import { getBookings, getGuests, getRooms } from "@/lib/actions/rooms";

export default async function BookingsPage() {
  const [bookings, guests, rooms] = await Promise.all([getBookings(), getGuests(), getRooms()]);
  return <BookingsClient bookings={bookings} guests={guests} rooms={rooms} />;
}
