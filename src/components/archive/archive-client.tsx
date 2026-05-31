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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  restoreProduct,
  permanentDeleteProduct,
  restoreSupplier,
  restoreCategory,
  restoreArchivedUser,
} from "@/lib/actions/archive";
import { formatCurrency, formatDate, ROLE_LABELS } from "@/lib/utils";
import { getErrorMessage } from "@/lib/app-error";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";

interface ArchivedProduct {
  id: string;
  name: string;
  sku: string;
  stock: number;
  sellingPrice: number;
  archiveReason: string | null;
  categoryName: string;
  archivedAt: string | null;
  archivedByName: string;
  archivedByEmail: string | null;
  hasHistory: boolean;
  historyCount: number;
}

interface ArchiveClientProps {
  products: ArchivedProduct[];
  suppliers: Array<{ id: string; name: string; phone: string | null; email: string | null; updatedAt: string }>;
  categories: Array<{ id: string; name: string; description: string | null; type: string; updatedAt: string }>;
  users: Array<{ id: string; name: string; email: string; role: string; updatedAt: string }>;
}

export function ArchiveClient({ products, suppliers, categories, users }: ArchiveClientProps) {
  const [loading, setLoading] = useState(false);
  const [restoreId, setRestoreId] = useState<{ type: "product" | "supplier" | "category" | "user"; id: string; name: string } | null>(null);
  const [permanentProduct, setPermanentProduct] = useState<ArchivedProduct | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [password, setPassword] = useState("");
  const [irreversible, setIrreversible] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const canPermanentDelete =
    permanentProduct &&
    irreversible &&
    confirmName.trim() === permanentProduct.name.trim() &&
    password.length > 0 &&
    !permanentProduct.hasHistory;

  const handleRestore = async () => {
    if (!restoreId) return;
    setLoading(true);
    try {
      switch (restoreId.type) {
        case "product":
          await restoreProduct(restoreId.id);
          break;
        case "supplier":
          await restoreSupplier(restoreId.id);
          break;
        case "category":
          await restoreCategory(restoreId.id);
          break;
        case "user":
          await restoreArchivedUser(restoreId.id);
          break;
      }
      toast({ title: `${restoreId.name} restored` });
      setRestoreId(null);
      router.refresh();
    } catch (err) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentProduct || !canPermanentDelete) return;
    setLoading(true);
    try {
      await permanentDeleteProduct({
        id: permanentProduct.id,
        confirmName,
        password,
        irreversibleConfirmed: irreversible,
      });
      toast({ title: "Product permanently deleted" });
      setPermanentProduct(null);
      setConfirmName("");
      setPassword("");
      setIrreversible(false);
      router.refresh();
    } catch (err) {
      toast({ title: "Cannot delete", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Archive" description="Restore or permanently remove archived records (admin only)" />

      <Tabs defaultValue="products">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="products">Products ({products.length})</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers ({suppliers.length})</TabsTrigger>
          <TabsTrigger value="categories">Categories ({categories.length})</TabsTrigger>
          <TabsTrigger value="users">Deactivated Users ({users.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4 space-y-3">
          {products.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No archived products</CardContent></Card>
          ) : (
            products.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{p.name}</span>
                      <Badge variant="outline">{p.categoryName}</Badge>
                      <Badge variant="secondary">SKU: {p.sku}</Badge>
                      {p.hasHistory && <Badge variant="warning">{p.historyCount} history records</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Stock: {p.stock} • Price: {formatCurrency(p.sellingPrice)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Archived {p.archivedAt ? formatDate(new Date(p.archivedAt)) : "—"} by {p.archivedByName}
                      {p.archivedByEmail ? ` (${p.archivedByEmail})` : ""}
                    </p>
                    {p.archiveReason && (
                      <p className="text-xs text-muted-foreground mt-1">Reason: {p.archiveReason}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => setRestoreId({ type: "product", id: p.id, name: p.name })}>
                      <RotateCcw className="h-4 w-4 mr-1" /> Restore
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setPermanentProduct(p);
                        setConfirmName("");
                        setPassword("");
                        setIrreversible(false);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Permanently Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4 space-y-3">
          {suppliers.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No archived suppliers</CardContent></Card>
          ) : (
            suppliers.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.phone || s.email || "—"}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setRestoreId({ type: "supplier", id: s.id, name: s.name })}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Restore
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="categories" className="mt-4 space-y-3">
          {categories.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No archived categories</CardContent></Card>
          ) : (
            categories.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-sm text-muted-foreground">{c.type}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setRestoreId({ type: "category", id: c.id, name: c.name })}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Restore
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="users" className="mt-4 space-y-3">
          {users.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No deactivated users</CardContent></Card>
          ) : (
            users.map((u) => (
              <Card key={u.id}>
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{u.name}</span>
                      <Badge variant="outline">{ROLE_LABELS[u.role]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setRestoreId({ type: "user", id: u.id, name: u.name })}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Activate
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!restoreId}
        onOpenChange={(open) => !open && setRestoreId(null)}
        title="Restore record?"
        description={`Restore "${restoreId?.name}"?`}
        confirmLabel="Restore"
        variant="default"
        loading={loading}
        onConfirm={handleRestore}
      />

      <Dialog open={!!permanentProduct} onOpenChange={(open) => !open && setPermanentProduct(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-destructive">Permanent Delete — Danger Zone</DialogTitle>
            <DialogDescription>
              This cannot be undone. Only products with no sales, inventory, purchase, or room charge history can be removed.
            </DialogDescription>
          </DialogHeader>

          {permanentProduct?.hasHistory ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
              This product has historical records and cannot be permanently deleted. It can remain archived.
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm">
                Type the exact product name: <strong>{permanentProduct?.name}</strong>
              </p>
              <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder="Product name" />
              <div className="space-y-2">
                <Label>Your admin password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </div>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={irreversible} onChange={(e) => setIrreversible(e.target.checked)} className="mt-1" />
                I understand this action is irreversible and cannot be undone.
              </label>
              <Button variant="destructive" className="w-full" disabled={!canPermanentDelete || loading} onClick={handlePermanentDelete}>
                {loading ? "Deleting..." : "Permanently Delete Product"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
