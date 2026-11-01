"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { controlClass, FormMessage } from "@/components/admin/form-parts";
import type { FormState } from "@/lib/admin/actions";
import { formatBaht } from "@/lib/admin/format";
import { applyPoints } from "@/lib/member/actions";
import { pointsToBaht, redeemOptions } from "@/lib/member/validation";

export function PointsRedeem({
  orderId,
  balance,
  redeemed,
  subtotal,
}: {
  orderId: string;
  balance: number;
  redeemed: number;
  subtotal: number;
}) {
  const router = useRouter();
  const [state, setState] = useState<FormState>({});
  const [pending, startTransition] = useTransition();
  const options = redeemOptions(balance + redeemed, subtotal);

  if (options.length <= 1 && redeemed === 0) {
    return (
      <p className="text-sm text-muted-foreground">คะแนนคงเหลือ {balance}</p>
    );
  }

  function change(points: number) {
    startTransition(async () => {
      const result = await applyPoints(orderId, points);
      setState(result);
      if (!result.error) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <label htmlFor="redeem_points" className="text-sm font-medium">
        ใช้คะแนน (คงเหลือ {balance})
      </label>
      <select
        id="redeem_points"
        value={redeemed}
        disabled={pending}
        onChange={(event) => change(Number(event.target.value))}
        className={controlClass}
      >
        {options.map((points) => (
          <option key={points} value={points}>
            {points === 0
              ? "ไม่ใช้คะแนน"
              : `${points} คะแนน ลด ${formatBaht(pointsToBaht(points))}`}
          </option>
        ))}
      </select>
      <FormMessage state={state} />
    </div>
  );
}
