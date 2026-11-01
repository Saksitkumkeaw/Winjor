"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveSeatType, type FormState } from "@/lib/admin/actions";
import type { Tables } from "@/lib/supabase/database.types";
import { Field, FormMessage } from "./form-parts";

const initialState: FormState = {};

export function SeatTypeForm({ seatType }: { seatType?: Tables<"seat_types"> }) {
  const [state, formAction, pending] = useActionState(
    saveSeatType,
    initialState,
  );
  const key = seatType?.id ?? "new";

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border p-3"
    >
      {seatType ? <input type="hidden" name="id" value={seatType.id} /> : null}
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Field label="ชื่อประเภท" htmlFor={`name-${key}`}>
          <Input
            id={`name-${key}`}
            name="name"
            defaultValue={seatType?.name}
            required
          />
        </Field>
        <Field label="ราคาเพิ่ม (บาท)" htmlFor={`surcharge-${key}`}>
          <Input
            id={`surcharge-${key}`}
            name="surcharge"
            type="number"
            min={0}
            step="0.01"
            defaultValue={seatType?.surcharge ?? 0}
            required
          />
        </Field>
        <Button type="submit" disabled={pending}>
          {seatType ? "บันทึก" : "เพิ่มประเภท"}
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
