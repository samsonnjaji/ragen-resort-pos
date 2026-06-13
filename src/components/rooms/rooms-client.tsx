"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { createRoom, updateRoom, updateRoomStatus, deleteRoom } from "@/lib/actions/rooms";
import { completeWalkInRoomSale } from "@/lib/actions/room-billing";
import { formatCurrency, ROOM_STATUS_COLORS, ROOM_STATUS_LABELS } from "@/lib/utils";
import { accommodationDescription, isRoomBillingDisabled } from "@/lib/room-billing";
import { getErrorMessage } from "@/lib/app-error";
import { useToast } from "@/hooks/use-toast";
import { useRequireConnection } from "@/hooks/use-require-connection";
import { Plus, Pencil, Trash2, Receipt, BedDouble, ShoppingCart } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PaymentDialog, PaymentLineDraft } from "@/components/pos/payment-dialog";
import { RoomSaleReceipt } from "@/components/rooms/room-sale-receipt";
import { ReceiptPrintButton } from "@/components/pos/receipt-print-button";
import { BookingStatus, RoomStatus } from "@prisma/client";

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
    bookings: Array<{
      id: string;
      status: BookingStatus;
      guest: { id: string; fullName: string };
    }>;
  }>;
  folios: Record<string, { guestName: string; nightsStayed: number; balanceDue: number }>;
  settings: {
    businessName: string;
    businessAddress: string;
    phone: string;
    receiptFooter: string;
    currency: string;
    receiptSize: string;
    receiptAlignment: string;
    receiptCompact: boolean;
  };
}

export function RoomsClient({ rooms, folios, settings }: RoomsClientProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saleRoom, setSaleRoom] = useState<RoomsClientProps["rooms"][0] | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [saleNights, setSaleNights] = useState(1);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [saleReceipt, setSaleReceipt] = useState<Awaited<ReturnType<typeof completeWalkInRoomSale>> | null>(null);
  const [receiptNights, setReceiptNights] = useState(1);
  const [editing, setEditing] = useState<RoomsClientProps["rooms"][0] | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { blockIfOffline, disabled: offlineDisabled } = useRequireConnection();
  const router = useRouter();

  const saleTotal = saleRoom ? saleRoom.pricePerNight * saleNights : 0;

  const handleRoomCardClick = (room: RoomsClientProps["rooms"][0]) => {
    if (isRoomBillingDisabled(room.status)) return;

    if (room.status === RoomStatus.OCCUPIED) {
      router.push(`/rooms/${room.id}`);
      return;
    }

    if (room.status === RoomStatus.AVAILABLE || room.status === RoomStatus.RESERVED) {
      const booking = room.bookings[0];
      setSaleRoom(room);
      setCustomerName(booking?.guest.fullName ?? "");
      setCustomerPhone("");
      setSaleNights(1);
    }
  };

  const handlePayRoom = async (payments: PaymentLineDraft[]) => {
    if (!saleRoom || blockIfOffline("Processing room sale")) return;
    setLoading(true);
    try {
      const booking = saleRoom.bookings[0];
      const order = await completeWalkInRoomSale({
        roomId: saleRoom.id,
        nights: saleNights,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        payments,
        bookingId: booking?.status === BookingStatus.RESERVED ? booking.id : undefined,
      });
      toast({ title: "Room sale complete", description: `Room ${saleRoom.number} is now occupied` });
      setPaymentOpen(false);
      setReceiptNights(saleNights);
      setSaleRoom(null);
      setSaleReceipt(order);
      router.refresh();
    } catch (err) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const data = {
      number: form.get("number") as string,
      type: form.get("type") as string,
      pricePerNight: Number(form.get("pricePerNight")),
      capacity: Number(form.get("capacity")),
      description: (form.get("description") as string) || undefined,
      floor: Number(form.get("floor")) || 1,
    };
    try {
      if (editing) {
        await updateRoom(editing.id, data);
        toast({ title: "Room updated" });
      } else {
        await createRoom(data);
        toast({ title: "Room created" });
      }
      setDialogOpen(false);
      setEditing(null);
      router.refresh();
    } catch (err) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Sell Room" description="Click an available room to sell — like POS products">
        <Button variant="gold" onClick={() => { setEditing(null); setDialogOpen(true); }}>
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
        {rooms.map((room) => {
          const folio = folios[room.id];
          const billingDisabled = isRoomBillingDisabled(room.status);
          const isClickable =
            room.status === RoomStatus.OCCUPIED ||
            room.status === RoomStatus.AVAILABLE ||
            room.status === RoomStatus.RESERVED;

          return (
            <Card
              key={room.id}
              className={`overflow-hidden transition-all group ${
                billingDisabled
                  ? "opacity-60 cursor-not-allowed"
                  : isClickable
                    ? "cursor-pointer hover:shadow-lg hover:ring-2 hover:ring-emerald-500/40 hover:scale-[1.02]"
                    : ""
              }`}
              onClick={() => isClickable && handleRoomCardClick(room)}
            >
              <div className={`h-2 ${ROOM_STATUS_COLORS[room.status]}`} />
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-bold font-serif">{room.number}</span>
                  <Badge variant="outline" className="text-xs">{room.type}</Badge>
                </div>
                <p className="text-lg font-semibold text-gold">{formatCurrency(room.pricePerNight)}</p>
                <p className="text-xs text-muted-foreground">Room Rate</p>
                <Badge className="mt-2 text-xs" variant="secondary">
                  {ROOM_STATUS_LABELS[room.status]}
                </Badge>
                {(folio || room.bookings[0]) && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-medium truncate">
                      {folio?.guestName ?? room.bookings[0]?.guest.fullName}
                    </p>
                    {folio && (
                      <>
                        <p className="text-xs text-muted-foreground">{folio.nightsStayed} night(s)</p>
                        <p className="text-xs font-semibold text-gold">Balance Due: {formatCurrency(folio.balanceDue)}</p>
                      </>
                    )}
                  </div>
                )}
                {billingDisabled && (
                  <p className="text-xs text-muted-foreground mt-2">Not available for sale</p>
                )}
                {room.status === RoomStatus.OCCUPIED && (
                  <Button
                    size="sm"
                    variant="gold"
                    className="w-full mt-2 h-8"
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link href={`/rooms/${room.id}`}>
                      <Receipt className="h-3 w-3 mr-1" /> Room Bill
                    </Link>
                  </Button>
                )}
                {(room.status === RoomStatus.AVAILABLE || room.status === RoomStatus.RESERVED) && (
                  <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                    <ShoppingCart className="h-3 w-3" /> Click to sell room
                  </p>
                )}
                <Select
                  value={room.status}
                  onValueChange={async (v) => {
                    try {
                      await updateRoomStatus(room.id, v as RoomStatus);
                      toast({ title: "Room status updated" });
                      router.refresh();
                    } catch {
                      toast({ title: "Error", variant: "destructive" });
                    }
                  }}
                >
                  <SelectTrigger className="mt-3 h-8 text-xs" onClick={(e) => e.stopPropagation()}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROOM_STATUS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="outline" className="flex-1 h-8" onClick={() => { setEditing(room); setDialogOpen(true); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-destructive" onClick={() => setDeleteId(room.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Room Sale — POS-style cart */}
      <Dialog open={!!saleRoom} onOpenChange={(o) => !o && setSaleRoom(null)}>
        <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <BedDouble className="h-5 w-5 text-emerald-500" />
              Room Sale — {saleRoom?.number}
            </DialogTitle>
          </DialogHeader>
          {saleRoom && (
            <div className="space-y-4">
              <div className="rounded-lg border-2 border-emerald-500/40 bg-emerald-950/10 p-3">
                <p className="font-medium">{accommodationDescription(saleRoom.number)}</p>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-muted-foreground">Nights: {saleNights}</span>
                  <span className="text-muted-foreground">Rate: {formatCurrency(saleRoom.pricePerNight)}</span>
                </div>
                <div className="flex justify-between font-bold text-gold mt-2 pt-2 border-t border-emerald-500/20">
                  <span>Total</span>
                  <span>{formatCurrency(saleTotal)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Customer name (optional)</Label>
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Walk-in Guest"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone (optional)</Label>
                  <Input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="07..."
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nights</Label>
                <Input
                  type="number"
                  min={1}
                  value={saleNights}
                  onChange={(e) => setSaleNights(Math.max(1, Number(e.target.value)))}
                />
              </div>

              <Button
                variant="gold"
                className="w-full h-12 text-base"
                disabled={loading || offlineDisabled}
                onClick={() => setPaymentOpen(true)}
              >
                Pay Room — {formatCurrency(saleTotal)}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        orderTotal={saleTotal}
        loading={loading}
        disabled={offlineDisabled}
        onComplete={handlePayRoom}
      />

      {/* Receipt after sale */}
      <Dialog open={!!saleReceipt} onOpenChange={(o) => !o && setSaleReceipt(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto print:max-w-none">
          <DialogHeader className="print:hidden">
            <DialogTitle className="font-serif">Room Sale Receipt</DialogTitle>
          </DialogHeader>
          {saleReceipt && saleReceipt.room && saleReceipt.booking && (
            <>
              <RoomSaleReceipt
                orderNumber={saleReceipt.orderNumber}
                completedAt={saleReceipt.completedAt ?? new Date()}
                cashierName={saleReceipt.user.name}
                roomNumber={saleReceipt.room.number}
                roomType={saleReceipt.room.type}
                customerName={saleReceipt.booking.guest.fullName}
                customerPhone={saleReceipt.booking.guest.phone}
                nights={receiptNights}
                unitPrice={saleReceipt.room.pricePerNight}
                total={saleReceipt.total}
                changeGiven={saleReceipt.changeGiven}
                payments={saleReceipt.payments}
                settings={settings}
              />
              <div className="flex gap-2 print:hidden">
                <ReceiptPrintButton
                  targetId="room-sale-receipt"
                  receiptSize={settings.receiptSize}
                  receiptAlignment={settings.receiptAlignment}
                  receiptCompact={settings.receiptCompact}
                  className="flex-1"
                />
                <Button variant="outline" className="flex-1" onClick={() => setSaleReceipt(null)}>Close</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">{editing ? "Edit Room" : "Add Room"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Room Number</Label>
                <Input name="number" required placeholder="101" defaultValue={editing?.number} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Input name="type" required placeholder="Standard" defaultValue={editing?.type} />
              </div>
              <div className="space-y-2">
                <Label>Room Rate (KES/night)</Label>
                <Input name="pricePerNight" type="number" required defaultValue={editing?.pricePerNight} />
              </div>
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input name="capacity" type="number" defaultValue={editing?.capacity ?? 2} />
              </div>
              <div className="space-y-2">
                <Label>Floor</Label>
                <Input name="floor" type="number" defaultValue={editing?.floor ?? 1} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Description</Label>
                <Input name="description" defaultValue={editing?.description || ""} />
              </div>
            </div>
            <Button type="submit" variant="gold" className="w-full" disabled={loading}>
              {editing ? "Update" : "Create"} Room
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        description="Delete this room? Cannot delete if it has an active booking."
        loading={loading}
        onConfirm={async () => {
          if (!deleteId) return;
          setLoading(true);
          try {
            await deleteRoom(deleteId);
            toast({ title: "Room deleted" });
            setDeleteId(null);
            router.refresh();
          } catch (err) {
            toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
          } finally {
            setLoading(false);
          }
        }}
      />
    </div>
  );
}
