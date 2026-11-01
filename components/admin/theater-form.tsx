"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTheater, type FormState } from "@/lib/admin/actions";
import { MAX_SEATS_PER_ROW, MAX_THEATER_ROWS } from "@/lib/admin/validation";
import { Field, FormMessage } from "./form-parts";

const initialState: FormState = {};

export function TheaterForm() {
  const [state, formAction, pending] = useActionState(
    createTheater,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border p-3"
    >
      <div className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <Field label="ชื่อโรง" htmlFor="name">
          <Input id="name" name="name" required />
        </Field>
        <Field label="จำนวนแถว" htmlFor="rows">
          <Input
            id="rows"
            name="rows"
            type="number"
            min={1}
            max={MAX_THEATER_ROWS}
            defaultValue={8}
            required
          />
        </Field>
        <Field label="ที่นั่งต่อแถว" htmlFor="seats_per_row">
          <Input
            id="seats_per_row"
            name="seats_per_row"
            type="number"
            min={1}
            max={MAX_SEATS_PER_ROW}
            defaultValue={12}
            required
          />
        </Field>
        <Button type="submit" disabled={pending}>
          สร้างโรง
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        ขนาดผังแก้ภายหลังไม่ได้ แต่เปลี่ยนประเภทหรือปิดที่นั่งได้
      </p>
      <FormMessage state={state} />
    </form>
  );
}
