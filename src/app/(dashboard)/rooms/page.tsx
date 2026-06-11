import { RoomsClient } from "@/components/rooms/rooms-client";
import { getRooms } from "@/lib/actions/rooms";
import { getRoomFolioSummaries } from "@/lib/actions/room-billing";

export default async function RoomsPage() {
  const [rooms, folios] = await Promise.all([getRooms(), getRoomFolioSummaries()]);
  return <RoomsClient rooms={rooms} folios={folios} />;
}
