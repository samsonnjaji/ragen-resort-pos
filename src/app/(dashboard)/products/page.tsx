import { ProductsClient } from "@/components/products/products-client";
import { getAllProducts } from "@/lib/actions/inventory";
import { getCategories } from "@/lib/actions/products";

export default async function ProductsPage() {
  const [products, categories] = await Promise.all([getAllProducts(), getCategories()]);
  return <ProductsClient products={products} categories={categories} />;
}
