"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveProduct, type FormState } from "@/lib/admin/actions";
import type { Tables } from "@/lib/supabase/database.types";
import { Field, FormMessage } from "./form-parts";

const initialState: FormState = {};

export function ProductForm({ product }: { product?: Tables<"products"> }) {
  const [state, formAction, pending] = useActionState(
    saveProduct,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border p-3"
    >
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <div className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_auto]">
        <Field label="ชื่อสินค้า" htmlFor="name">
          <Input id="name" name="name" defaultValue={product?.name} required />
        </Field>
        <Field label="ราคา (บาท)" htmlFor="price">
          <Input
            id="price"
            name="price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={product?.price ?? 0}
            required
          />
        </Field>
        <Button type="submit" disabled={pending}>
          {product ? "บันทึก" : "เพิ่มสินค้า"}
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
