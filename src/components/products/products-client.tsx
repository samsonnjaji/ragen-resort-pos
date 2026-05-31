"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/actions/products";
import { formatCurrency } from "@/lib/utils";
import { getErrorMessage } from "@/lib/app-error";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Archive } from "lucide-react";
import { useRouter } from "next/navigation";

interface ProductsClientProps {
  products: Array<{
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    sellingPrice: number;
    costPrice: number;
    stock: number;
    lowStockAlert: number;
    status: string;
    isActive: boolean;
    categoryId: string;
    category: { id: string; name: string };
    _count: { orderItems: number };
  }>;
  categories: Array<{
    id: string;
    name: string;
    description: string | null;
    type: string;
    active: boolean;
    _count: { products: number };
  }>;
  loadError?: string;
}

export function ProductsClient({ products, categories, loadError }: ProductsClientProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductsClientProps["products"][0] | null>(null);
  const [editingCat, setEditingCat] = useState<ProductsClientProps["categories"][0] | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<{ type: "category"; id: string; name: string } | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; name: string } | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get("name") as string,
      sku: form.get("sku") as string,
      barcode: (form.get("barcode") as string) || undefined,
      sellingPrice: Number(form.get("sellingPrice")),
      costPrice: Number(form.get("costPrice")),
      stock: Number(form.get("stock")),
      lowStockAlert: Number(form.get("lowStockAlert")),
      categoryId: form.get("categoryId") as string,
    };
    try {
      if (editing) {
        await updateProduct(editing.id, data);
        toast({ title: "Product updated" });
      } else {
        await createProduct(data);
        toast({ title: "Product created" });
      }
      setDialogOpen(false);
      setEditing(null);
      router.refresh();
    } catch (err) {
      toast({ title: "Error", description: getErrorMessage(err, "Failed to save product"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get("name") as string,
      description: (form.get("description") as string) || undefined,
      type: (form.get("type") as string) || "GENERAL",
    };
    try {
      if (editingCat) {
        await updateCategory(editingCat.id, data);
        toast({ title: "Category updated" });
      } else {
        await createCategory(data);
        toast({ title: "Category created" });
      }
      setCatDialogOpen(false);
      setEditingCat(null);
      router.refresh();
    } catch (err) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    setLoading(true);
    try {
      await deleteProduct(archiveTarget.id, archiveReason);
      toast({
        title: "Product archived",
        description: "Hidden from POS and active products. Restore from Archive if needed.",
      });
      setArchiveTarget(null);
      setArchiveReason("");
      router.refresh();
    } catch (err) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirm) return;
    setLoading(true);
    try {
      await deleteCategory(confirm.id);
      toast({ title: "Category deleted" });
      setConfirm(null);
      router.refresh();
    } catch (err) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Products" description="Manage products and categories">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setEditingCat(null); setCatDialogOpen(true); }}>Add Category</Button>
          <Button variant="gold" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Product
          </Button>
        </div>
      </PageHeader>

      {loadError && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{loadError}</div>
      )}

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products ({products.length})</TabsTrigger>
          <TabsTrigger value="categories">Categories ({categories.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <div className="grid gap-3">
            {products.map((product) => (
              <Card key={product.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{product.name}</span>
                      <Badge variant="outline">{product.category?.name ?? "Uncategorized"}</Badge>
                      {!product.isActive && <Badge variant="destructive">Inactive</Badge>}
                      {product._count.orderItems > 0 && (
                        <Badge variant="secondary">{product._count.orderItems} sales</Badge>
                      )}
                      {product.stock <= product.lowStockAlert && <Badge variant="destructive">Low Stock</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">SKU: {product.sku} • Stock: {product.stock}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right mr-2">
                      <p className="font-bold text-gold">{formatCurrency(product.sellingPrice)}</p>
                      <p className="text-xs text-muted-foreground">Cost: {formatCurrency(product.costPrice)}</p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(product); setDialogOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-amber-500"
                      title="Hides this product from selling but keeps history safe."
                      onClick={() => {
                        setArchiveReason("");
                        setArchiveTarget({ id: product.id, name: product.name });
                      }}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <Card key={cat.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{cat.name}</p>
                      {cat.description && <p className="text-sm text-muted-foreground">{cat.description}</p>}
                      <p className="text-xs text-muted-foreground mt-1">{cat._count.products} product(s)</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditingCat(cat); setCatDialogOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setConfirm({ type: "category", id: cat.id, name: cat.name })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
            <DialogTitle className="font-serif">{editing ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2"><Label>Name</Label><Input name="name" defaultValue={editing?.name} required /></div>
              <div className="space-y-2"><Label>SKU</Label><Input name="sku" defaultValue={editing?.sku} required /></div>
              <div className="space-y-2"><Label>Barcode</Label><Input name="barcode" defaultValue={editing?.barcode || ""} /></div>
              <div className="space-y-2"><Label>Selling Price</Label><Input name="sellingPrice" type="number" defaultValue={editing?.sellingPrice} required /></div>
              <div className="space-y-2"><Label>Cost Price</Label><Input name="costPrice" type="number" defaultValue={editing?.costPrice || 0} /></div>
              <div className="space-y-2"><Label>Stock</Label><Input name="stock" type="number" defaultValue={editing?.stock || 0} /></div>
              <div className="space-y-2"><Label>Low Stock Alert</Label><Input name="lowStockAlert" type="number" defaultValue={editing?.lowStockAlert || 5} /></div>
              <div className="space-y-2 col-span-2">
                <Label>Category</Label>
                <Select value={categoryId || editing?.categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.filter((c) => c.active).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="categoryId" value={categoryId || editing?.categoryId || ""} />
              </div>
            </div>
            <Button type="submit" variant="gold" className="w-full" disabled={loading}>
              {editing ? "Update" : "Create"} Product
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">{editingCat ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCategorySubmit} className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input name="name" defaultValue={editingCat?.name} required /></div>
            <div className="space-y-2"><Label>Description</Label><Input name="description" defaultValue={editingCat?.description || ""} /></div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select name="type" defaultValue={editingCat?.type || "GENERAL"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALCOHOL">Alcohol</SelectItem>
                  <SelectItem value="BAR">Bar</SelectItem>
                  <SelectItem value="FOOD">Food</SelectItem>
                  <SelectItem value="ROOM_SERVICE">Room Service</SelectItem>
                  <SelectItem value="GENERAL">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" variant="gold" className="w-full" disabled={loading}>
              {editingCat ? "Update" : "Create"} Category
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Archive product?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Archive &quot;{archiveTarget?.name}&quot;? It will be hidden from POS and the active products list. Sales history stays safe. You can restore it from Archive.
          </p>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Input
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              placeholder="e.g. Discontinued, seasonal item"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setArchiveTarget(null)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleArchive} disabled={loading}>
              {loading ? "Archiving..." : "Archive"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Are you sure?"
        description={`Delete category "${confirm?.name}"? This cannot be undone if no products are assigned.`}
        confirmLabel="Delete"
        loading={loading}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
