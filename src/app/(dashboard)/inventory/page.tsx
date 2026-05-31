import { InventoryClient } from "@/components/inventory/inventory-client";
import { getAllProducts, getInventoryMovements, getLowStockProducts } from "@/lib/actions/inventory";

export default async function InventoryPage() {
  const [products, movements, lowStock] = await Promise.all([
    getAllProducts(),
    getInventoryMovements(),
    getLowStockProducts(),
  ]);

  return <InventoryClient products={products} movements={movements} lowStock={lowStock} />;
}
