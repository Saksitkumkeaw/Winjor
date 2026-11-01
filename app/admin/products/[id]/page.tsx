import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminSection } from "@/components/admin/admin-section";
import { ProductForm } from "@/components/admin/product-form";
import { RecipeForm } from "@/components/admin/recipe-form";
import { Button } from "@/components/ui/button";
import { removeRecipeItem } from "@/lib/admin/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "แก้ไขสินค้า" };

async function ProductDetail({
  params,
}: Pick<PageProps<"/admin/products/[id]">, "params">) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: product }, { data: recipe }, { data: ingredients }] =
    await Promise.all([
      supabase.from("products").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("product_recipes")
        .select("ingredient_id, quantity, ingredients(name, unit)")
        .eq("product_id", id),
      supabase.from("ingredients").select("id, name, unit").order("name"),
    ]);

  if (!product) notFound();

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">{product.name}</h1>
      <ProductForm key={product.id} product={product} />

      <h2 className="mt-6 mb-2 text-lg font-semibold">สูตรวัตถุดิบ</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        ระบบตัดวัตถุดิบตามสูตรนี้เมื่อขายสำเร็จ สำหรับการขายครั้งถัดไป
      </p>
      {recipe?.length ? (
        <ul className="mb-3 divide-y rounded-lg border">
          {recipe.map((item) => (
            <li
              key={item.ingredient_id}
              className="flex items-center justify-between gap-3 p-3"
            >
              <span>
                {item.ingredients.name}
                <span className="ml-2 text-sm text-muted-foreground">
                  {item.quantity} {item.ingredients.unit}
                </span>
              </span>
              <form action={removeRecipeItem}>
                <input type="hidden" name="product_id" value={id} />
                <input
                  type="hidden"
                  name="ingredient_id"
                  value={item.ingredient_id}
                />
                <Button type="submit" variant="outline" size="sm">
                  ลบ
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-muted-foreground">ยังไม่มีสูตร</p>
      )}
      <RecipeForm productId={id} ingredients={ingredients ?? []} />
    </>
  );
}

export default function ProductDetailPage({
  params,
}: PageProps<"/admin/products/[id]">) {
  return (
    <AdminSection path="/admin/products">
      <ProductDetail params={params} />
    </AdminSection>
  );
}
