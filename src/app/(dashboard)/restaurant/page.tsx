import { KitchenClient } from "@/components/kitchen/kitchen-client";
import { getOrders, getProductsByCategoryType } from "@/lib/actions/products";
import { OrderType } from "@prisma/client";

export default async function RestaurantPage() {
  const [orders, products] = await Promise.all([
    getOrders({ type: OrderType.RESTAURANT }),
    getProductsByCategoryType(["FOOD", "ROOM_SERVICE"]),
  ]);
  return <KitchenClient orders={orders} products={products} title="Restaurant Orders" type="restaurant" />;
}
