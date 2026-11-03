import type { Metadata } from "next";
import Link from "next/link";
import { AdminSection } from "@/components/admin/admin-section";
import { IngredientForm } from "@/components/admin/ingredient-form";
import { StockForm } from "@/components/admin/stock-form";
import { formatDate, formatTime } from "@/lib/admin/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "สต็อก" };

const REASON_LABEL = {
  purchase: "รับเข้า",
  sale: "ขาย",
  adjustment: "ปรับยอด",
};

async function Stock() {
  const supabase = await createClient();

  const [{ data: ingredients }, { data: movements }] = await Promise.all([
    supabase
      .from("ingredients")
      .select("id, name, unit, quantity_on_hand, reorder_level")
      .order("name"),
    supabase
      .from("stock_movements")
      .select("id, change_qty, reason, created_at, ingredients(name, unit)")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const lowStock = ingredients?.filter(
    (ingredient) => ingredient.quantity_on_hand <= ingredient.reorder_level,
  );

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">สต็อก</h1>

      {lowStock?.length ? (
        <p
          role="status"
          className="mb-4 rounded-lg border border-red-600 bg-red-50 p-3 text-red-950"
        >
          วัตถุดิบใกล้หมด:{" "}
          {lowStock.map((ingredient) => ingredient.name).join(", ")}{" "}
          <Link href="/admin/stock/planning" className="font-medium underline">
            ดูว่าควรสั่งเท่าไร
          </Link>
        </p>
      ) : (
        <p className="mb-4 text-sm">
          <Link href="/admin/stock/planning" className="underline">
            วางแผนสั่งซื้อด้วย EOQ และจุดสั่งซื้อ
          </Link>
        </p>
      )}

      <div className="flex flex-col gap-3">
        <StockForm ingredients={ingredients ?? []} />
        <IngredientForm />
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border">
        <table className="w-full min-w-md text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-2 font-medium">วัตถุดิบ</th>
              <th className="p-2 font-medium">คงเหลือ</th>
              <th className="p-2 font-medium">แจ้งเตือนเมื่อเหลือ</th>
            </tr>
          </thead>
          <tbody>
            {ingredients?.map((ingredient) => (
              <tr key={ingredient.id} className="border-t">
                <td className="p-2">{ingredient.name}</td>
                <td
                  className={cn(
                    "p-2",
                    ingredient.quantity_on_hand <= ingredient.reorder_level &&
                      "font-semibold text-red-700",
                  )}
                >
                  {ingredient.quantity_on_hand.toLocaleString("th-TH")}{" "}
                  {ingredient.unit}
                </td>
                <td className="p-2">
                  {ingredient.reorder_level.toLocaleString("th-TH")}{" "}
                  {ingredient.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-6 mb-2 text-lg font-semibold">รายการล่าสุด</h2>
      {movements?.length ? (
        <ul className="divide-y rounded-lg border text-sm">
          {movements.map((movement) => (
            <li key={movement.id} className="flex justify-between gap-3 p-2">
              <span>
                {REASON_LABEL[movement.reason]} · {movement.ingredients.name}{" "}
                <span className="text-muted-foreground">
                  {formatDate(movement.created_at)}{" "}
                  {formatTime(movement.created_at)}
                </span>
              </span>
              <span>
                {movement.change_qty > 0 ? "+" : ""}
                {movement.change_qty.toLocaleString("th-TH")}{" "}
                {movement.ingredients.unit}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">ยังไม่มีรายการ</p>
      )}
    </>
  );
}

export default function StockPage() {
  return (
    <AdminSection path="/admin/stock">
      <Stock />
    </AdminSection>
  );
}
