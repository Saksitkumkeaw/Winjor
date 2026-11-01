"use client";

import { useRouter } from "next/navigation";
import Script from "next/script";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelOrder,
  checkPayment,
  payWithCard,
  payWithPromptPay,
  type PaymentResult,
} from "@/lib/booking/actions";

type OmiseCardToken = { id?: string; message?: string };
type OmiseJs = {
  setPublicKey(key: string): void;
  createToken(
    type: "card",
    card: {
      name: string;
      number: string;
      expiration_month: number;
      expiration_year: number;
      security_code: string;
    },
    callback: (status: number, response: OmiseCardToken) => void,
  ): void;
};

declare global {
  interface Window {
    Omise?: OmiseJs;
  }
}

const POLL_MS = 3000;

function secondsLeft(expiresAt: string): number {
  return Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
  );
}

export function CheckoutPanel({
  orderId,
  expiresAt,
}: {
  orderId: string;
  expiresAt: string;
}) {
  const router = useRouter();
  const [left, setLeft] = useState<number>();
  const [method, setMethod] = useState<"card" | "promptpay">("card");
  const [qrCode, setQrCode] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  const handleResult = useCallback(
    (result: PaymentResult) => {
      if ("error" in result) setError(result.error);
      if ("qrCode" in result) setQrCode(result.qrCode);
      if ("redirectTo" in result) {
        if (result.redirectTo.startsWith("/")) router.push(result.redirectTo);
        else window.location.assign(result.redirectTo);
      }
    },
    [router],
  );

  useEffect(() => {
    const update = () => setLeft(secondsLeft(expiresAt));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const status = await checkPayment(orderId);
      if (status && status !== "pending") {
        clearInterval(interval);
        router.refresh();
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [orderId, router]);

  function submitCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    const omise = window.Omise;
    if (!omise) {
      setError("ระบบชำระเงินยังโหลดไม่เสร็จ กรุณาลองใหม่");
      return;
    }

    const data = new FormData(event.currentTarget);
    const [month, year] = String(data.get("expiry")).split("/");

    omise.setPublicKey(process.env.NEXT_PUBLIC_OMISE_PUBLIC_KEY!);
    omise.createToken(
      "card",
      {
        name: String(data.get("card_name")),
        number: String(data.get("card_number")).replace(/\s/g, ""),
        expiration_month: Number(month),
        expiration_year: 2000 + Number(year),
        security_code: String(data.get("security_code")),
      },
      (status, response) => {
        if (status !== 200 || !response.id) {
          setError("ข้อมูลบัตรไม่ถูกต้อง");
          return;
        }
        const token = response.id;
        startTransition(async () => {
          handleResult(await payWithCard(orderId, token));
        });
      },
    );
  }

  function showPromptPay() {
    setMethod("promptpay");
    setError(undefined);
    startTransition(async () => {
      handleResult(await payWithPromptPay(orderId));
    });
  }

  const expired = left === 0;

  return (
    <div className="flex flex-col gap-4">
      <Script src="https://cdn.omise.co/omise.js" strategy="lazyOnload" />

      <div className="flex items-center justify-between rounded-lg border p-3">
        <span className="font-semibold tabular-nums">
          {left === undefined
            ? "--:--"
            : `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`}
        </span>
        <span className="text-sm text-muted-foreground">
          {expired ? "หมดเวลาแล้ว" : "ที่นั่งถูกล็อกไว้"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={method === "card" ? "default" : "outline"}
          onClick={() => setMethod("card")}
        >
          บัตร
        </Button>
        <Button
          type="button"
          variant={method === "promptpay" ? "default" : "outline"}
          disabled={expired}
          onClick={showPromptPay}
        >
          PromptPay
        </Button>
      </div>

      {method === "card" ? (
        // ข้อมูลบัตรแลกเป็น token ที่ Omise โดยตรง และไม่ถูกส่งมาที่เซิร์ฟเวอร์ของเรา
        <form ref={form} onSubmit={submitCard} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="card_name">ชื่อบนบัตร</Label>
            <Input
              id="card_name"
              name="card_name"
              autoComplete="cc-name"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="card_number">หมายเลขบัตร</Label>
            <Input
              id="card_number"
              name="card_number"
              inputMode="numeric"
              autoComplete="cc-number"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="expiry">วันหมดอายุ (MM/YY)</Label>
              <Input
                id="expiry"
                name="expiry"
                placeholder="12/29"
                pattern="\d{2}/\d{2}"
                autoComplete="cc-exp"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="security_code">CVV</Label>
              <Input
                id="security_code"
                name="security_code"
                inputMode="numeric"
                autoComplete="cc-csc"
                required
              />
            </div>
          </div>
          <Button type="submit" size="lg" disabled={pending || expired}>
            {pending ? "กำลังชำระเงิน…" : "ชำระเงิน"}
          </Button>
        </form>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border p-4">
          {qrCode ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL จาก Omise */}
              <img src={qrCode} alt="QR PromptPay" className="size-60" />
              <p className="text-sm text-muted-foreground">
                สแกนเพื่อชำระเงิน ระบบจะอัปเดตเองเมื่อจ่ายสำเร็จ
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {pending ? "กำลังสร้าง QR…" : "กด PromptPay เพื่อสร้าง QR"}
            </p>
          )}
        </div>
      )}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        onClick={() => startTransition(() => cancelOrder(orderId))}
      >
        ยกเลิกการจอง
      </Button>
    </div>
  );
}
