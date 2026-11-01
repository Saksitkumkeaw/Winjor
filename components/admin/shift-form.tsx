"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveShift, type FormState } from "@/lib/admin/actions";
import { controlClass, Field, FormMessage } from "./form-parts";

const initialState: FormState = {};

export function ShiftForm({
  staff,
  date,
}: {
  staff: { id: string; full_name: string }[];
  date: string;
}) {
  const [state, formAction, pending] = useActionState(saveShift, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border p-3"
    >
      <div className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <Field label="พนักงาน" htmlFor="staff_id">
          <select
            id="staff_id"
            name="staff_id"
            className={controlClass}
            required
          >
            <option value="">เลือกพนักงาน</option>
            {staff.map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name || "ไม่มีชื่อ"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="วันที่" htmlFor="date">
          <Input
            key={date}
            id="date"
            name="date"
            type="date"
            defaultValue={date}
            required
          />
        </Field>
        <Field label="เริ่ม" htmlFor="start">
          <Input id="start" name="start" type="time" required />
        </Field>
        <Field label="จบ" htmlFor="end">
          <Input id="end" name="end" type="time" required />
        </Field>
        <Button type="submit" disabled={pending}>
          เพิ่มกะ
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        ถ้าเวลาจบน้อยกว่าเวลาเริ่ม ระบบถือว่าเป็นกะข้ามวัน
      </p>
      <FormMessage state={state} />
    </form>
  );
}
