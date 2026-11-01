"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp, type AuthState } from "@/lib/auth/actions";

const initialState: AuthState = {};

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  if (state.notice) {
    return (
      <p role="status" className="text-sm">
        {state.notice}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="full_name">ชื่อ-นามสกุล</Label>
        <Input id="full_name" name="full_name" autoComplete="name" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">เบอร์โทรศัพท์ (ไม่บังคับ)</Label>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">อีเมล</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "กำลังสมัคร…" : "สมัครสมาชิก"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        มีบัญชีแล้ว?{" "}
        <Link href="/login" className="text-foreground underline">
          เข้าสู่ระบบ
        </Link>
      </p>
    </form>
  );
}
