"use client";

import type { Html5Qrcode } from "html5-qrcode";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatTime } from "@/lib/admin/format";
import {
  checkInTicket,
  findOrderTickets,
  type CheckInResult,
  type OrderTickets,
} from "@/lib/pos/actions";
import { normalizeOrderNo } from "@/lib/pos/codes";
import { SCAN_RESULT_LABEL } from "@/lib/pos/scan-results";
import { cn } from "@/lib/utils";

const READER_ID = "ticket-reader";
// กล้องอ่าน QR เดิมซ้ำตลอดเวลาที่ถือตั๋วไว้ จึงนับจากครั้งล่าสุดที่เห็นรหัสนั้น
const SAME_CODE_COOLDOWN_MS = 10_000;
const RESULT_VISIBLE_MS = 6000;

export function TicketScanner() {
  const [result, setResult] = useState<CheckInResult>();
  const [order, setOrder] = useState<OrderTickets>();
  const [orderError, setOrderError] = useState<string>();
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const scanner = useRef<Html5Qrcode | null>(null);
  const lastScan = useRef({ code: "", at: 0 });

  function submit(code: string) {
    startTransition(async () => {
      setResult(await checkInTicket(code));
    });
  }

  function checkInFromOrder(token: string, orderNo: string) {
    startTransition(async () => {
      setResult(await checkInTicket(token));
      setOrder((await findOrderTickets(orderNo)) ?? undefined);
    });
  }

  function lookUpOrder(orderNo: string) {
    startTransition(async () => {
      const found = await findOrderTickets(orderNo);
      setResult(undefined);
      setOrder(found ?? undefined);
      setOrderError(found ? undefined : "ไม่พบคำสั่งซื้อนี้ หรือยังไม่ได้ชำระเงิน");
    });
  }

  async function stopCamera() {
    const active = scanner.current;
    scanner.current = null;
    setCameraOn(false);
    if (active?.isScanning) await active.stop();
  }

  async function startCamera() {
    setCameraError(undefined);
    setCameraOn(true);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const reader = new Html5Qrcode(READER_ID);
      scanner.current = reader;

      await reader.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 240 },
        (code) => {
          const now = Date.now();
          const last = lastScan.current;
          const repeated =
            code === last.code && now - last.at < SAME_CODE_COOLDOWN_MS;
          lastScan.current = { code, at: now };
          if (!repeated) submit(code);
        },
        undefined,
      );
    } catch {
      setCameraOn(false);
      setCameraError("เปิดกล้องไม่ได้ กรุณาอนุญาตกล้อง หรือกรอกรหัสตั๋วแทน");
    }
  }

  useEffect(() => {
    return () => {
      const active = scanner.current;
      if (active?.isScanning) void active.stop();
    };
  }, []);

  useEffect(() => {
    if (!result) return;

    const timer = setTimeout(() => setResult(undefined), RESULT_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [result]);

  function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const code = String(new FormData(form).get("token")).trim();
    if (!code) return;

    setOrder(undefined);
    setOrderError(undefined);
    const orderNo = normalizeOrderNo(code);
    if (orderNo) lookUpOrder(orderNo);
    else submit(code);
    form.reset();
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        id={READER_ID}
        hidden={!cameraOn}
        className="overflow-hidden rounded-lg border"
      />
      <Button
        type="button"
        variant={cameraOn ? "outline" : "default"}
        onClick={cameraOn ? stopCamera : startCamera}
      >
        {cameraOn ? "ปิดกล้อง" : "เปิดกล้องสแกน"}
      </Button>
      {cameraError ? (
        <p role="alert" className="text-sm text-destructive">
          {cameraError}
        </p>
      ) : null}

      <form onSubmit={submitManual} className="flex gap-2">
        <Input
          name="token"
          aria-label="หมายเลขคำสั่งซื้อ"
          placeholder="หรือกรอกหมายเลขคำสั่งซื้อ เช่น WJ-000123"
          autoComplete="off"
        />
        <Button type="submit" variant="outline" disabled={pending}>
          ตรวจ
        </Button>
      </form>

      {orderError ? (
        <p role="alert" className="text-sm text-destructive">
          {orderError}
        </p>
      ) : null}

      {order ? (
        <div className="rounded-lg border p-3">
          <div className="font-medium">{order.orderNo}</div>
          {order.title && order.startsAt ? (
            <div className="text-sm text-muted-foreground">
              {order.title} · {order.theater} · {formatDate(order.startsAt)}{" "}
              {formatTime(order.startsAt)}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              คำสั่งซื้อนี้ไม่มีตั๋ว
            </div>
          )}
          <ul className="mt-2 divide-y">
            {order.tickets.map((ticket) => (
              <li
                key={ticket.token}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span>ที่นั่ง {ticket.seat}</span>
                {ticket.used ? (
                  <span className="text-sm text-muted-foreground">ใช้แล้ว</span>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      checkInFromOrder(ticket.token, order.orderNo)
                    }
                  >
                    เช็กอิน
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
            {SCAN_RESULT_LABEL[result.result]}
          </div>
          {result.title && result.starts_at ? (
            <div className="mt-1 text-sm">
              {result.title} · {result.theater} · ที่นั่ง {result.seat}
              <br />
              รอบ {formatDate(result.starts_at)} {formatTime(result.starts_at)}
            </div>
          ) : null}
          {result.result === "used" && result.checked_in_at ? (
            <div className="mt-1 text-sm">
              สแกนเมื่อ {formatTime(result.checked_in_at)} น.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
