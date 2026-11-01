"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adjustStock, type FormState } from "@/lib/admin/actions";
import type { Tables } from "@/lib/supabase/database.types";
import { controlClass, Field, FormMessage } from "./form-parts";

const initialState: FormState = {};

export function StockForm({
  ingredients,
}: {
  ingredients: Pick<Tables<"ingredients">, "id" | "name" | "unit">[];
}) {
  const [state, formAction, pending] = useActionState(
    adjustStock,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border p-3"
    >
      <h2 className="font-medium">รับเข้าหรือปรับสต็อก</h2>
      <div className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <Field label="วัตถุดิบ" htmlFor="stock_ingredient_id">
          <select
            id="stock_ingredient_id"
            name="ingredient_id"
            className={controlClass}
            required
          >
            <option value="">เลือกวัตถุดิบ</option>
            {ingredients.map((ingredient) => (
              <option key={ingredient.id} value={ingredient.id}>
                {ingredient.name} ({ingredient.unit})
              </option>
            ))}
          </select>
        </Field>
        <Field label="ประเภท" htmlFor="reason">
          <select id="reason" name="reason" className={controlClass}>
            <option value="purchase">รับเข้า</option>
            <option value="adjustment">ปรับยอด</option>
          </select>
        </Field>
        <Field label="จำนวน (ปรับลดใส่ติดลบ)" htmlFor="change">
          <Input id="change" name="change" type="number" step="0.01" required />
        </Field>
        <Button type="submit" disabled={pending}>
          บันทึก
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
