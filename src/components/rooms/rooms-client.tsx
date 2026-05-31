"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createRoom, updateRoomStatus } from "@/lib/actions/rooms";
import { formatCurrency, ROOM_STATUS_COLORS, ROOM_STATUS_LABELS } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { RoomStatus } from "@prisma/client";

interface RoomsClientProps {
  rooms: Array<{
    id: string;
    number: string;
    type: string;
    pricePerNight: number;
    capacity: number;
    description: string | null;
    status: RoomStatus;
    floor: number;
    bookings: Array<{ guest: { fullName: string } }>;
  }>;
}

export function RoomsClient({ rooms }: RoomsClientProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      await createRoom({
        number: form.get("number") as string,
        type: form.get("type") as string,
        pricePerNight: Number(form.get("pricePerNight")),
        capacity: Number(form.get("capacity")),
        description: (form.get("description") as string) || undefined,
        floor: Number(form.get("floor")) || 1,
      });
      toast({ title: "Room created" });
      setDialogOpen(false);
      router.refresh();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: RoomStatus) => {
    try {
      await updateRoomStatus(id, status);
      toast({ title: "Room status updated" });
      router.refresh();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  return (
    <div>
      <PageHeader title="Rooms" description="Visual room dashboard and management">
        <Button variant="gold" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Room
        </Button>
      </PageHeader>

      <div className="flex flex-wrap gap-4 mb-6 text-sm">
        {Object.entries(ROOM_STATUS_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${ROOM_STATUS_COLORS[key]}`} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {rooms.map((room) => (
          <Card
            key={room.id}
            className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
          >
            <div className={`h-2 ${ROOM_STATUS_COLORS[room.status]}`} />
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold font-serif">{room.number}</span>
                <Badge variant="outline" className="text-xs">{room.type}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{formatCurrency(room.pricePerNight)}/night</p>
              <p className="text-xs text-muted-foreground mt-1">Capacity: {room.capacity}</p>
              {room.bookings[0] && (
                <p className="text-xs mt-2 truncate">{room.bookings[0].guest.fullName}</p>
              )}
              <Select
                value={room.status}
                onValueChange={(v) => handleStatusChange(room.id, v as RoomStatus)}
              >
                <SelectTrigger className="mt-3 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROOM_STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Add Room</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Room Number</Label>
                <Input name="number" required placeholder="101" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Input name="type" required placeholder="Standard" />
              </div>
              <div className="space-y-2">
                <Label>Price/Night (KES)</Label>
                <Input name="pricePerNight" type="number" required />
              </div>
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input name="capacity" type="number" defaultValue={2} />
              </div>
              <div className="space-y-2">
                <Label>Floor</Label>
                <Input name="floor" type="number" defaultValue={1} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Description</Label>
                <Input name="description" />
              </div>
            </div>
            <Button type="submit" variant="gold" className="w-full" disabled={loading}>Create Room</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
