import { PurchasesClient } from "@/components/purchases/purchases-client";
import { getPurchases, getSuppliers } from "@/lib/actions/admin";
import { getAllProducts } from "@/lib/actions/inventory";

export default async function PurchasesPage() {
  const [purchases, suppliers, products] = await Promise.all([
    getPurchases(),
    getSuppliers(),
    getAllProducts(),
  ]);
  return <PurchasesClient purchases={purchases} suppliers={suppliers} products={products} />;
}
