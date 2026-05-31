import { KitchenClient } from "@/components/kitchen/kitchen-client";
import { getOrders, getProductsByCategoryType } from "@/lib/actions/products";
import { OrderType } from "@prisma/client";

export default async function BarPage() {
  const [orders, products] = await Promise.all([
    getOrders({ type: OrderType.BAR }),
    getProductsByCategoryType(["ALCOHOL", "BAR"]),
  ]);
  return <KitchenClient orders={orders} products={products} title="Bar Orders" type="bar" />;
}
