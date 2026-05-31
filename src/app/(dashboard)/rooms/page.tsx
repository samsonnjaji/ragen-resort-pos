import { RoomsClient } from "@/components/rooms/rooms-client";
import { getRooms } from "@/lib/actions/rooms";

export default async function RoomsPage() {
  const rooms = await getRooms();
  return <RoomsClient rooms={rooms} />;
}
