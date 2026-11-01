"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatBaht } from "@/lib/admin/format";
import { checkPayment, payWithPromptPay } from "@/lib/booking/actions";
import { confirmCash, posCancelOrder } from "@/lib/pos/actions";

const POLL_MS = 3000;

export function PosPayment({
  orderId,
  total,
}: {
  orderId: string;
  total: number;
}) {
  const router = useRouter();
  const [qrCode, setQrCode] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!qrCode) return;

    const interval = setInterval(async () => {
      const status = await checkPayment(orderId);
      if (status && status !== "pending") {
        clearInterval(interval);
        router.refresh();
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [orderId, qrCode, router]);

  function takeCash() {
    setError(undefined);
    startTransition(async () => {
      const result = await confirmCash(orderId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  function showPromptPay() {
    setError(undefined);
    startTransition(async () => {
      const result = await payWithPromptPay(orderId);
      if ("error" in result) setError(result.error);
      if ("qrCode" in result) setQrCode(result.qrCode);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border p-3 text-center">
        <div className="text-sm text-muted-foreground">ยอดที่ต้องรับ</div>
        <div className="text-2xl font-semibold">{formatBaht(total)}</div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" size="lg" disabled={pending} onClick={takeCash}>
          รับเงินสดแล้ว
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          disabled={pending}
          onClick={showPromptPay}
        >
          PromptPay
        </Button>
      </div>

      {qrCode ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL จาก Omise */}
          <img src={qrCode} alt="QR PromptPay" className="size-60" />
          <p className="text-sm text-muted-foreground">
            ให้ลูกค้าสแกน ระบบจะอัปเดตเองเมื่อจ่ายสำเร็จ
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        onClick={() => startTransition(() => posCancelOrder(orderId))}
      >
        ยกเลิกรายการ
      </Button>
    </div>
  );
}
