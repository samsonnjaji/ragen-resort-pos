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
import { createPurchase, createSupplier, receivePurchase } from "@/lib/actions/admin";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Plus, PackageCheck } from "lucide-react";

interface PurchasesClientProps {
  purchases: Array<{
    id: string;
    purchaseNumber: string;
    status: string;
    totalAmount: number;
    createdAt: Date;
    supplier: { name: string };
    items: Array<{ quantity: number; product: { name: string }; unitCost: number; total: number }>;
  }>;
  suppliers: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string; costPrice: number }>;
}

export function PurchasesClient({ purchases, suppliers, products }: PurchasesClientProps) {
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<{ productId: string; quantity: number; unitCost: number }[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  const handleSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      await createSupplier({
        name: form.get("name") as string,
        phone: (form.get("phone") as string) || undefined,
        email: (form.get("email") as string) || undefined,
      });
      toast({ title: "Supplier created" });
      setSupplierOpen(false);
      router.refresh();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (items.length === 0) {
      toast({ title: "Add at least one item", variant: "destructive" });
      return;
    }
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      await createPurchase({
        supplierId: form.get("supplierId") as string,
        items,
        notes: (form.get("notes") as string) || undefined,
      });
      toast({ title: "Purchase order created" });
      setPurchaseOpen(false);
      setItems([]);
      router.refresh();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    if (products.length > 0) {
      setItems([...items, { productId: products[0].id, quantity: 1, unitCost: products[0].costPrice }]);
    }
  };

  return (
    <div>
      <PageHeader title="Purchases" description="Manage suppliers and purchase orders">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSupplierOpen(true)}>Add Supplier</Button>
          <Button variant="gold" onClick={() => { setItems([]); setPurchaseOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> New Purchase
          </Button>
        </div>
      </PageHeader>

      <div className="space-y-3">
        {purchases.map((purchase) => (
          <Card key={purchase.id}>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{purchase.purchaseNumber}</span>
                    <Badge variant={purchase.status === "RECEIVED" ? "success" : "warning"}>{purchase.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{purchase.supplier.name} • {formatDate(purchase.createdAt)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {purchase.items.map((i) => `${i.quantity}x ${i.product.name}`).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gold">{formatCurrency(purchase.totalAmount)}</span>
                  {purchase.status === "PENDING" && (
                    <Button size="sm" variant="gold" onClick={async () => {
                      await receivePurchase(purchase.id);
                      router.refresh();
                      toast({ title: "Goods received, stock updated" });
                    }}>
                      <PackageCheck className="h-4 w-4 mr-1" /> Receive
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">Add Supplier</DialogTitle></DialogHeader>
          <form onSubmit={handleSupplier} className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input name="name" required /></div>
            <div className="space-y-2"><Label>Phone</Label><Input name="phone" /></div>
            <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" /></div>
            <Button type="submit" variant="gold" className="w-full" disabled={loading}>Create Supplier</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={purchaseOpen} onOpenChange={setPurchaseOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-serif">New Purchase Order</DialogTitle></DialogHeader>
          <form onSubmit={handlePurchase} className="space-y-4">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Select name="supplierId" required>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Items</Label>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>Add Item</Button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2">
                  <Select value={item.productId} onValueChange={(v) => {
                    const p = products.find((pr) => pr.id === v);
                    const newItems = [...items];
                    newItems[idx] = { ...newItems[idx], productId: v, unitCost: p?.costPrice || 0 };
                    setItems(newItems);
                  }}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" className="w-20" value={item.quantity} onChange={(e) => {
                    const newItems = [...items];
                    newItems[idx].quantity = Number(e.target.value);
                    setItems(newItems);
                  }} />
                  <Input type="number" className="w-24" value={item.unitCost} onChange={(e) => {
                    const newItems = [...items];
                    newItems[idx].unitCost = Number(e.target.value);
                    setItems(newItems);
                  }} />
                </div>
              ))}
            </div>
            <div className="space-y-2"><Label>Notes</Label><Input name="notes" /></div>
            <Button type="submit" variant="gold" className="w-full" disabled={loading}>Create Purchase Order</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
