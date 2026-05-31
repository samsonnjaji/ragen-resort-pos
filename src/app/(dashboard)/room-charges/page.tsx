import { RoomChargesClient } from "@/components/room-charges/room-charges-client";
import { getActiveBookings } from "@/lib/actions/rooms";
import { getProducts } from "@/lib/actions/products";

export default async function RoomChargesPage() {
  const [activeBookings, products] = await Promise.all([getActiveBookings(), getProducts()]);
  return <RoomChargesClient activeBookings={activeBookings} products={products} />;
}
