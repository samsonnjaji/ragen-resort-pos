"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cancelOrder, deleteOrder } from "@/lib/actions/products";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getErrorMessage } from "@/lib/app-error";
import { PaymentBreakdown } from "@/components/payments/payment-breakdown";
import { isSplitOrder } from "@/lib/payments";
import { PaymentMethod } from "@prisma/client";
import { useToast } from "@/hooks/use-toast";
import { useRequireConnection } from "@/hooks/use-require-connection";
import { useRouter } from "next/navigation";
import { X, Trash2 } from "lucide-react";
import { OrderStatus } from "@prisma/client";

interface OrdersClientProps {
  orders: Array<{
    id: string;
    orderNumber: string;
    status: OrderStatus;
    type: string;
    total: number;
    createdAt: Date;
    user: { name: string };
    items: Array<{ quantity: number; product?: { name: string } | null }>;
    changeGiven?: number;
    payments: Array<{
      id: string;
      method: string;
      amount: number;
      reference?: string | null;
    }>;
  }>;
  loadError?: string;
}

const statusVariant: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  COMPLETED: "success", PENDING: "warning", PREPARING: "warning", READY: "default",
  SERVED: "success", CANCELLED: "destructive", ON_HOLD: "secondary",
};

export function OrdersClient({ orders, loadError }: OrdersClientProps) {
  const [confirm, setConfirm] = useState<{ action: "cancel" | "delete"; id: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { blockIfOffline, disabled: offlineDisabled } = useRequireConnection();
  const router = useRouter();

  const canCancel = (status: OrderStatus) =>
    ["PENDING", "PREPARING", "READY", "ON_HOLD"].includes(status);

  const canDelete = (status: OrderStatus) =>
    ["CANCELLED", "ON_HOLD", "PENDING"].includes(status);

  return (
    <div>
      <PageHeader title="Orders" description="View and manage all orders" />

      {loadError && (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          {loadError}
        </div>
      )}

      <div className="space-y-3">
        {orders.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">{loadError ? "No orders loaded" : "No orders yet"}</CardContent></Card>
        ) : (
          orders.map((order) => (
            <Card key={order.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium">{order.orderNumber}</span>
                      <Badge variant={statusVariant[order.status] || "default"}>{order.status}</Badge>
                      <Badge variant="outline">{order.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {order.items.length} items • {order.user.name} • {formatDate(order.createdAt)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {order.items.map((i) => `${i.quantity}x ${i.product?.name ?? "Item"}`).join(", ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right min-w-[140px]">
                      <p className="text-lg font-bold text-gold">{formatCurrency(order.total)}</p>
                      {isSplitOrder(
                        order.payments.map((p) => ({ method: p.method as PaymentMethod }))
                      ) && (
                        <Badge variant="outline" className="text-[10px] mb-1">
                          Split
                        </Badge>
                      )}
                    </div>
                    {canCancel(order.status) && order.status !== "CANCELLED" && (
                      <Button size="sm" variant="outline" disabled={offlineDisabled} onClick={() => setConfirm({ action: "cancel", id: order.id })}>
                        <X className="h-4 w-4 mr-1" /> Cancel
                      </Button>
                    )}
                    {canDelete(order.status) && (
                      <Button size="sm" variant="ghost" className="text-destructive" disabled={offlineDisabled} onClick={() => setConfirm({ action: "delete", id: order.id })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {order.status === "COMPLETED" && order.payments.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Payment</p>
                    <PaymentBreakdown
                      orderTotal={order.total}
                      changeGiven={order.changeGiven ?? 0}
                      payments={order.payments}
                      compact
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
        description={confirm?.action === "cancel" ? "Cancel this order?" : "Delete this order? Paid orders cannot be deleted."}
        confirmLabel={confirm?.action === "cancel" ? "Cancel Order" : "Delete"}
        loading={loading}
        onConfirm={async () => {
          if (!confirm) return;
          if (blockIfOffline("Order update")) return;
          setLoading(true);
          try {
            if (confirm.action === "cancel") {
              await cancelOrder(confirm.id);
              toast({ title: "Order cancelled" });
            } else {
              await deleteOrder(confirm.id);
              toast({ title: "Order deleted" });
            }
            setConfirm(null);
            router.refresh();
          } catch (err) {
            toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
          } finally {
            setLoading(false);
          }
        }}
      />
    </div>
  );
}
