"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { stockIn, stockOut, adjustStock, recordWastage } from "@/lib/actions/inventory";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { PackagePlus, PackageMinus, Settings2, Trash2 } from "lucide-react";

interface InventoryClientProps {
  products: Array<{ id: string; name: string; sku: string; stock: number; lowStockAlert: number; category: { name: string } }>;
  movements: Array<{
    id: string;
    type: string;
    quantity: number;
    reason: string | null;
    reference: string | null;
    createdAt: Date;
    product: { name: string };
    user: { name: string } | null;
  }>;
  lowStock: Array<{ id: string; name: string; stock: number; lowStockAlert: number }>;
}

export function InventoryClient({ products, movements, lowStock }: InventoryClientProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"in" | "out" | "adjust" | "wastage">("in");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const openDialog = (type: typeof actionType) => {
    setActionType(type);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const productId = form.get("productId") as string;
    const reason = (form.get("reason") as string) || undefined;

    try {
      switch (actionType) {
        case "in":
          await stockIn({ productId, quantity: Number(form.get("quantity")), reason });
          break;
        case "out":
          await stockOut({ productId, quantity: Number(form.get("quantity")), reason });
          break;
        case "adjust":
          await adjustStock({ productId, newStock: Number(form.get("newStock")), reason });
          break;
        case "wastage":
          await recordWastage({ productId, quantity: Number(form.get("quantity")), reason });
          break;
      }
      toast({ title: "Inventory updated" });
      setDialogOpen(false);
      router.refresh();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const actionLabels = { in: "Stock In", out: "Stock Out", adjust: "Adjustment", wastage: "Wastage" };

  return (
    <div>
      <PageHeader title="Inventory" description="Manage stock levels and track movements">
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => openDialog("in")}><PackagePlus className="h-4 w-4 mr-1" /> Stock In</Button>
          <Button variant="outline" size="sm" onClick={() => openDialog("out")}><PackageMinus className="h-4 w-4 mr-1" /> Stock Out</Button>
          <Button variant="outline" size="sm" onClick={() => openDialog("adjust")}><Settings2 className="h-4 w-4 mr-1" /> Adjust</Button>
          <Button variant="outline" size="sm" onClick={() => openDialog("wastage")}><Trash2 className="h-4 w-4 mr-1" /> Wastage</Button>
        </div>
      </PageHeader>

      {lowStock.length > 0 && (
        <Card className="mb-6 border-red-500/30">
          <CardContent className="p-4">
            <p className="font-medium text-red-400 mb-2">Low Stock Alert ({lowStock.length})</p>
            <div className="flex flex-wrap gap-2">
              {lowStock.map((p) => (
                <Badge key={p.id} variant="destructive">{p.name}: {p.stock} left</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Current Stock</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-4">
          <div className="grid gap-2">
            {products.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-muted-foreground">{p.category.name} • {p.sku}</p>
                  </div>
                  <Badge variant={p.stock <= p.lowStockAlert ? "destructive" : "success"}>{p.stock} units</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="space-y-2">
            {movements.map((m) => (
              <Card key={m.id}>
                <CardContent className="p-4 flex justify-between">
                  <div>
                    <p className="font-medium text-sm">{m.product.name}</p>
                    <p className="text-xs text-muted-foreground">{m.type} • {m.reason || "—"} • {m.user?.name}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={m.quantity > 0 ? "success" : "destructive"}>{m.quantity > 0 ? "+" : ""}{m.quantity}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(m.createdAt)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">{actionLabels[actionType]}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select name="productId" required>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.stock})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {actionType === "adjust" ? (
              <div className="space-y-2">
                <Label>New Stock Level</Label>
                <Input name="newStock" type="number" required min={0} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input name="quantity" type="number" required min={1} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input name="reason" />
            </div>
            <Button type="submit" variant="gold" className="w-full" disabled={loading}>Submit</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
