"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatBaht } from "@/lib/admin/format";
import { holdSeats } from "@/lib/booking/actions";
import { posCreateOrder } from "@/lib/pos/actions";
import { createClient } from "@/lib/supabase/client";
import type { ShowtimeSeat, Tables } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

const MAX_SEATS = 6;
const MAX_ITEM_QUANTITY = 10;
const REFRESH_MS = 15_000;

type Product = Pick<Tables<"products">, "id" | "name" | "price">;

export function SeatPicker({
  showtimeId,
  initialSeats,
  products,
  mode = "online",
}: {
  // หน้าร้านขายสินค้าอย่างเดียวได้ จึงไม่จำเป็นต้องมีรอบฉาย
  showtimeId: string | null;
  initialSeats: ShowtimeSeat[];
  products: Product[];
  mode?: "online" | "pos";
}) {
  const [seats, setSeats] = useState(initialSeats);
  const [selected, setSelected] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!showtimeId) return;

    const liveShowtimeId = showtimeId;
    const supabase = createClient();

    async function refresh() {
      const { data } = await supabase.rpc("get_showtime_seats", {
        p_showtime_id: liveShowtimeId,
      });
      if (!data) return;

      setSeats(data);
    }

    const channel = supabase
      .channel(`showtime:${showtimeId}`)
      .on("broadcast", { event: "seats_changed" }, refresh)
      .subscribe();
    const interval = setInterval(refresh, REFRESH_MS);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [showtimeId]);

  const rows = useMemo(() => {
    const grouped = new Map<string, ShowtimeSeat[]>();
    for (const seat of seats) {
      grouped.set(seat.row_label, [
        ...(grouped.get(seat.row_label) ?? []),
        seat,
      ]);
    }
    return [...grouped.entries()];
  }, [seats]);

  const standardType = useMemo(
    () =>
      seats.reduce<ShowtimeSeat | undefined>(
        (cheapest, seat) =>
          !cheapest || seat.price < cheapest.price ? seat : cheapest,
        undefined,
      )?.seat_type,
    [seats],
  );

  // ที่นั่งที่คนอื่นจองตัดหน้าจะหลุดจากรายการเลือกเอง
  const chosen = seats.filter(
    (seat) => selected.includes(seat.seat_id) && !seat.is_taken,
  );
  const chosenIds = chosen.map((seat) => seat.seat_id);
  const lostSeat = chosen.length !== selected.length;
  const items = products
    .filter((product) => quantities[product.id])
    .map((product) => ({
      product,
      quantity: quantities[product.id],
    }));
  const total =
    chosen.reduce((sum, seat) => sum + seat.price, 0) +
    items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    );

  function toggleSeat(seatId: string) {
    if (chosenIds.includes(seatId)) {
      setError(undefined);
      setSelected(chosenIds.filter((id) => id !== seatId));
    } else if (chosenIds.length >= MAX_SEATS) {
      setError(`เลือกได้สูงสุด ${MAX_SEATS} ที่นั่ง`);
    } else {
      setError(undefined);
      setSelected([...chosenIds, seatId]);
    }
  }

  function changeQuantity(productId: string, change: number) {
    setQuantities((current) => ({
      ...current,
      [productId]: Math.min(
        MAX_ITEM_QUANTITY,
        Math.max(0, (current[productId] ?? 0) + change),
      ),
    }));
  }

  function confirm() {
    setError(undefined);
    const orderItems = items.map((item) => ({
      product_id: item.product.id,
      quantity: item.quantity,
    }));

    startTransition(async () => {
      const result =
        mode === "pos"
          ? await posCreateOrder(showtimeId, chosenIds, orderItems)
          : await holdSeats(showtimeId ?? "", chosenIds, orderItems);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        hidden={!showtimeId}
        className="overflow-x-auto rounded-lg border p-3"
      >
        <div className="mb-4 rounded bg-muted py-1 text-center text-sm text-muted-foreground">
          จอภาพยนตร์
        </div>
        <div className="mx-auto flex w-max flex-col gap-1">
          {rows.map(([label, rowSeats]) => (
            <div key={label} className="flex items-center gap-1">
              <span className="w-6 text-center text-sm font-medium">
                {label}
              </span>
              {rowSeats.map((seat) => {
                if (!seat.is_active) {
                  return <span key={seat.seat_id} className="size-8" />;
                }
                const isSelected = chosenIds.includes(seat.seat_id);
                const isPremium = seat.seat_type !== standardType;
                return (
                  <button
                    key={seat.seat_id}
                    type="button"
                    disabled={seat.is_taken}
                    aria-pressed={isSelected}
                    aria-label={`${seat.row_label}${seat.seat_number} ${seat.seat_type} ${
                      seat.is_taken ? "จองแล้ว" : formatBaht(seat.price)
                    }`}
                    onClick={() => toggleSeat(seat.seat_id)}
                    className={cn(
                      "size-8 rounded border text-xs",
                      seat.is_taken
                        ? "cursor-not-allowed border-red-700 bg-red-600 text-white"
                        : isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : isPremium
                            ? "bg-amber-300 text-black hover:bg-amber-200"
                            : "hover:bg-muted",
                    )}
                  >
                    {seat.seat_number}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <ul className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
          <Legend className="border" label="ว่าง" />
          <Legend className="bg-amber-300" label="พรีเมียม" />
          <Legend className="bg-primary" label="ที่เลือก" />
          <Legend className="bg-red-600" label="จองแล้ว" />
        </ul>
      </div>

      {products.length ? (
        <section>
          <h2 className="mb-2 font-medium">
            {showtimeId ? "เพิ่มสินค้า (ไม่บังคับ)" : "เลือกสินค้า"}
          </h2>
          <ul className="divide-y rounded-lg border">
            {products.map((product) => (
              <li
                key={product.id}
                className="flex items-center justify-between gap-3 p-3"
              >
                <span>
                  {product.name}
                  <span className="ml-2 text-sm text-muted-foreground">
                    {formatBaht(product.price)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`ลด ${product.name}`}
                    onClick={() => changeQuantity(product.id, -1)}
                  >
                    −
                  </Button>
                  <span className="w-5 text-center">
                    {quantities[product.id] ?? 0}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`เพิ่ม ${product.name}`}
                    onClick={() => changeQuantity(product.id, 1)}
                  >
                    +
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
        <div>
          <div className="text-sm text-muted-foreground">
            {chosen.length
              ? chosen
                  .map((seat) => `${seat.row_label}${seat.seat_number}`)
                  .join(", ")
              : showtimeId
                ? "ยังไม่ได้เลือกที่นั่ง"
                : "ขายสินค้าอย่างเดียว"}
          </div>
          <div className="font-semibold">{formatBaht(total)}</div>
        </div>
        <Button
          type="button"
          size="lg"
          disabled={
            pending ||
            (chosen.length === 0 && (mode === "online" || items.length === 0))
          }
          onClick={confirm}
        >
          {pending
            ? "กำลังดำเนินการ…"
            : mode === "pos"
              ? "ไปหน้ารับเงิน"
              : "ยืนยันที่นั่ง"}
        </Button>
      </div>
      {error || lostSeat ? (
        <p role="alert" className="text-sm text-destructive">
          {error ?? "มีคนจองที่นั่งที่คุณเลือกไปแล้ว กรุณาเลือกใหม่"}
        </p>
      ) : null}
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={cn("size-4 rounded", className)} />
      {label}
    </li>
  );
}
