import { PageHeader } from "@/components/layout/stat-card";
import { getOrders } from "@/lib/actions/products";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const statusVariant: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  COMPLETED: "success",
  PENDING: "warning",
  PREPARING: "warning",
  READY: "default",
  SERVED: "success",
  CANCELLED: "destructive",
  ON_HOLD: "secondary",
};

export default async function OrdersPage() {
  const orders = await getOrders();

  return (
    <div>
      <PageHeader title="Orders" description="View and manage all orders" />

      <div className="space-y-3">
        {orders.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No orders yet</CardContent></Card>
        ) : (
          orders.map((order) => (
            <Card key={order.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{order.orderNumber}</span>
                      <Badge variant={statusVariant[order.status] || "default"}>{order.status}</Badge>
                      <Badge variant="outline">{order.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {order.items.length} items • {order.user.name} • {formatDate(order.createdAt)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {order.items.map((i) => `${i.quantity}x ${i.product.name}`).join(", ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gold">{formatCurrency(order.total)}</p>
                    {order.payments.map((p) => (
                      <p key={p.id} className="text-xs text-muted-foreground">{p.method}: {formatCurrency(p.amount)}</p>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
