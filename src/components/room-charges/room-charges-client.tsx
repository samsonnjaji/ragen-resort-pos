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
import { addRoomCharge } from "@/lib/actions/rooms";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

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
  const [selectedBooking, setSelectedBooking] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Room Billing" description="Add charges to guest room accounts">
        <Button variant="gold" onClick={() => setDialogOpen(true)} disabled={activeBookings.length === 0}>
          <Plus className="h-4 w-4 mr-1" /> Add Charge
        </Button>
      </PageHeader>

      {activeBookings.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No checked-in guests</CardContent></Card>
      ) : (
        activeBookings.map((booking) => {
          const chargesTotal = booking.roomCharges.reduce((s, c) => s + c.total, 0);
          const grandTotal = booking.totalAmount + chargesTotal;
          return (
            <Card key={booking.id} className="mb-4">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="font-medium text-lg">{booking.guest.fullName}</p>
                    <p className="text-sm text-muted-foreground">Room {booking.room.number}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Room: {formatCurrency(booking.totalAmount)}</p>
                    <p className="text-sm text-muted-foreground">Charges: {formatCurrency(chargesTotal)}</p>
                    <p className="text-lg font-bold text-gold">Total: {formatCurrency(grandTotal)}</p>
                  </div>
                </div>
                {booking.roomCharges.length > 0 && (
                  <div className="space-y-2 border-t pt-3">
                    {booking.roomCharges.map((charge) => (
                      <div key={charge.id} className="flex justify-between text-sm">
                        <div>
                          <span>{charge.description}</span>
                          <Badge variant="outline" className="ml-2 text-xs">{charge.type}</Badge>
                        </div>
                        <span>{formatCurrency(charge.total)}</span>
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
            <Button type="submit" variant="gold" className="w-full" disabled={loading || !selectedBooking}>Add Charge</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
