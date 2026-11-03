"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveIngredient, type FormState } from "@/lib/admin/actions";
import type { Tables } from "@/lib/supabase/database.types";
import { Field, FormMessage } from "./form-parts";

const initialState: FormState = {};

type Ingredient = Pick<
  Tables<"ingredients">,
  | "id"
  | "name"
  | "unit"
  | "reorder_level"
  | "unit_cost"
  | "order_cost"
  | "holding_rate"
  | "lead_time_days"
  | "discount_min_qty"
  | "discount_pct"
>;

export function IngredientForm({ ingredient }: { ingredient?: Ingredient }) {
  const [state, formAction, pending] = useActionState(
    saveIngredient,
    initialState,
  );
  const prefix = ingredient ? `ingredient_${ingredient.id}` : "ingredient";

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border p-3"
    >
      <h2 className="font-medium">
        {ingredient ? "ตั้งค่าวัตถุดิบและต้นทุน" : "เพิ่มวัตถุดิบ"}
      </h2>
      {ingredient ? <input type="hidden" name="id" value={ingredient.id} /> : null}
      <div className="grid items-end gap-3 sm:grid-cols-3">
        <Field label="ชื่อวัตถุดิบ" htmlFor={`${prefix}_name`}>
          <Input
            id={`${prefix}_name`}
            name="name"
            defaultValue={ingredient?.name}
            required
          />
        </Field>
        <Field label="หน่วย" htmlFor={`${prefix}_unit`}>
          <Input
            id={`${prefix}_unit`}
            name="unit"
            placeholder="เช่น กรัม"
            defaultValue={ingredient?.unit}
            required
          />
        </Field>
        <Field label="แจ้งเตือนเมื่อเหลือ" htmlFor={`${prefix}_reorder_level`}>
          <Input
            id={`${prefix}_reorder_level`}
            name="reorder_level"
            type="number"
            min={0}
            step="0.01"
            defaultValue={ingredient?.reorder_level ?? 0}
            required
          />
        </Field>
      </div>
      <div className="grid items-end gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Field label="ต้นทุนต่อหน่วย C (บาท)" htmlFor={`${prefix}_unit_cost`}>
          <Input
            id={`${prefix}_unit_cost`}
            name="unit_cost"
            type="number"
            min={0}
            step="0.0001"
            defaultValue={ingredient?.unit_cost ?? 0}
            required
          />
        </Field>
        <Field label="ค่าสั่งต่อครั้ง F (บาท)" htmlFor={`${prefix}_order_cost`}>
          <Input
            id={`${prefix}_order_cost`}
            name="order_cost"
            type="number"
            min={0}
            step="0.01"
            defaultValue={ingredient?.order_cost ?? 0}
            required
          />
        </Field>
        <Field label="ค่าเก็บต่อปี I (%)" htmlFor={`${prefix}_holding_pct`}>
          <Input
            id={`${prefix}_holding_pct`}
            name="holding_pct"
            type="number"
            min={0}
            max={100}
            step="0.01"
            defaultValue={Math.round((ingredient?.holding_rate ?? 0.25) * 10000) / 100}
            required
          />
        </Field>
        <Field label="รอของ L (วัน)" htmlFor={`${prefix}_lead_time_days`}>
          <Input
            id={`${prefix}_lead_time_days`}
            name="lead_time_days"
            type="number"
            min={0}
            max={60}
            step={1}
            defaultValue={ingredient?.lead_time_days ?? 3}
            required
          />
        </Field>
        <Field label="ส่วนลดเมื่อซื้อ ≥" htmlFor={`${prefix}_discount_min_qty`}>
          <Input
            id={`${prefix}_discount_min_qty`}
            name="discount_min_qty"
            type="number"
            min={0}
            step="0.01"
            placeholder="ไม่มี"
            defaultValue={ingredient?.discount_min_qty ?? ""}
          />
        </Field>
        <Field label="ส่วนลด (%)" htmlFor={`${prefix}_discount_pct`}>
          <Input
            id={`${prefix}_discount_pct`}
            name="discount_pct"
            type="number"
            min={0}
            max={99.99}
            step="0.01"
            placeholder="ไม่มี"
            defaultValue={ingredient?.discount_pct ?? ""}
          />
        </Field>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {ingredient ? "บันทึก" : "เพิ่ม"}
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
