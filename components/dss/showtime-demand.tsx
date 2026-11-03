import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  ACTION_LABEL,
  HIGH_OCCUPANCY,
  LOW_OCCUPANCY,
  type ShowtimeAction,
  type ShowtimeAdvice,
} from "@/lib/dss/showtimes";
import { cn } from "@/lib/utils";
import { formatPercent } from "./parts";

const WIDTH = 640;
const HEIGHT = 340;
const PAD = { left: 44, right: 16, top: 16, bottom: 40 };

const ACTION_STYLE: Record<ShowtimeAction, { dot: string; badge: string }> = {
  add: { dot: "fill-emerald-600", badge: "bg-emerald-50 text-emerald-800 ring-emerald-600/30" },
  keep: { dot: "fill-sky-600", badge: "bg-sky-50 text-sky-800 ring-sky-600/30" },
  reduce: { dot: "fill-red-600", badge: "bg-red-50 text-red-800 ring-red-600/30" },
  watch: { dot: "fill-amber-500", badge: "bg-amber-50 text-amber-900 ring-amber-600/30" },
  normal: { dot: "fill-slate-400", badge: "bg-muted text-muted-foreground ring-foreground/10" },
};

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

function QuadrantChart({ advice, medianShows }: { advice: ShowtimeAdvice[]; medianShows: number }) {
  const maxShows = Math.max(1, ...advice.map((row) => row.shows_per_day)) * 1.15;
  const maxTickets = Math.max(1, ...advice.map((row) => row.tickets));
  const x = (shows: number) => PAD.left + (shows / maxShows) * (WIDTH - PAD.left - PAD.right);
  const y = (occupancy: number) =>
    PAD.top + (1 - Math.min(occupancy, 1)) * (HEIGHT - PAD.top - PAD.bottom);
  const ticks = Array.from({ length: Math.floor(maxShows) + 1 }, (_, index) => index);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="กราฟ 4 ช่อง รอบต่อวันเทียบอัตราเข้าชม"
      className="h-auto w-full text-xs"
    >
      <rect
        x={PAD.left}
        y={y(1)}
        width={x(medianShows) - PAD.left}
        height={y(HIGH_OCCUPANCY) - y(1)}
        className="fill-emerald-500/10"
      />
      <rect
        x={x(medianShows)}
        y={y(LOW_OCCUPANCY)}
        width={WIDTH - PAD.right - x(medianShows)}
        height={y(0) - y(LOW_OCCUPANCY)}
        className="fill-red-500/10"
      />
      {[0, 0.25, 0.5, 0.75, 1].map((value) => (
        <g key={value}>
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(value)} y2={y(value)} className="stroke-border" />
          <text x={PAD.left - 6} y={y(value) + 4} textAnchor="end" className="fill-muted-foreground">
            {value * 100}%
          </text>
        </g>
      ))}
      {ticks.map((tick) => (
        <text key={tick} x={x(tick)} y={HEIGHT - PAD.bottom + 16} textAnchor="middle" className="fill-muted-foreground">
          {tick}
        </text>
      ))}
      <text x={(PAD.left + WIDTH - PAD.right) / 2} y={HEIGHT - 6} textAnchor="middle" className="fill-muted-foreground">
        รอบเฉลี่ยต่อวัน
      </text>
      {[HIGH_OCCUPANCY, LOW_OCCUPANCY].map((value) => (
        <line
          key={value}
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={y(value)}
          y2={y(value)}
          strokeDasharray="5 4"
          className="stroke-foreground/50"
        />
      ))}
      <line
        x1={x(medianShows)}
        x2={x(medianShows)}
        y1={y(1)}
        y2={y(0)}
        strokeDasharray="5 4"
        className="stroke-foreground/50"
      />
      <text x={PAD.left + 6} y={y(1) + 14} className="fill-emerald-800 font-semibold">
        เพิ่มรอบ
      </text>
      <text x={WIDTH - PAD.right - 6} y={y(1) + 14} textAnchor="end" className="fill-sky-800 font-semibold">
        รักษาไว้
      </text>
      <text x={WIDTH - PAD.right - 6} y={y(0) - 6} textAnchor="end" className="fill-red-800 font-semibold">
        ลดรอบ
      </text>
      <text x={PAD.left + 6} y={y(0) - 6} className="fill-amber-800 font-semibold">
        เฝ้าดู
      </text>
      {advice.map((row) => {
        const radius = 5 + Math.sqrt(row.tickets / maxTickets) * 18;
        const cx = x(row.shows_per_day);
        const cy = y(row.occupancy ?? 0);
        return (
          <g key={row.movie_id}>
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              className={cn(ACTION_STYLE[row.action].dot, "stroke-background")}
              fillOpacity={0.75}
              strokeWidth={1.5}
            >
              <title>
                {`${row.title}: ${row.shows_per_day} รอบ/วัน, เข้าชม ${formatPercent(row.occupancy)}, ${row.tickets} ตั๋ว`}
              </title>
            </circle>
            <text
              x={cx + radius + 4}
              y={cy + 4}
              className="fill-foreground"
              style={{ paintOrder: "stroke" }}
              stroke="var(--background)"
              strokeWidth={3}
            >
              {row.title}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function ShowtimeDemand({
  advice,
  medianShows,
  days,
  presets,
}: {
  advice: ShowtimeAdvice[];
  medianShows: number;
  days: number;
  presets: ReactNode;
}) {
  const sorted = [...advice].sort(
    (a, b) => PRIORITY[a.action] - PRIORITY[b.action] || (b.occupancy ?? 0) - (a.occupancy ?? 0),
  );

  return (
    <section aria-labelledby="demand-heading" className="mb-6 rounded-lg border p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="demand-heading" className="text-lg font-semibold">
            ควรเพิ่มรอบหนังเรื่องไหน
          </h2>
          <p className="text-sm text-muted-foreground">
            จากรอบที่ฉายแล้ว {days} วันล่าสุด เส้นแนวนอน {HIGH_OCCUPANCY * 100}% และ{" "}
            {LOW_OCCUPANCY * 100}% เส้นแนวตั้ง = ค่ากลาง {medianShows.toFixed(1)} รอบต่อวัน
            ขนาดวงกลม = จำนวนตั๋ว
          </p>
        </div>
        {presets}
      </div>

      {advice.length ? (
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <QuadrantChart advice={advice} medianShows={medianShows} />

          <ul className="flex flex-col gap-3 text-sm">
            {sorted.map((row) => (
              <li key={row.movie_id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">{row.title}</span>
                  <ActionBadge action={row.action} />
                </div>
                <div className="relative mt-1 h-2 rounded-sm bg-muted">
                  <div
                    className="h-full rounded-sm bg-sky-600"
                    style={{ width: `${Math.min(row.occupancy ?? 0, 1) * 100}%` }}
                  />
                  <div
                    aria-hidden
                    className="absolute -top-0.5 h-3 border-l-2 border-foreground/60"
                    style={{ left: `${HIGH_OCCUPANCY * 100}%` }}
                  />
                </div>
                <div className="mt-0.5 flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
                  <span>
                    เข้าชม {formatPercent(row.occupancy)} · ขายหมด {formatPercent(row.sold_out_share)}
                    ของรอบ
                  </span>
                  {row.trend !== null ? (
                    <span className={row.trend >= 0 ? "text-emerald-700" : "text-red-700"}>
                      {row.trend >= 0 ? "▲" : "▼"} {Math.abs(Math.round(row.trend * 100))} จุด เทียบ{" "}
                      {days} วันก่อน
                    </span>
                  ) : null}
                </div>
                {row.action !== "normal" ? (
                  <p className="mt-1 text-xs">{row.reason}</p>
                ) : null}
                {row.action === "add" ? (
                  <Link
                    href={`?movie=${row.movie_id}&demand=${days}#new-showtime`}
                    className={cn(buttonVariants({ size: "sm" }), "mt-1")}
                  >
                    สร้างรอบ
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground">ยังไม่มีรอบที่ฉายแล้วในช่วงนี้</p>
      )}
    </section>
  );
}
