import { ProductsClient } from "@/components/products/products-client";
import { getAllProductsAdmin, getAllCategories } from "@/lib/actions/products";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  try {
    const [products, categories] = await Promise.all([getAllProductsAdmin(), getAllCategories()]);
    return <ProductsClient products={products} categories={categories} />;
  } catch (error) {
    console.error("[ProductsPage]", error);
    return <ProductsClient products={[]} categories={[]} loadError="Unable to load products. Please refresh the page." />;
  }
}
