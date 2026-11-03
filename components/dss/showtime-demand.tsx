import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  ACTION_LABEL,
  HIGH_OCCUPANCY,
  LOW_OCCUPANCY,
  MIN_SHOWTIMES,
  type MovieDemand,
  type ShowtimeAction,
  type ShowtimeAdvice,
} from "@/lib/dss/showtimes";
import { cn } from "@/lib/utils";
import { formatPercent } from "./parts";

const ACTION_STYLE: Record<ShowtimeAction, { bar: string; badge: string }> = {
  add: { bar: "bg-emerald-600", badge: "bg-emerald-50 text-emerald-800 ring-emerald-600/30" },
  keep: { bar: "bg-sky-600", badge: "bg-sky-50 text-sky-800 ring-sky-600/30" },
  reduce: { bar: "bg-red-600", badge: "bg-red-50 text-red-800 ring-red-600/30" },
  watch: { bar: "bg-amber-500", badge: "bg-amber-50 text-amber-900 ring-amber-600/30" },
  normal: { bar: "bg-slate-400", badge: "bg-muted text-muted-foreground ring-foreground/10" },
};

// เรื่องที่ต้องทำอะไรสักอย่างอยู่ด้านบน
const PRIORITY: Record<ShowtimeAction, number> = { add: 0, reduce: 1, watch: 2, keep: 3, normal: 4 };

export function ActionBadge({ action }: { action: ShowtimeAction }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1",
        ACTION_STYLE[action].badge,
      )}
    >
      {ACTION_LABEL[action]}
    </span>
  );
}

function Trend({ value }: { value: number | null }) {
  if (value === null) return null;
  const points = Math.round(value * 100);
  if (points === 0) return <span className="text-muted-foreground">เท่าเดิม</span>;
  return (
    <span className={cn("whitespace-nowrap", points > 0 ? "text-emerald-700" : "text-red-700")}>
      {points > 0 ? "▲" : "▼"} {Math.abs(points)} จุดจากช่วงก่อน
    </span>
  );
}

function Marker({ value, className }: { value: number; className: string }) {
  return (
    <div
      aria-hidden
      className={cn("absolute inset-y-0 border-l-2 border-dashed", className)}
      style={{ left: `${value * 100}%` }}
    />
  );
}

// แท่งยาว = คนดูมาก แท่งเลยเส้นเขียว = เต็ม ไม่ถึงเส้นแดง = ว่าง
function DemandRow({ row, days }: { row: ShowtimeAdvice; days: number }) {
  const occupancy = Math.min(row.occupancy ?? 0, 1);

  return (
    <li className="grid gap-x-4 gap-y-1 py-3 sm:grid-cols-[12rem_1fr]">
      <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-start sm:justify-start">
        <span className="min-w-0 truncate font-medium">{row.title}</span>
        <ActionBadge action={row.action} />
      </div>
      <div>
        <div className="flex items-center gap-3">
          <div className="relative h-6 flex-1 rounded bg-muted">
            <div
              className={cn("h-full rounded", ACTION_STYLE[row.action].bar)}
              style={{ width: `${occupancy * 100}%` }}
            />
            <Marker value={LOW_OCCUPANCY} className="border-red-700/70" />
            <Marker value={HIGH_OCCUPANCY} className="border-emerald-700/70" />
          </div>
          <span className="w-12 text-right font-semibold tabular-nums">
            {formatPercent(row.occupancy)}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          <span>{row.reason}</span>
          <Trend value={row.trend} />
          {row.action === "add" ? (
            <Link
              href={`?movie=${row.movie_id}&demand=${days}#new-showtime`}
              className={buttonVariants({ size: "sm" })}
            >
              สร้างรอบ
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function ShowtimeDemand({
  advice,
  medianShows,
  tooFew,
  days,
  presets,
}: {
  advice: ShowtimeAdvice[];
  medianShows: number;
  tooFew: MovieDemand[];
  days: number;
  presets: ReactNode;
}) {
  const sorted = [...advice].sort(
    (a, b) => PRIORITY[a.action] - PRIORITY[b.action] || (b.occupancy ?? 0) - (a.occupancy ?? 0),
  );
  const counts = (["add", "reduce", "watch"] as const)
    .map((action) => ({ action, count: advice.filter((row) => row.action === action).length }))
    .filter((item) => item.count > 0);

  return (
    <section aria-labelledby="demand-heading" className="mb-6 rounded-lg border p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="demand-heading" className="text-lg font-semibold">
            ควรเพิ่มรอบหนังเรื่องไหน
          </h2>
          <p className="text-sm text-muted-foreground">
            คนดูกี่เปอร์เซ็นต์ของที่นั่ง จากรอบที่ฉายแล้ว {days} วันล่าสุด
          </p>
        </div>
        {presets}
      </div>

      {advice.length ? (
        <>
          {counts.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              {counts.map(({ action, count }) => (
                <span key={action} className="flex items-center gap-1.5">
                  <ActionBadge action={action} />
                  {count} เรื่อง
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-3 border-l-2 border-dashed border-emerald-700" />
              เกิน {HIGH_OCCUPANCY * 100}% = เต็ม
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-3 border-l-2 border-dashed border-red-700" />
              ต่ำกว่า {LOW_OCCUPANCY * 100}% = ว่าง
            </span>
            <span>
              รอบน้อย/เยอะ เทียบค่ากลาง {Number(medianShows.toFixed(1)).toLocaleString("th-TH")}{" "}
              รอบ/วัน
            </span>
          </div>

          <ul className="mt-1 divide-y text-sm">
            {sorted.map((row) => (
              <DemandRow key={row.movie_id} row={row} days={days} />
            ))}
          </ul>

          {tooFew.length ? (
            <p className="mt-2 text-xs text-muted-foreground">
              ฉายไม่ถึง {MIN_SHOWTIMES} รอบ ยังไม่แนะนำ: {tooFew.map((row) => row.title).join(", ")}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-muted-foreground">ยังไม่มีรอบที่ฉายแล้วในช่วงนี้</p>
      )}
    </section>
  );
}
