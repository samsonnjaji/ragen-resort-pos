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
import { createProduct, updateProduct, createCategory } from "@/lib/actions/products";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil } from "lucide-react";
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
    categoryId: string;
    category: { id: string; name: string };
  }>;
  categories: Array<{ id: string; name: string; description: string | null }>;
}

export function ProductsClient({ products, categories }: ProductsClientProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductsClientProps["products"][0] | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(false);
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
    } catch {
      toast({ title: "Error", description: "Failed to save product", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      await createCategory({
        name: form.get("name") as string,
        description: (form.get("description") as string) || undefined,
        type: (form.get("type") as string) || "GENERAL",
      });
      toast({ title: "Category created" });
      setCatDialogOpen(false);
      router.refresh();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Products" description="Manage products and categories">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCatDialogOpen(true)}>Add Category</Button>
          <Button variant="gold" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Product
          </Button>
        </div>
      </PageHeader>

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
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{product.name}</span>
                      <Badge variant="outline">{product.category.name}</Badge>
                      {product.status === "INACTIVE" && <Badge variant="destructive">Inactive</Badge>}
                      {product.stock <= product.lowStockAlert && <Badge variant="destructive">Low Stock</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">SKU: {product.sku} • Stock: {product.stock}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-gold">{formatCurrency(product.sellingPrice)}</p>
                      <p className="text-xs text-muted-foreground">Cost: {formatCurrency(product.costPrice)}</p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(product); setDialogOpen(true); }}>
                      <Pencil className="h-4 w-4" />
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
                  <p className="font-medium">{cat.name}</p>
                  {cat.description && <p className="text-sm text-muted-foreground">{cat.description}</p>}
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
              <div className="space-y-2 col-span-2">
                <Label>Name</Label>
                <Input name="name" defaultValue={editing?.name} required />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input name="sku" defaultValue={editing?.sku} required />
              </div>
              <div className="space-y-2">
                <Label>Barcode</Label>
                <Input name="barcode" defaultValue={editing?.barcode || ""} />
              </div>
              <div className="space-y-2">
                <Label>Selling Price</Label>
                <Input name="sellingPrice" type="number" defaultValue={editing?.sellingPrice} required />
              </div>
              <div className="space-y-2">
                <Label>Cost Price</Label>
                <Input name="costPrice" type="number" defaultValue={editing?.costPrice || 0} />
              </div>
              <div className="space-y-2">
                <Label>Stock</Label>
                <Input name="stock" type="number" defaultValue={editing?.stock || 0} />
              </div>
              <div className="space-y-2">
                <Label>Low Stock Alert</Label>
                <Input name="lowStockAlert" type="number" defaultValue={editing?.lowStockAlert || 5} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Category</Label>
                <Select value={categoryId || editing?.categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
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
            <DialogTitle className="font-serif">Add Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCategorySubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input name="name" required placeholder="e.g. Beer" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input name="description" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select name="type" defaultValue="GENERAL">
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
            <Button type="submit" variant="gold" className="w-full" disabled={loading}>Create Category</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
