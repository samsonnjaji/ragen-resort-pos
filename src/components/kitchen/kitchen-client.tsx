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
import { createKitchenOrder, updateOrderStatus } from "@/lib/actions/products";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { OrderStatus, OrderType } from "@prisma/client";
import { ChefHat, CheckCircle, Clock, Plus, UtensilsCrossed } from "lucide-react";

interface KitchenClientProps {
  orders: Array<{
    id: string;
    orderNumber: string;
    status: OrderStatus;
    tableNumber: string | null;
    total: number;
    createdAt: Date;
    items: Array<{ quantity: number; product: { name: string }; notes: string | null }>;
  }>;
  products: Array<{ id: string; name: string; sellingPrice: number; category: { name: string } }>;
  title: string;
  type: "restaurant" | "bar";
}

const statusFlow: OrderStatus[] = ["PENDING", "PREPARING", "READY", "SERVED"];

export function KitchenClient({ orders, products, title, type }: KitchenClientProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<{ productId: string; quantity: number }[]>([]);
  const [tableNumber, setTableNumber] = useState("");

  const filtered = orders.filter((o) =>
    ["PENDING", "PREPARING", "READY"].includes(o.status)
  );

  const handleStatus = async (id: string, status: OrderStatus) => {
    try {
      await updateOrderStatus(id, status);
      toast({ title: `Order marked as ${status.toLowerCase()}` });
      router.refresh();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const addToCart = (productId: string) => {
    const existing = cart.find((c) => c.productId === productId);
    if (existing) {
      setCart(cart.map((c) => (c.productId === productId ? { ...c, quantity: c.quantity + 1 } : c)));
    } else {
      setCart([...cart, { productId, quantity: 1 }]);
    }
  };

  const submitOrder = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const items = cart.map((c) => {
        const product = products.find((p) => p.id === c.productId)!;
        return { productId: c.productId, quantity: c.quantity, unitPrice: product.sellingPrice };
      });
      await createKitchenOrder({
        items,
        type: type === "restaurant" ? OrderType.RESTAURANT : OrderType.BAR,
        tableNumber: tableNumber || undefined,
      });
      toast({ title: "Order ticket created" });
      setCart([]);
      setTableNumber("");
      setDialogOpen(false);
      router.refresh();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const nextStatus = (current: OrderStatus): OrderStatus | null => {
    const idx = statusFlow.indexOf(current);
    return idx >= 0 && idx < statusFlow.length - 1 ? statusFlow[idx + 1] : null;
  };

  const statusIcon = {
    PENDING: Clock,
    PREPARING: ChefHat,
    READY: CheckCircle,
    SERVED: UtensilsCrossed,
  };

  return (
    <div>
      <PageHeader title={title} description={`${type === "restaurant" ? "Kitchen" : "Bar"} order tickets`}>
        <Button variant="gold" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Ticket
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <Card className="col-span-full"><CardContent className="py-12 text-center text-muted-foreground">No pending orders — create a new ticket</CardContent></Card>
        ) : (
          filtered.map((order) => {
            const Icon = statusIcon[order.status as keyof typeof statusIcon] || Clock;
            const next = nextStatus(order.status);
            return (
              <Card key={order.id} className="border-l-4 border-l-gold">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-gold" />
                      <span className="font-bold">{order.orderNumber}</span>
                    </div>
                    <Badge variant="warning">{order.status}</Badge>
                  </div>
                  {order.tableNumber && <p className="text-sm text-muted-foreground mb-2">Table: {order.tableNumber}</p>}
                  <div className="space-y-1 mb-3">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{item.quantity}x {item.product.name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</span>
                    {next && (
                      <Button size="sm" variant="gold" onClick={() => handleStatus(order.id, next)}>
                        Mark {next}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">New {type === "restaurant" ? "Kitchen" : "Bar"} Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Table Number (optional)</Label>
              <Input value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} placeholder="e.g. 5" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p.id)}
                  className="p-3 rounded-lg border text-left hover:border-gold/50 transition-colors"
                >
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(p.sellingPrice)}</p>
                </button>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-sm font-medium">Selected ({cart.length})</p>
                {cart.map((c) => {
                  const p = products.find((pr) => pr.id === c.productId);
                  return (
                    <div key={c.productId} className="flex justify-between text-sm">
                      <span>{c.quantity}x {p?.name}</span>
                      <span>{formatCurrency((p?.sellingPrice || 0) * c.quantity)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <Button variant="gold" className="w-full" onClick={submitOrder} disabled={loading || cart.length === 0}>
              Submit Ticket
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
