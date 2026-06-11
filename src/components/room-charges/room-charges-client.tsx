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
import { addRoomCharge, updateRoomCharge, deleteRoomCharge } from "@/lib/actions/rooms";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getErrorMessage } from "@/lib/app-error";
import { useToast } from "@/hooks/use-toast";
import { useRequireConnection } from "@/hooks/use-require-connection";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface RoomChargesClientProps {
  activeBookings: Array<{
    id: string;
    totalAmount: number;
    guest: { fullName: string };
    room: { id: string; number: string };
    roomCharges: Array<{
      id: string;
      type: string;
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
      createdAt: Date;
    }>;
  }>;
  products: Array<{ id: string; name: string; sellingPrice: number; category: { type: string } }>;
}

export function RoomChargesClient({ activeBookings, products }: RoomChargesClientProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCharge, setEditCharge] = useState<{ id: string; description: string; quantity: number; unitPrice: number } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { blockIfOffline, disabled: offlineDisabled } = useRequireConnection();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (blockIfOffline("Adding a room charge")) return;
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const booking = activeBookings.find((b) => b.id === selectedBooking);
    if (!booking) return;

    try {
      await addRoomCharge({
        bookingId: booking.id,
        roomId: booking.room.id,
        productId: (form.get("productId") as string) || undefined,
        type: form.get("type") as string,
        description: form.get("description") as string,
        quantity: Number(form.get("quantity")),
        unitPrice: Number(form.get("unitPrice")),
      });
      toast({ title: "Charge added" });
      setDialogOpen(false);
      router.refresh();
    } catch (err) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editCharge || blockIfOffline("Updating a room charge")) return;
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      await updateRoomCharge(editCharge.id, {
        description: form.get("description") as string,
        quantity: Number(form.get("quantity")),
        unitPrice: Number(form.get("unitPrice")),
      });
      toast({ title: "Charge updated" });
      setEditCharge(null);
      router.refresh();
    } catch (err) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Room Billing" description="Add charges to guest room accounts">
        <Button variant="gold" onClick={() => setDialogOpen(true)} disabled={activeBookings.length === 0 || offlineDisabled}>
          <Plus className="h-4 w-4 mr-1" /> Add Charge
        </Button>
      </PageHeader>

      {activeBookings.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No checked-in guests</CardContent></Card>
      ) : (
        activeBookings.map((booking) => {
          const grandTotal = booking.roomCharges.reduce((s, c) => s + c.total, 0);
          const accommodation = booking.roomCharges.find((c) => c.type === "ACCOMMODATION");
          const otherTotal = booking.roomCharges.filter((c) => c.type !== "ACCOMMODATION").reduce((s, c) => s + c.total, 0);
          return (
            <Card key={booking.id} className="mb-4">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="font-medium text-lg">{booking.guest.fullName}</p>
                    <p className="text-sm text-muted-foreground">Room {booking.room.number}</p>
                  </div>
                  <div className="text-right">
                    {accommodation && (
                      <p className="text-sm text-muted-foreground">Accommodation: {formatCurrency(accommodation.total)}</p>
                    )}
                    <p className="text-sm text-muted-foreground">Other charges: {formatCurrency(otherTotal)}</p>
                    <p className="text-lg font-bold text-gold">Balance: {formatCurrency(grandTotal)}</p>
                  </div>
                </div>
                {booking.roomCharges.length > 0 && (
                  <div className="space-y-2 border-t pt-3">
                    {booking.roomCharges.map((charge) => (
                      <div key={charge.id} className="flex justify-between items-center text-sm">
                        <div>
                          <span>{charge.description}</span>
                          <Badge variant="outline" className="ml-2 text-xs">{charge.type}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>{formatCurrency(charge.total)}</span>
                          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={offlineDisabled} onClick={() => setEditCharge({ id: charge.id, description: charge.description, quantity: charge.quantity, unitPrice: charge.unitPrice })}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" disabled={offlineDisabled} onClick={() => setDeleteId(charge.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">Add Room Charge</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Guest / Room</Label>
              <Select value={selectedBooking} onValueChange={setSelectedBooking} required>
                <SelectTrigger><SelectValue placeholder="Select guest" /></SelectTrigger>
                <SelectContent>
                  {activeBookings.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.guest.fullName} — Room {b.room.number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Charge Type</Label>
              <Select name="type" defaultValue="FOOD">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FOOD">Food</SelectItem>
                  <SelectItem value="DRINKS">Drinks</SelectItem>
                  <SelectItem value="ALCOHOL">Alcohol</SelectItem>
                  <SelectItem value="LAUNDRY">Laundry</SelectItem>
                  <SelectItem value="EXTRA_SERVICE">Extra Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Product (optional)</Label>
              <Select name="productId" onValueChange={(v) => {
                const product = products.find((p) => p.id === v);
                if (product) {
                  const descInput = document.querySelector('input[name="description"]') as HTMLInputElement;
                  const priceInput = document.querySelector('input[name="unitPrice"]') as HTMLInputElement;
                  if (descInput) descInput.value = product.name;
                  if (priceInput) priceInput.value = String(product.sellingPrice);
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Description</Label><Input name="description" required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Quantity</Label><Input name="quantity" type="number" defaultValue={1} min={1} /></div>
              <div className="space-y-2"><Label>Unit Price</Label><Input name="unitPrice" type="number" required /></div>
            </div>
            <Button type="submit" variant="gold" className="w-full" disabled={loading || !selectedBooking || offlineDisabled}>Add Charge</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editCharge} onOpenChange={(open) => !open && setEditCharge(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">Edit Charge</DialogTitle></DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Description</Label><Input name="description" required defaultValue={editCharge?.description} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Quantity</Label><Input name="quantity" type="number" min={1} required defaultValue={editCharge?.quantity} /></div>
              <div className="space-y-2"><Label>Unit Price</Label><Input name="unitPrice" type="number" required defaultValue={editCharge?.unitPrice} /></div>
            </div>
            <Button type="submit" variant="gold" className="w-full" disabled={loading || offlineDisabled}>Update Charge</Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        description="Delete this room charge?"
        loading={loading}
        onConfirm={async () => {
          if (!deleteId || blockIfOffline("Deleting a room charge")) return;
          setLoading(true);
          try {
            await deleteRoomCharge(deleteId);
            toast({ title: "Charge deleted" });
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
