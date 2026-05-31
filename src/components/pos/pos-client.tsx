"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { usePOSStore, calculateCartTotals } from "@/store/pos-store";
import { formatCurrency } from "@/lib/utils";
import { completeSale, holdSale, getHeldSales, cancelOrder } from "@/lib/actions/products";
import { getSettings } from "@/lib/actions/dashboard";
import { Receipt, printReceipt } from "@/components/pos/receipt";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Pause,
  Play,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  Split,
  Printer,
} from "lucide-react";
import { PaymentMethod } from "@prisma/client";

interface Product {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
  stock: number;
  categoryId: string;
  category: { id: string; name: string; type: string };
}

interface Category {
  id: string;
  name: string;
}

interface POSPageProps {
  products: Product[];
  categories: Category[];
  taxRate: number;
}

export function POSClient({ products, categories, taxRate }: POSPageProps) {
  const { cart, discount, addItem, removeItem, updateQuantity, setDiscount, clearCart, loadCart } = usePOSStore();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [heldSales, setHeldSales] = useState<Awaited<ReturnType<typeof getHeldSales>>>([]);
  const [completedOrder, setCompletedOrder] = useState<Awaited<ReturnType<typeof completeSale>> | null>(null);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof getSettings>> | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [splitPayments, setSplitPayments] = useState<{ method: PaymentMethod; amount: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const { subtotal, tax, total } = calculateCartTotals(cart, discount, taxRate);

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "all" || p.categoryId === selectedCategory;
    return matchesSearch && matchesCategory && p.stock > 0;
  });

  const refreshHeld = useCallback(async () => {
    const held = await getHeldSales();
    setHeldSales(held);
  }, []);

  useEffect(() => {
    refreshHeld();
  }, [refreshHeld]);

  const handleCompleteSale = async () => {
    if (cart.length === 0) return;
    setLoading(true);

    try {
      const payments =
        paymentMethod === "SPLIT"
          ? splitPayments
          : [{ method: paymentMethod, amount: total }];

      const order = await completeSale({
        items: cart.map((c) => ({
          productId: c.productId,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
        })),
        discount,
        tax,
        payments,
      });

      const s = await getSettings();
      setSettings(s);
      setCompletedOrder(order);
      clearCart();
      setPaymentOpen(false);
      setReceiptOpen(true);
      toast({ title: "Sale completed", description: `Order ${order.orderNumber}` });
    } catch {
      toast({ title: "Error", description: "Failed to complete sale", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleHold = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      await holdSale({
        items: cart.map((c) => ({
          productId: c.productId,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
        })),
        discount,
        tax,
      });
      clearCart();
      await refreshHeld();
      toast({ title: "Sale held", description: "You can resume it later" });
    } catch {
      toast({ title: "Error", description: "Failed to hold sale", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResume = (order: (typeof heldSales)[0]) => {
    loadCart(
      order.items.map((i) => ({
        productId: i.productId,
        name: i.product.name,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        stock: i.product.stock + i.quantity,
      })),
      order.discount
    );
    cancelOrder(order.id);
    setHeldOpen(false);
    refreshHeld();
  };

  return (
    <div>
      <PageHeader title="Point of Sale" description="Process sales quickly and efficiently">
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { refreshHeld(); setHeldOpen(true); }}>
            <Play className="h-4 w-4 mr-1" /> Resume ({heldSales.length})
          </Button>
          <Button variant="outline" size="sm" onClick={handleHold} disabled={cart.length === 0 || loading}>
            <Pause className="h-4 w-4 mr-1" /> Hold
          </Button>
          <Button variant="outline" size="sm" onClick={clearCart} disabled={cart.length === 0}>
            <X className="h-4 w-4 mr-1" /> Cancel
          </Button>
        </div>
      </PageHeader>

      <div className="grid lg:grid-cols-3 gap-4 h-[calc(100vh-180px)]">
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <Button
              size="sm"
              variant={selectedCategory === "all" ? "default" : "outline"}
              onClick={() => setSelectedCategory("all")}
            >
              All
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                size="sm"
                variant={selectedCategory === cat.id ? "default" : "outline"}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto flex-1 pb-2">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() =>
                  addItem({
                    productId: product.id,
                    name: product.name,
                    unitPrice: product.sellingPrice,
                    stock: product.stock,
                  })
                }
                className="flex flex-col items-start p-4 rounded-xl border bg-card hover:border-gold/50 hover:shadow-md transition-all text-left"
              >
                <p className="font-medium text-sm line-clamp-2">{product.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{product.category.name}</p>
                <div className="flex items-center justify-between w-full mt-2">
                  <span className="font-bold text-gold">{formatCurrency(product.sellingPrice)}</span>
                  <Badge variant="secondary" className="text-xs">{product.stock}</Badge>
                </div>
              </button>
            ))}
          </div>
        </div>

        <Card className="flex flex-col min-h-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-serif flex items-center justify-between">
              Cart
              <Badge>{cart.length} items</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 min-h-0 gap-3">
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
              {cart.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Cart is empty</p>
              ) : (
                cart.map((item) => (
                  <div key={item.productId} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(item.unitPrice)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQuantity(item.productId, item.quantity - 1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQuantity(item.productId, item.quantity + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.productId)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="text-sm font-medium w-16 text-right">{formatCurrency(item.unitPrice * item.quantity)}</span>
                  </div>
                ))
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-20">Discount</span>
                <Input
                  type="number"
                  min={0}
                  value={discount || ""}
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                  className="h-8"
                  placeholder="0"
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-gold">{formatCurrency(total)}</span>
              </div>
            </div>

            <Button
              variant="gold"
              className="w-full"
              size="lg"
              disabled={cart.length === 0}
              onClick={() => setPaymentOpen(true)}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Pay {formatCurrency(total)}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Payment — {formatCurrency(total)}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {[
              { method: "CASH" as PaymentMethod, icon: Banknote, label: "Cash" },
              { method: "MPESA" as PaymentMethod, icon: Smartphone, label: "M-Pesa" },
              { method: "CARD" as PaymentMethod, icon: CreditCard, label: "Card" },
              { method: "BANK" as PaymentMethod, icon: Building2, label: "Bank" },
              { method: "SPLIT" as PaymentMethod, icon: Split, label: "Split" },
            ].map(({ method, icon: Icon, label }) => (
              <Button
                key={method}
                variant={paymentMethod === method ? "default" : "outline"}
                className="h-16 flex-col gap-1"
                onClick={() => setPaymentMethod(method)}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Button>
            ))}
          </div>

          {paymentMethod === "SPLIT" && (
            <div className="space-y-2 mt-2">
              {(["CASH", "MPESA", "CARD", "BANK"] as PaymentMethod[]).map((m) => (
                <div key={m} className="flex items-center gap-2">
                  <span className="text-sm w-16">{m}</span>
                  <Input
                    type="number"
                    placeholder="0"
                    onChange={(e) => {
                      const amount = Number(e.target.value) || 0;
                      setSplitPayments((prev) => {
                        const filtered = prev.filter((p) => p.method !== m);
                        return amount > 0 ? [...filtered, { method: m, amount }] : filtered;
                      });
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          <Button variant="gold" className="w-full mt-4" onClick={handleCompleteSale} disabled={loading}>
            Complete Sale
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={heldOpen} onOpenChange={setHeldOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Held Sales</DialogTitle>
          </DialogHeader>
          {heldSales.length === 0 ? (
            <p className="text-muted-foreground text-sm">No held sales</p>
          ) : (
            <div className="space-y-2">
              {heldSales.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">{order.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">{order.items.length} items • {formatCurrency(order.total)}</p>
                  </div>
                  <Button size="sm" onClick={() => handleResume(order)}>Resume</Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Receipt</DialogTitle>
          </DialogHeader>
          {completedOrder && settings && (
            <>
              <Receipt order={completedOrder} settings={settings} />
              <Button variant="gold" className="w-full" onClick={printReceipt}>
                <Printer className="h-4 w-4 mr-2" /> Print Receipt
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
