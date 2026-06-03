import { ArchiveClient } from "@/components/archive/archive-client";
import {
  getArchivedProducts,
  getArchivedSuppliers,
  getArchivedCategories,
  getDeactivatedUsers,
} from "@/lib/actions/archive";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const [products, suppliers, categories, users] = await Promise.all([
    getArchivedProducts().catch(() => []),
    getArchivedSuppliers().catch(() => []),
    getArchivedCategories().catch(() => []),
    getDeactivatedUsers().catch(() => []),
  ]);

  return (
    <ArchiveClient
      products={products}
      suppliers={suppliers.map((s) => ({
        ...s,
        updatedAt: s.updatedAt.toISOString(),
      }))}
      categories={categories.map((c) => ({
        ...c,
        updatedAt: c.updatedAt.toISOString(),
      }))}
      users={users}
    />
  );
}
