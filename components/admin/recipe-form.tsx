"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveRecipeItem, type FormState } from "@/lib/admin/actions";
import type { Tables } from "@/lib/supabase/database.types";
import { controlClass, Field, FormMessage } from "./form-parts";

const initialState: FormState = {};

export function RecipeForm({
  productId,
  ingredients,
}: {
  productId: string;
  ingredients: Pick<Tables<"ingredients">, "id" | "name" | "unit">[];
}) {
  const [state, formAction, pending] = useActionState(
    saveRecipeItem,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border p-3"
    >
      <input type="hidden" name="product_id" value={productId} />
      <div className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_auto]">
        <Field label="วัตถุดิบ" htmlFor="ingredient_id">
          <select
            id="ingredient_id"
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
        <Field label="ปริมาณต่อชิ้น" htmlFor="quantity">
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min={0.01}
            step="0.01"
            required
          />
        </Field>
        <Button type="submit" disabled={pending}>
          บันทึกในสูตร
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
