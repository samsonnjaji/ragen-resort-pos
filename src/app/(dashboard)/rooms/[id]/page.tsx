import { notFound } from "next/navigation";
import { RoomAccountClient } from "@/components/rooms/room-account-client";
import { getRoomAccount } from "@/lib/actions/room-billing";
import { getProducts } from "@/lib/actions/products";
import { getSettings } from "@/lib/actions/dashboard";
import { getSession } from "@/lib/actions/dashboard";

export default async function RoomAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [account, products, settings, session] = await Promise.all([
    getRoomAccount(id).catch(() => null),
    getProducts(),
    getSettings(),
    getSession(),
  ]);

  if (!account) notFound();

  const activeProducts = products.filter(
    (p) => p.status === "ACTIVE" && p.isActive && !p.deletedAt && !p.archivedAt
  );

  return (
    <RoomAccountClient
      account={account}
      products={activeProducts.map((p) => ({
        id: p.id,
        name: p.name,
        sellingPrice: p.sellingPrice,
        stock: p.stock,
        category: { type: p.category.type },
      }))}
      settings={{
        businessName: settings.businessName,
        businessAddress: settings.businessAddress,
        phone: settings.phone,
        email: settings.email,
        currency: settings.currency,
        receiptSize: settings.receiptSize,
        receiptAlignment: settings.receiptAlignment,
        receiptCompact: settings.receiptCompact,
      }}
      isAdmin={session?.user?.role === "ADMIN"}
    />
  );
}
