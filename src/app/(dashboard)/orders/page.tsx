import { OrdersClient } from "@/components/orders/orders-client";
import { getOrders } from "@/lib/actions/products";

export default async function OrdersPage() {
  try {
    const orders = await getOrders();
    return <OrdersClient orders={orders} />;
  } catch (error) {
    console.error("[OrdersPage]", error);
    return <OrdersClient orders={[]} loadError="Unable to load orders. Check your connection and refresh." />;
  }
}
