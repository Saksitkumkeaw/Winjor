"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveIngredient, type FormState } from "@/lib/admin/actions";
import { Field, FormMessage } from "./form-parts";

const initialState: FormState = {};

export function IngredientForm() {
  const [state, formAction, pending] = useActionState(
    saveIngredient,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border p-3"
    >
      <h2 className="font-medium">เพิ่มวัตถุดิบ</h2>
      <div className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <Field label="ชื่อวัตถุดิบ" htmlFor="ingredient_name">
          <Input id="ingredient_name" name="name" required />
        </Field>
        <Field label="หน่วย" htmlFor="unit">
          <Input id="unit" name="unit" placeholder="เช่น กรัม" required />
        </Field>
        <Field label="แจ้งเตือนเมื่อเหลือ" htmlFor="reorder_level">
          <Input
            id="reorder_level"
            name="reorder_level"
            type="number"
            min={0}
            step="0.01"
            defaultValue={0}
            required
          />
        </Field>
        <Button type="submit" disabled={pending}>
          เพิ่ม
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
