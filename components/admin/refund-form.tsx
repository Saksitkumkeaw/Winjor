"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { refundOrder, type FormState } from "@/lib/admin/actions";
import { FormMessage } from "./form-parts";

const initialState: FormState = {};

export function RefundForm({
  orderId,
  manual,
}: {
  orderId: string;
  manual: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    refundOrder,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={orderId} />
      <div className="flex gap-2">
        <Input
          name="reason"
          aria-label="เหตุผลการคืนเงิน"
          placeholder="เหตุผล"
          required
        />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {manual ? "บันทึกคืนเงิน" : "คืนเงิน"}
        </Button>
      </div>
      {manual ? (
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="manual_confirmed" required />
          คืนเงินให้ลูกค้าเองแล้ว
        </label>
      ) : null}
      <FormMessage state={state} />
    </form>
  );
}
