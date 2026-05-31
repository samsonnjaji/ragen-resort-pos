import { getProducts, getCategories } from "@/lib/actions/products";
import { getSettings } from "@/lib/actions/dashboard";
import { POSClient } from "@/components/pos/pos-client";

export default async function POSPage() {
  const [products, categories, settings] = await Promise.all([
    getProducts(),
    getCategories(),
    getSettings(),
  ]);

  return <POSClient products={products} categories={categories} taxRate={settings.taxRate} />;
}
