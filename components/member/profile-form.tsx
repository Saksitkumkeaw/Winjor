"use client";

import { useActionState } from "react";
import { Field, FormMessage } from "@/components/admin/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/admin/actions";
import { updateProfile } from "@/lib/member/actions";

const initialState: FormState = {};

export function ProfileForm({
  fullName,
  phone,
}: {
  fullName: string;
  phone: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    updateProfile,
    initialState,
  );

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-3">
      <Field label="ชื่อ-นามสกุล" htmlFor="full_name">
        <Input
          id="full_name"
          name="full_name"
          defaultValue={fullName}
          required
        />
      </Field>
      <Field label="เบอร์โทรศัพท์" htmlFor="phone">
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={phone ?? ""}
        />
      </Field>
      <FormMessage state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          บันทึก
        </Button>
      </div>
    </form>
  );
}
