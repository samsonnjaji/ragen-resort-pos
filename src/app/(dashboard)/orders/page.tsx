import { OrdersClient } from "@/components/orders/orders-client";
import { getOrders } from "@/lib/actions/products";
import { getSettings } from "@/lib/actions/dashboard";

export default async function OrdersPage() {
  try {
    const [orders, settings] = await Promise.all([getOrders(), getSettings()]);
    return (
      <OrdersClient
        orders={orders}
        settings={{
          businessName: settings.businessName,
          businessAddress: settings.businessAddress,
          phone: settings.phone,
          email: settings.email,
          receiptFooter: settings.receiptFooter,
          currency: settings.currency,
          receiptSize: settings.receiptSize,
          receiptAlignment: settings.receiptAlignment,
          receiptCompact: settings.receiptCompact,
        }}
      />
    );
  } catch (error) {
    console.error("[OrdersPage]", error);
    return (
      <OrdersClient
        orders={[]}
        settings={{
          businessName: "RAGEN RESORT",
          businessAddress: "",
          phone: "",
          email: "",
          receiptFooter: "",
          currency: "KES",
          receiptSize: "80mm",
          receiptAlignment: "LEFT",
          receiptCompact: false,
        }}
        loadError="Unable to load orders. Check your connection and refresh."
      />
    );
  }
}
