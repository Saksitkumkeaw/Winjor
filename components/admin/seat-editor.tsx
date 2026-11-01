"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { saveSeats, type FormState, type SeatChange } from "@/lib/admin/actions";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/supabase/database.types";
import { FormMessage } from "./form-parts";

type Seat = Pick<
  Tables<"seats">,
  "id" | "row_label" | "seat_number" | "seat_type_id" | "is_active"
>;
type SeatType = Pick<Tables<"seat_types">, "id" | "name">;

const CLOSED = "closed";
// สีแดงสงวนไว้สำหรับที่นั่งที่ถูกจองแล้ว
const TYPE_COLORS = [
  "bg-background",
  "bg-amber-300 text-black",
  "bg-sky-300 text-black",
  "bg-emerald-300 text-black",
  "bg-violet-300 text-black",
];

export function SeatEditor({
  theaterId,
  seats,
  seatTypes,
}: {
  theaterId: string;
  seats: Seat[];
  seatTypes: SeatType[];
}) {
  const [draft, setDraft] = useState(seats);
  const [saved, setSaved] = useState(seats);
  const [tool, setTool] = useState(seatTypes[0]?.id ?? CLOSED);
  const [state, setState] = useState<FormState>({});
  const [pending, startTransition] = useTransition();

  const colorOf = useMemo(
    () =>
      new Map(
        seatTypes.map((type, index) => [
          type.id,
          TYPE_COLORS[index % TYPE_COLORS.length],
        ]),
      ),
    [seatTypes],
  );
  const nameOf = useMemo(
    () => new Map(seatTypes.map((type) => [type.id, type.name])),
    [seatTypes],
  );
  const rows = useMemo(() => {
    const grouped = new Map<string, Seat[]>();
    for (const seat of draft) {
      grouped.set(seat.row_label, [
        ...(grouped.get(seat.row_label) ?? []),
        seat,
      ]);
    }
    return [...grouped.entries()];
  }, [draft]);

  const changes: SeatChange[] = draft
    .filter((seat, index) => {
      const original = saved[index];
      return (
        seat.seat_type_id !== original.seat_type_id ||
        seat.is_active !== original.is_active
      );
    })
    .map(({ id, seat_type_id, is_active }) => ({
      id,
      seat_type_id,
      is_active,
    }));

  function paint(ids: string[]) {
    const targets = new Set(ids);
    setDraft((current) =>
      current.map((seat) => {
        if (!targets.has(seat.id)) return seat;
        return tool === CLOSED
          ? { ...seat, is_active: false }
          : { ...seat, seat_type_id: tool, is_active: true };
      }),
    );
    setState({});
  }

  function save() {
    startTransition(async () => {
      const result = await saveSeats(theaterId, changes);
      setState(result);
      if (!result.error) setSaved(draft);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="mb-2 text-sm text-muted-foreground">
          เลือกแบบแล้วกดที่นั่ง หรือกดชื่อแถวเพื่อเปลี่ยนทั้งแถว
        </legend>
        {seatTypes.map((type) => (
          <Button
            key={type.id}
            type="button"
            variant={tool === type.id ? "default" : "outline"}
            onClick={() => setTool(type.id)}
          >
            <span
              className={cn("size-3 rounded-sm border", colorOf.get(type.id))}
            />
            {type.name}
          </Button>
        ))}
        <Button
          type="button"
          variant={tool === CLOSED ? "default" : "outline"}
          onClick={() => setTool(CLOSED)}
        >
          ปิดที่นั่ง
        </Button>
      </fieldset>

      <div className="overflow-x-auto rounded-lg border p-3">
        <div className="mb-3 rounded bg-muted py-1 text-center text-sm text-muted-foreground">
          จอภาพยนตร์
        </div>
        <div className="flex w-max flex-col gap-1">
          {rows.map(([label, rowSeats]) => (
            <div key={label} className="flex gap-1">
              <button
                type="button"
                aria-label={`เปลี่ยนทั้งแถว ${label}`}
                onClick={() => paint(rowSeats.map((seat) => seat.id))}
                className="size-8 rounded font-medium hover:bg-muted"
              >
                {label}
              </button>
              {rowSeats.map((seat) => (
                <button
                  key={seat.id}
                  type="button"
                  aria-label={`${seat.row_label}${seat.seat_number} ${
                    seat.is_active ? nameOf.get(seat.seat_type_id) : "ปิดอยู่"
                  }`}
                  onClick={() => paint([seat.id])}
                  className={cn(
                    "size-8 rounded border text-xs",
                    seat.is_active
                      ? colorOf.get(seat.seat_type_id)
                      : "border-dashed text-muted-foreground line-through",
                  )}
                >
                  {seat.seat_number}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="lg"
          disabled={pending || changes.length === 0}
          onClick={save}
        >
          {pending ? "กำลังบันทึก…" : `บันทึก (${changes.length})`}
        </Button>
        <FormMessage state={state} />
      </div>
    </div>
  );
}
