"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { FormMessage } from "@/components/admin/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/admin/actions";
import { attachMember } from "@/lib/member/actions";

export function MemberAttach({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [state, setState] = useState<FormState>({});
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const phone = String(new FormData(event.currentTarget).get("phone"));
    startTransition(async () => {
      const result = await attachMember(orderId, phone);
      setState(result);
      if (!result.error) router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-lg border p-3">
      <label htmlFor="member_phone" className="text-sm font-medium">
        สมาชิก (สะสมคะแนน)
      </label>
      <div className="flex gap-2">
        <Input
          id="member_phone"
          name="phone"
          type="tel"
          placeholder="เบอร์โทรศัพท์"
          required
        />
        <Button type="submit" variant="outline" disabled={pending}>
          ค้นหา
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
