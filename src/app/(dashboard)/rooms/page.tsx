import { RoomsClient } from "@/components/rooms/rooms-client";
import { getRooms } from "@/lib/actions/rooms";
import { getRoomFolioSummaries } from "@/lib/actions/room-billing";
import { getSettings } from "@/lib/actions/dashboard";

export default async function RoomsPage() {
  const [rooms, folios, settings] = await Promise.all([
    getRooms(),
    getRoomFolioSummaries(),
    getSettings(),
  ]);
  return (
    <RoomsClient
      rooms={rooms}
      folios={folios}
      settings={{
        businessName: settings.businessName,
        businessAddress: settings.businessAddress,
        phone: settings.phone,
        receiptFooter: settings.receiptFooter,
        currency: settings.currency,
      }}
    />
  );
}
