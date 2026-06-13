"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  addManualRoomCharge,
  addProductRoomCharge,
  addRoomAccommodation,
  recordRoomPayment,
  releaseRoom,
  updateRoomAccommodation,
  updateRoomBillingCharge,
  voidRoomBillingCharge,
} from "@/lib/actions/room-billing";
import { formatCurrency, formatDate, ROOM_STATUS_COLORS, ROOM_STATUS_LABELS } from "@/lib/utils";
import { ROOM_CHARGE_CATEGORIES } from "@/lib/room-billing";
import { getErrorMessage } from "@/lib/app-error";
import { useToast } from "@/hooks/use-toast";
import { useRequireConnection } from "@/hooks/use-require-connection";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  CreditCard,
  Package,
  Receipt,
  LogOut,
  Search,
  BedDouble,
  Minus,
  Plus as PlusIcon,
  DoorOpen,
} from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PaymentDialog, PaymentLineDraft } from "@/components/pos/payment-dialog";
import { RoomInvoice } from "@/components/rooms/room-invoice";
import { ReceiptPrintButton } from "@/components/pos/receipt-print-button";
import { RoomChargeType, RoomStatus } from "@prisma/client";

type RoomAccount = NonNullable<Awaited<ReturnType<typeof import("@/lib/actions/room-billing").getRoomAccount>>>;

interface RoomAccountClientProps {
  account: RoomAccount;
  products: Array<{ id: string; name: string; sellingPrice: number; stock: number; category: { type: string } }>;
  settings: {
    businessName: string;
    businessAddress: string;
    phone: string;
    email: string;
    currency: string;
    receiptSize: string;
    receiptAlignment: string;
    receiptFontSize: string;
    receiptBoldText: boolean;
    receiptSpacing: string;
    receiptCompact: boolean;
  };
  isAdmin: boolean;
}

export function RoomAccountClient({ account, products, settings, isAdmin }: RoomAccountClientProps) {
  const { room, booking } = account;
  const [productDialog, setProductDialog] = useState(false);
  const [manualDialog, setManualDialog] = useState(false);
  const [editCharge, setEditCharge] = useState<(typeof account.charges)[0] | null>(null);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState<Awaited<ReturnType<typeof releaseRoom>> | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [productQty, setProductQty] = useState(1);
  const [editAccommodation, setEditAccommodation] = useState(false);
  const [accNights, setAccNights] = useState(account.accommodationCharge?.quantity ?? account.nightsStayed);
  const [accRate, setAccRate] = useState(account.accommodationCharge?.unitPrice ?? room.pricePerNight);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { blockIfOffline, disabled: offlineDisabled } = useRequireConnection();
  const router = useRouter();

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    if (!q) return products.slice(0, 20);
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 20);
  }, [products, productSearch]);

  const canBill = booking && room.status === RoomStatus.OCCUPIED;
  const accommodationCharge = account.accommodationCharge;
  const otherCharges = account.otherCharges ?? account.charges.filter((c) => c.type !== "ACCOMMODATION");

  const handleAddRoomRate = async () => {
    if (blockIfOffline("Adding room rate")) return;
    setLoading(true);
    try {
      await addRoomAccommodation({ roomId: room.id });
      toast({ title: "Room rate added to bill" });
      router.refresh();
    } catch (err) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAccommodation = async () => {
    if (blockIfOffline("Updating accommodation")) return;
    setLoading(true);
    try {
      await updateRoomAccommodation({ roomId: room.id, nights: accNights, unitPrice: accRate });
      toast({ title: "Accommodation updated" });
      setEditAccommodation(false);
      router.refresh();
    } catch (err) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async () => {
    if (!selectedProduct || blockIfOffline("Adding product charge")) return;
    setLoading(true);
    try {
      await addProductRoomCharge({ roomId: room.id, productId: selectedProduct, quantity: productQty });
      toast({ title: "Product charge added" });
      setProductDialog(false);
      setSelectedProduct("");
      setProductQty(1);
      router.refresh();
    } catch (err) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (blockIfOffline("Adding manual charge")) return;
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      await addManualRoomCharge({
        roomId: room.id,
        type: form.get("type") as RoomChargeType,
        description: form.get("description") as string,
        quantity: Number(form.get("quantity")),
        unitPrice: Number(form.get("unitPrice")),
        notes: (form.get("notes") as string) || undefined,
      });
      toast({ title: "Charge added" });
      setManualDialog(false);
      router.refresh();
    } catch (err) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editCharge || blockIfOffline("Updating charge")) return;
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      await updateRoomBillingCharge(editCharge.id, {
        description: form.get("description") as string,
        type: form.get("type") as RoomChargeType,
        quantity: Number(form.get("quantity")),
        unitPrice: Number(form.get("unitPrice")),
        notes: (form.get("notes") as string) || undefined,
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

  const handlePayment = async (payments: PaymentLineDraft[]) => {
    if (blockIfOffline("Recording payment")) return;
    setLoading(true);
    try {
      await recordRoomPayment({ roomId: room.id, payments });
      toast({ title: "Payment recorded" });
      setPaymentOpen(false);
      router.refresh();
    } catch (err) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseRoom = async (payments?: PaymentLineDraft[]) => {
    if (blockIfOffline("Releasing room")) return;
    setLoading(true);
    try {
      if (account.balanceDue > 0.009 && payments?.length) {
        await recordRoomPayment({ roomId: room.id, payments });
      }
      const order = await releaseRoom({ roomId: room.id });
      toast({ title: "Room released", description: "Customer has left — room marked for cleaning" });
      setCheckoutOpen(false);
      setInvoiceOrder(order);
      router.refresh();
    } catch (err) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={`Room ${room.number} — Room Bill`}
        description={booking ? `${booking.guest.fullName}'s folio` : "No active booking"}
      >
        <Button variant="outline" asChild>
          <Link href="/rooms"><ArrowLeft className="h-4 w-4 mr-1" /> Back to Rooms</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-emerald-500/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="font-serif text-xl">Room {room.number}</CardTitle>
                <Badge className={ROOM_STATUS_COLORS[room.status]}>{ROOM_STATUS_LABELS[room.status]}</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-3 text-sm">
              <Info label="Type" value={room.type} />
              <Info label="Room Rate" value={`${formatCurrency(room.pricePerNight)} / night`} />
              {booking ? (
                <>
                  <Info label="Guest" value={booking.guest.fullName} />
                  <Info label="Phone" value={booking.guest.phone} />
                  <Info label="Check-in" value={formatDate(booking.checkIn)} />
                  <Info label="Expected checkout" value={formatDate(booking.checkOut)} />
                  <Info label="Nights" value={String(account.nightsStayed)} />
                </>
              ) : (
                <p className="sm:col-span-2 text-muted-foreground">No checked-in guest</p>
              )}
            </CardContent>
          </Card>

          {canBill && (
            <div className="flex flex-wrap gap-2">
              {!account.hasAccommodation && (
                <Button variant="gold" onClick={handleAddRoomRate} disabled={offlineDisabled || loading}>
                  <BedDouble className="h-4 w-4 mr-1" /> Add Room Rate
                </Button>
              )}
              <Button variant="gold" onClick={() => setProductDialog(true)} disabled={offlineDisabled}>
                <Package className="h-4 w-4 mr-1" /> Add Product
              </Button>
              <Button variant="outline" onClick={() => setManualDialog(true)} disabled={offlineDisabled}>
                <Plus className="h-4 w-4 mr-1" /> Manual Charge
              </Button>
              {account.balanceDue > 0 && (
                <Button variant="outline" onClick={() => setPaymentOpen(true)} disabled={offlineDisabled}>
                  <CreditCard className="h-4 w-4 mr-1" /> Take Payment
                </Button>
              )}
              <Button
                variant="default"
                className="bg-emerald-700 hover:bg-emerald-800"
                onClick={() => {
                  if (account.balanceDue > 0.009) {
                    setCheckoutOpen(true);
                    return;
                  }
                  handleReleaseRoom();
                }}
                disabled={offlineDisabled || loading}
              >
                <DoorOpen className="h-4 w-4 mr-1" /> Release Room
              </Button>
              {isAdmin && account.balanceDue > 0.009 && (
                <Button
                  variant="outline"
                  className="border-destructive text-destructive"
                  disabled={offlineDisabled || loading}
                  onClick={async () => {
                    if (blockIfOffline("Force releasing room")) return;
                    setLoading(true);
                    try {
                      const order = await releaseRoom({ roomId: room.id, adminOverride: true });
                      toast({ title: "Room force-released (admin)" });
                      setInvoiceOrder(order);
                      router.refresh();
                    } catch (err) {
                      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Force Release (Admin)
                </Button>
              )}
            </div>
          )}

          <Card className="border-emerald-500/30">
            <CardHeader>
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <Receipt className="h-5 w-5 text-emerald-600" /> Room Bill Cart
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!canBill ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  Room Bill is only available for occupied rooms with an active check-in.
                </p>
              ) : (
                <div className="space-y-2">
                  {/* Accommodation line — POS-style */}
                  {accommodationCharge ? (
                    <div className="p-3 rounded-lg border-2 border-emerald-500/40 bg-emerald-950/10">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{accommodationCharge.description}</p>
                          <Badge variant="outline" className="text-xs mt-1">Accommodation</Badge>
                          {!editAccommodation ? (
                            <p className="text-xs text-muted-foreground mt-1">
                              Nights: {accommodationCharge.quantity} × {formatCurrency(accommodationCharge.unitPrice)} Room Rate
                            </p>
                          ) : (
                            <div className="flex gap-2 mt-2 items-center">
                              <Label className="text-xs shrink-0">Nights</Label>
                              <div className="flex items-center gap-1">
                                <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => setAccNights(Math.max(1, accNights - 1))}>
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Input type="number" min={1} value={accNights} onChange={(e) => setAccNights(Math.max(1, Number(e.target.value)))} className="h-7 w-14 text-center" />
                                <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => setAccNights(accNights + 1)}>
                                  <PlusIcon className="h-3 w-3" />
                                </Button>
                              </div>
                              <Input type="number" min={0} value={accRate} onChange={(e) => setAccRate(Number(e.target.value))} className="h-7 w-24" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="font-bold text-gold text-lg">{formatCurrency(accommodationCharge.total)}</span>
                          <div className="flex gap-1">
                            {editAccommodation ? (
                              <>
                                <Button size="sm" variant="gold" className="h-7" disabled={loading} onClick={handleUpdateAccommodation}>Save</Button>
                                <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditAccommodation(false)}>Cancel</Button>
                              </>
                            ) : (
                              <>
                                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={offlineDisabled} onClick={() => { setAccNights(accommodationCharge.quantity); setAccRate(accommodationCharge.unitPrice); setEditAccommodation(true); }}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" disabled={offlineDisabled} onClick={() => setVoidId(accommodationCharge.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg border border-dashed text-center text-sm text-muted-foreground">
                      <p>No room rate on bill yet</p>
                      <Button variant="gold" size="sm" className="mt-2" onClick={handleAddRoomRate} disabled={offlineDisabled || loading}>
                        Add Room Rate — {formatCurrency(room.pricePerNight)}/night
                      </Button>
                    </div>
                  )}

                  {otherCharges.map((charge) => (
                    <div
                      key={charge.id}
                      className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-card hover:bg-muted/30"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{charge.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-xs">{charge.type}</Badge>
                          <span className="text-xs text-muted-foreground">
                            Qty: {charge.quantity} × {formatCurrency(charge.unitPrice)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold text-gold">{formatCurrency(charge.total)}</span>
                        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={offlineDisabled} onClick={() => setEditCharge(charge)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" disabled={offlineDisabled} onClick={() => setVoidId(charge.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {account.hasAccommodation && otherCharges.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">Add products or manual charges above</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-gold/40 bg-gradient-to-br from-emerald-950/20 to-amber-950/10 sticky top-4">
            <CardHeader>
              <CardTitle className="font-serif text-lg text-gold">Room Bill</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <SummaryRow label="Accommodation" value={formatCurrency(account.accommodationSubtotal)} />
              <SummaryRow label="Other charges" value={formatCurrency(account.postedChargesSubtotal)} />
              <div className="border-t pt-2">
                <SummaryRow label="Subtotal" value={formatCurrency(account.grandTotal ?? 0)} bold />
              </div>
              <SummaryRow label="Paid" value={`− ${formatCurrency(account.paymentsMade)}`} className="text-emerald-400" />
              <div className="border-t border-gold/30 pt-3">
                <SummaryRow
                  label="Balance Due"
                  value={formatCurrency(account.balanceDue)}
                  bold
                  className="text-gold text-lg"
                />
              </div>
            </CardContent>
          </Card>

          {account.payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-sm">Payment History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {account.payments.flatMap((order) =>
                  order.payments.map((p) => (
                    <div key={p.id} className="flex justify-between">
                      <span className="text-muted-foreground">{p.method}</span>
                      <span>{formatCurrency(p.amount)}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Product dialog */}
      <Dialog open={productDialog} onOpenChange={setProductDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Add Product Charge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`w-full text-left p-2 rounded text-sm hover:bg-muted ${
                    selectedProduct === p.id ? "bg-emerald-500/20 border border-emerald-500/50" : ""
                  }`}
                  onClick={() => setSelectedProduct(p.id)}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground ml-2">{formatCurrency(p.sellingPrice)}</span>
                  <span className="text-xs text-muted-foreground ml-2">Stock: {p.stock}</span>
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                value={productQty}
                onChange={(e) => setProductQty(Number(e.target.value))}
              />
            </div>
            <Button
              variant="gold"
              className="w-full"
              disabled={!selectedProduct || loading || offlineDisabled}
              onClick={handleAddProduct}
            >
              Add to Room Bill
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual charge dialog */}
      <Dialog open={manualDialog} onOpenChange={setManualDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Manual Charge</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select name="type" defaultValue="LAUNDRY">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROOM_CHARGE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Description</Label><Input name="description" required placeholder="e.g. Late checkout fee" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Quantity</Label><Input name="quantity" type="number" min={1} defaultValue={1} /></div>
              <div className="space-y-2"><Label>Unit Price</Label><Input name="unitPrice" type="number" min={0} step="0.01" required /></div>
            </div>
            <div className="space-y-2"><Label>Note (optional)</Label><Input name="notes" placeholder="Internal note" /></div>
            <Button type="submit" variant="gold" className="w-full" disabled={loading || offlineDisabled}>Add Charge</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit charge dialog */}
      <Dialog open={!!editCharge} onOpenChange={(o) => !o && setEditCharge(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">Edit Charge</DialogTitle></DialogHeader>
          {editCharge && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select name="type" defaultValue={editCharge.type}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROOM_CHARGE_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Description</Label><Input name="description" required defaultValue={editCharge.description} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Quantity</Label><Input name="quantity" type="number" min={1} required defaultValue={editCharge.quantity} /></div>
                <div className="space-y-2"><Label>Unit Price</Label><Input name="unitPrice" type="number" required defaultValue={editCharge.unitPrice} /></div>
              </div>
              <Button type="submit" variant="gold" className="w-full" disabled={loading || offlineDisabled}>Update</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!voidId}
        onOpenChange={(o) => !o && setVoidId(null)}
        description="Remove this charge from the room bill? Product stock will be restored if applicable."
        loading={loading}
        onConfirm={async () => {
          if (!voidId || blockIfOffline("Removing charge")) return;
          setLoading(true);
          try {
            await voidRoomBillingCharge(voidId);
            toast({ title: "Charge removed" });
            setVoidId(null);
            router.refresh();
          } catch (err) {
            toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
          } finally {
            setLoading(false);
          }
        }}
      />

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        orderTotal={account.balanceDue}
        loading={loading}
        disabled={offlineDisabled}
        onComplete={handlePayment}
      />

      <PaymentDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        orderTotal={account.balanceDue}
        loading={loading}
        disabled={offlineDisabled || (account.balanceDue <= 0 && false)}
        onComplete={handleReleaseRoom}
      />

      {/* Invoice after checkout */}
      <Dialog open={!!invoiceOrder} onOpenChange={(o) => !o && setInvoiceOrder(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto print:max-w-none">
          <DialogHeader className="print:hidden">
            <DialogTitle className="font-serif">Room Invoice</DialogTitle>
          </DialogHeader>
          {invoiceOrder && booking && (
            <>
              <RoomInvoice
                orderNumber={invoiceOrder.orderNumber}
                completedAt={invoiceOrder.completedAt ?? new Date()}
                cashierName={invoiceOrder.user.name}
                guest={booking.guest}
                room={{ number: room.number, type: room.type }}
                checkIn={booking.checkIn}
                checkOut={booking.checkOut}
                nightsStayed={account.nightsStayed}
                roomRate={room.pricePerNight}
                accommodationSubtotal={account.accommodationSubtotal}
                charges={account.charges}
                payments={[
                  ...account.payments.flatMap((o) => o.payments),
                  ...invoiceOrder.payments,
                ]}
                grandTotal={invoiceOrder.total}
                settings={settings}
              />
              <div className="flex gap-2 print:hidden">
                <ReceiptPrintButton
                  targetId="room-invoice"
                  receiptSize={settings.receiptSize}
                  receiptAlignment={settings.receiptAlignment}
                  receiptFontSize={settings.receiptFontSize}
                  receiptBoldText={settings.receiptBoldText}
                  receiptSpacing={settings.receiptSpacing}
                  receiptCompact={settings.receiptCompact}
                  label="Print Invoice"
                  className="flex-1"
                />
                <Button variant="outline" className="flex-1" onClick={() => setInvoiceOrder(null)}>Close</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  bold,
  className,
}: {
  label: string;
  value: string;
  bold?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex justify-between ${className ?? ""}`}>
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={bold ? "font-bold" : ""}>{value}</span>
    </div>
  );
}
