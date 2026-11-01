import type { Metadata } from "next";
import Link from "next/link";
import { AdminSection } from "@/components/admin/admin-section";
import { ProductForm } from "@/components/admin/product-form";
import { Button } from "@/components/ui/button";
import { setProductActive } from "@/lib/admin/actions";
import { formatBaht } from "@/lib/admin/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "จัดการสินค้า" };

async function ProductList() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, is_active, product_recipes(ingredient_id)")
    .order("name");

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">สินค้า</h1>
      <ProductForm />
      {products?.length ? (
        <ul className="mt-4 divide-y rounded-lg border">
          {products.map((product) => (
            <li key={product.id} className="flex items-center gap-3 p-3">
              <Link
                href={`/admin/products/${product.id}`}
                className="min-w-0 flex-1 hover:underline"
              >
                <span className="font-medium">{product.name}</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  {formatBaht(product.price)} ·{" "}
                  {product.product_recipes.length
                    ? `${product.product_recipes.length} วัตถุดิบ`
                    : "ยังไม่มีสูตร"}
                  {product.is_active ? "" : " · ปิดขาย"}
                </span>
              </Link>
              <form action={setProductActive}>
                <input type="hidden" name="id" value={product.id} />
                <input
                  type="hidden"
                  name="is_active"
                  value={String(!product.is_active)}
                />
                <Button type="submit" variant="outline">
                  {product.is_active ? "ปิดขาย" : "เปิดขาย"}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-muted-foreground">ยังไม่มีสินค้า</p>
      )}
    </>
  );
}

export default function ProductsPage() {
  return (
    <AdminSection path="/admin/products">
      <ProductList />
    </AdminSection>
  );
}
