"use client";

import { useActionState } from "react";
import { Field, FormMessage } from "@/components/admin/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/admin/actions";
import { registerMember } from "@/lib/member/actions";

const initialState: FormState = {};

export function MemberRegisterForm() {
  const [state, formAction, pending] = useActionState(
    registerMember,
    initialState,
  );

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-3">
      <Field label="ชื่อ-นามสกุล" htmlFor="full_name">
        <Input id="full_name" name="full_name" autoComplete="off" required />
      </Field>
      <Field label="เบอร์โทรศัพท์" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" autoComplete="off" required />
      </Field>
      <Field label="อีเมล" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="off" required />
      </Field>
      <Field label="รหัสผ่าน (ให้ลูกค้ากรอกเอง)" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>
      <FormMessage state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          สมัครสมาชิก
        </Button>
      </div>
    </form>
  );
}
