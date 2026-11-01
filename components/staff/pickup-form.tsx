"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTime } from "@/lib/admin/format";
import { pickupOrderItems, type PickupResult } from "@/lib/pos/actions";
import { cn } from "@/lib/utils";

const RESULT_LABEL: Record<PickupResult["result"], string> = {
  ok: "ส่งมอบสินค้าได้",
  picked_up: "รับสินค้าไปแล้ว",
  not_found: "ไม่พบคำสั่งซื้อนี้",
  no_items: "คำสั่งซื้อนี้ไม่มีสินค้า",
  unpaid: "คำสั่งซื้อนี้ยังไม่ได้ชำระเงิน",
};

export function PickupForm() {
  const [result, setResult] = useState<PickupResult>();
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const orderNo = String(new FormData(event.currentTarget).get("order_no"));
    startTransition(async () => {
      setResult(await pickupOrderItems(orderNo));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={submit} className="flex gap-2">
        <Input
          name="order_no"
          aria-label="หมายเลขคำสั่งซื้อ"
          placeholder="เช่น WJ-000123"
          autoComplete="off"
          required
        />
        <Button type="submit" variant="outline" disabled={pending}>
          ตรวจ
        </Button>
      </form>

      {result ? (
        <div
          role="status"
          className={cn(
            "rounded-lg border p-4",
            result.result === "ok"
              ? "border-emerald-600 bg-emerald-50 text-emerald-950"
              : "border-red-600 bg-red-50 text-red-950",
          )}
        >
          <div className="text-lg font-semibold">
            {RESULT_LABEL[result.result]}
          </div>
          {result.items?.map((item) => (
            <div key={item.name} className="text-sm">
              {item.name} × {item.quantity}
            </div>
          ))}
          {result.picked_up_at ? (
            <div className="mt-1 text-sm">
              เมื่อ {formatTime(result.picked_up_at)} น.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
