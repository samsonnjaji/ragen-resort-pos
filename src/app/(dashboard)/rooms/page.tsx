import { RoomsClient } from "@/components/rooms/rooms-client";
import { getRooms, getGuests } from "@/lib/actions/rooms";
import { getRoomFolioSummaries } from "@/lib/actions/room-billing";

export default async function RoomsPage() {
  const [rooms, folios, guests] = await Promise.all([
    getRooms(),
    getRoomFolioSummaries(),
    getGuests(),
  ]);
  return <RoomsClient rooms={rooms} folios={folios} guests={guests} />;
}
