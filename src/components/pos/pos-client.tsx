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
import { Receipt } from "@/components/pos/receipt";
import { ReceiptPrintButton } from "@/components/pos/receipt-print-button";
import { PaymentDialog, type PaymentLineDraft } from "@/components/pos/payment-dialog";
import { useToast } from "@/hooks/use-toast";
import { useRequireConnection } from "@/hooks/use-require-connection";
import { getErrorMessage } from "@/lib/app-error";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Pause,
  Play,
  X,
  CreditCard,
} from "lucide-react";

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
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { isConnected, blockIfOffline, disabled: offlineDisabled } = useRequireConnection();

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

  const handleCompleteSale = async (payments: PaymentLineDraft[]) => {
    if (cart.length === 0 || blockIfOffline("Completing a sale")) return;
    setLoading(true);

    try {
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
    } catch (err) {
      toast({
        title: "Error",
        description: getErrorMessage(err, "Failed to complete sale"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleHold = async () => {
    if (cart.length === 0 || blockIfOffline("Holding a sale")) return;
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
      <PageHeader title="Point of Sale" description="Touch-friendly sales terminal">
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="h-11 px-4 touch-target" onClick={() => { refreshHeld(); setHeldOpen(true); }} disabled={offlineDisabled}>
            <Play className="h-5 w-5 mr-1" /> Resume ({heldSales.length})
          </Button>
          <Button variant="outline" className="h-11 px-4 touch-target" onClick={handleHold} disabled={cart.length === 0 || loading || offlineDisabled}>
            <Pause className="h-5 w-5 mr-1" /> Hold
          </Button>
          <Button variant="outline" className="h-11 px-4 touch-target" onClick={clearCart} disabled={cart.length === 0}>
            <X className="h-5 w-5 mr-1" /> Cancel
          </Button>
        </div>
      </PageHeader>

      {!isConnected && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          Sales are disabled — waiting for server connection.
        </div>
      )}

      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:min-h-[calc(100dvh-10rem)]">
        <div className="lg:col-span-2 flex flex-col gap-3 min-h-0 order-1">
          <div className="relative shrink-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 h-12 text-base"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide shrink-0">
            <Button
              size="lg"
              className="h-11 shrink-0 touch-target"
              variant={selectedCategory === "all" ? "default" : "outline"}
              onClick={() => setSelectedCategory("all")}
            >
              All
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                size="lg"
                className="h-11 shrink-0 touch-target"
                variant={selectedCategory === cat.id ? "default" : "outline"}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </Button>
            ))}
          </div>

          <div className="pos-product-scroll relative flex-1 min-h-[320px] max-h-[calc(100dvh-20rem)] lg:max-h-none lg:min-h-[400px]">
            <div className="absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-contain">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 p-1 items-start content-start">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() =>
                      addItem({
                        productId: product.id,
                        name: product.name,
                        unitPrice: product.sellingPrice,
                        stock: product.stock,
                      })
                    }
                    className="w-full flex flex-col gap-1.5 p-3 sm:p-4 rounded-xl border bg-card hover:border-gold/50 hover:shadow-md active:scale-[0.98] transition-transform text-left min-h-[112px]"
                  >
                    <p className="font-semibold text-sm sm:text-base leading-snug line-clamp-2">{product.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{product.category.name}</p>
                    <div className="flex items-center justify-between gap-2 mt-auto pt-2 w-full">
                      <span className="font-bold text-base sm:text-lg text-gold">{formatCurrency(product.sellingPrice)}</span>
                      <Badge variant="secondary" className="shrink-0 text-xs">{product.stock}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Card className="flex flex-col min-h-0 order-2 lg:order-none lg:max-h-[calc(100dvh-10rem)]">
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
                  <div key={item.productId} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-medium truncate">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{formatCurrency(item.unitPrice)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-11 w-11 touch-target" onClick={() => updateQuantity(item.productId, item.quantity - 1)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center text-lg font-bold">{item.quantity}</span>
                      <Button size="icon" variant="outline" className="h-11 w-11 touch-target" onClick={() => updateQuantity(item.productId, item.quantity + 1)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-11 w-11 text-destructive touch-target" onClick={() => removeItem(item.productId)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <span className="text-base font-semibold w-20 text-right">{formatCurrency(item.unitPrice * item.quantity)}</span>
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
                  className="h-11 text-base"
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
              className="w-full h-14 text-lg touch-target"
              size="lg"
              disabled={cart.length === 0 || offlineDisabled}
              onClick={() => {
                if (blockIfOffline("Payment")) return;
                setPaymentOpen(true);
              }}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Pay {formatCurrency(total)}
            </Button>
          </CardContent>
        </Card>
      </div>

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        orderTotal={total}
        loading={loading}
        disabled={offlineDisabled}
        onComplete={handleCompleteSale}
      />

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
        <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto print:max-w-none">
          <DialogHeader className="print:hidden">
            <DialogTitle className="font-serif text-xl">Receipt</DialogTitle>
          </DialogHeader>
          {completedOrder && settings && (
            <>
              <Receipt order={completedOrder} settings={settings} />
              <ReceiptPrintButton
                targetId="receipt"
                receiptSize={settings.receiptSize}
                receiptAlignment={settings.receiptAlignment}
                receiptCompact={settings.receiptCompact}
                className="w-full h-14 text-base touch-target print:hidden"
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
