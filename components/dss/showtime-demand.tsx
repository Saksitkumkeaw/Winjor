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

const WIDTH = 640;
const HEIGHT = 360;
const PAD = { left: 52, right: 20, top: 20, bottom: 48 };
const LABEL_HEIGHT = 15;

const ACTION_STYLE: Record<ShowtimeAction, { dot: string; badge: string }> = {
  add: { dot: "fill-emerald-600", badge: "bg-emerald-50 text-emerald-800 ring-emerald-600/30" },
  keep: { dot: "fill-sky-600", badge: "bg-sky-50 text-sky-800 ring-sky-600/30" },
  reduce: { dot: "fill-red-600", badge: "bg-red-50 text-red-800 ring-red-600/30" },
  watch: { dot: "fill-amber-500", badge: "bg-amber-50 text-amber-900 ring-amber-600/30" },
  normal: { dot: "fill-slate-400", badge: "bg-muted text-muted-foreground ring-foreground/10" },
};

// เรื่องที่ต้องทำอะไรสักอย่างอยู่ด้านบน
const GROUPS: { action: ShowtimeAction; hint: string }[] = [
  { action: "add", hint: "รอบน้อยแต่คนเต็ม" },
  { action: "reduce", hint: "รอบเยอะแต่ที่นั่งว่าง" },
  { action: "watch", hint: "รอบน้อยและคนน้อย" },
];

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
  if (points === 0) return <span className="text-xs text-muted-foreground">เท่าเดิม</span>;
  return (
    <span className={cn("text-xs whitespace-nowrap", points > 0 ? "text-emerald-700" : "text-red-700")}>
      {points > 0 ? "▲" : "▼"} {Math.abs(points)} จุดจากช่วงก่อน
    </span>
  );
}

type Label = { id: string; text: string; x: number; y: number; anchor: "start" | "end"; width: number };

// วางชื่อข้างวงกลม พลิกไปซ้ายเมื่อชิดขอบขวา และดันลงเมื่อทับชื่ออื่น
function placeLabels(points: { id: string; text: string; cx: number; cy: number; r: number }[]): Label[] {
  const placed: Label[] = [];
  const sorted = [...points].sort((a, b) => a.cy - b.cy);
  for (const point of sorted) {
    const width = point.text.length * 6.6;
    const anchor = point.cx + point.r + 6 + width > WIDTH - PAD.right ? "end" : "start";
    const x = anchor === "start" ? point.cx + point.r + 6 : point.cx - point.r - 6;
    const left = anchor === "start" ? x : x - width;
    let y = point.cy + 4;
    for (const other of placed) {
      const otherLeft = other.anchor === "start" ? other.x : other.x - other.width;
      const overlaps = left < otherLeft + other.width && otherLeft < left + width;
      if (overlaps && Math.abs(y - other.y) < LABEL_HEIGHT) y = other.y + LABEL_HEIGHT;
    }
    placed.push({ id: point.id, text: point.text, x, y, anchor, width });
  }
  return placed;
}

function QuadrantChart({ advice, medianShows }: { advice: ShowtimeAdvice[]; medianShows: number }) {
  const maxShows = Math.max(1, ...advice.map((row) => row.shows_per_day)) * 1.15;
  const maxTickets = Math.max(1, ...advice.map((row) => row.tickets));
  const x = (shows: number) => PAD.left + (shows / maxShows) * (WIDTH - PAD.left - PAD.right);
  const y = (occupancy: number) =>
    PAD.top + (1 - Math.min(occupancy, 1)) * (HEIGHT - PAD.top - PAD.bottom);
  const ticks = Array.from({ length: Math.floor(maxShows) + 1 }, (_, index) => index);
  const points = advice.map((row) => ({
    row,
    id: row.movie_id,
    text: row.title,
    cx: x(row.shows_per_day),
    cy: y(row.occupancy ?? 0),
    r: 6 + Math.sqrt(row.tickets / maxTickets) * 14,
  }));
  const labels = placeLabels(points);
  const midX = x(medianShows);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="กราฟ 4 ช่อง รอบต่อวันเทียบอัตราเข้าชม"
        className="h-auto w-full text-[12px]"
      >
        <rect x={PAD.left} y={y(1)} width={midX - PAD.left} height={y(HIGH_OCCUPANCY) - y(1)} className="fill-emerald-500/10" />
        <rect
          x={midX}
          y={y(LOW_OCCUPANCY)}
          width={WIDTH - PAD.right - midX}
          height={y(0) - y(LOW_OCCUPANCY)}
          className="fill-red-500/10"
        />

        {[0, 0.25, 0.5, 0.75, 1].map((value) => (
          <g key={value}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(value)} y2={y(value)} className="stroke-border" />
            <text x={PAD.left - 8} y={y(value) + 4} textAnchor="end" className="fill-muted-foreground">
              {value * 100}%
            </text>
          </g>
        ))}
        {ticks.map((tick) => (
          <text key={tick} x={x(tick)} y={HEIGHT - PAD.bottom + 18} textAnchor="middle" className="fill-muted-foreground">
            {tick}
          </text>
        ))}
        <text x={(PAD.left + WIDTH - PAD.right) / 2} y={HEIGHT - 8} textAnchor="middle" className="fill-muted-foreground">
          รอบต่อวัน →
        </text>
        <text
          transform={`translate(14 ${(PAD.top + HEIGHT - PAD.bottom) / 2}) rotate(-90)`}
          textAnchor="middle"
          className="fill-muted-foreground"
        >
          คนดู (% ของที่นั่ง) →
        </text>

        {[HIGH_OCCUPANCY, LOW_OCCUPANCY].map((value) => (
          <line
            key={value}
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={y(value)}
            y2={y(value)}
            strokeDasharray="5 4"
            className="stroke-foreground/40"
          />
        ))}
        <line x1={midX} x2={midX} y1={y(1)} y2={y(0)} strokeDasharray="5 4" className="stroke-foreground/40" />

        <text x={PAD.left + 8} y={y(1) + 16} className="fill-emerald-800 text-[13px] font-semibold">
          ↑ เพิ่มรอบ
        </text>
        <text x={WIDTH - PAD.right - 8} y={y(1) + 16} textAnchor="end" className="fill-sky-800 text-[13px] font-semibold">
          รักษาไว้
        </text>
        <text x={WIDTH - PAD.right - 8} y={y(LOW_OCCUPANCY) + 16} textAnchor="end" className="fill-red-800 text-[13px] font-semibold">
          ↓ ลดรอบ
        </text>
        <text x={PAD.left + 8} y={y(LOW_OCCUPANCY) + 16} className="fill-amber-800 text-[13px] font-semibold">
          เฝ้าดู
        </text>

        {points.map((point) => (
          <circle
            key={point.id}
            cx={point.cx}
            cy={point.cy}
            r={point.r}
            className={cn(ACTION_STYLE[point.row.action].dot, "stroke-background")}
            fillOpacity={0.8}
            strokeWidth={2}
          >
            <title>
              {`${point.row.title}: ${point.row.shows_per_day} รอบ/วัน, คนดู ${formatPercent(point.row.occupancy)}, ${point.row.tickets} ตั๋ว`}
            </title>
          </circle>
        ))}
        {labels.map((label) => (
          <text
            key={label.id}
            x={label.x}
            y={label.y}
            textAnchor={label.anchor}
            className="fill-foreground font-medium"
            style={{ paintOrder: "stroke" }}
            stroke="var(--background)"
            strokeWidth={4}
          >
            {label.text}
          </text>
        ))}
      </svg>
      <figcaption className="mt-1 text-xs text-muted-foreground">
        เส้นประแนวนอน = คนดู {HIGH_OCCUPANCY * 100}% และ {LOW_OCCUPANCY * 100}% · เส้นประแนวตั้ง =
        ค่ากลาง {medianShows.toFixed(1)} รอบต่อวัน · วงใหญ่ = ขายตั๋วได้มาก
      </figcaption>
    </figure>
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
  const byOccupancy = (a: ShowtimeAdvice, b: ShowtimeAdvice) => (b.occupancy ?? 0) - (a.occupancy ?? 0);
  const fine = advice.filter((row) => row.action === "keep" || row.action === "normal").sort(byOccupancy);

  return (
    <section aria-labelledby="demand-heading" className="mb-6 rounded-lg border p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="demand-heading" className="text-lg font-semibold">
            ควรเพิ่มรอบหนังเรื่องไหน
          </h2>
          <p className="text-sm text-muted-foreground">จากรอบที่ฉายแล้ว {days} วันล่าสุด</p>
        </div>
        {presets}
      </div>

      {advice.length ? (
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <QuadrantChart advice={advice} medianShows={medianShows} />

          <div className="flex flex-col gap-4 text-sm">
            {GROUPS.map(({ action, hint }) => {
              const rows = advice.filter((row) => row.action === action).sort(byOccupancy);
              if (!rows.length) return null;
              return (
                <section key={action}>
                  <div className="mb-2 flex items-center gap-2">
                    <ActionBadge action={action} />
                    <span className="text-muted-foreground">
                      {rows.length} เรื่อง · {hint}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {rows.map((row) => (
                      <li key={row.movie_id} className="rounded-lg border p-2.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="min-w-0 truncate font-medium">{row.title}</span>
                          <Trend value={row.trend} />
                        </div>
                        <p className="mt-0.5 text-muted-foreground">{row.reason}</p>
                        {action === "add" ? (
                          <Link
                            href={`?movie=${row.movie_id}&demand=${days}#new-showtime`}
                            className={cn(buttonVariants({ size: "sm" }), "mt-2")}
                          >
                            สร้างรอบ
                          </Link>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}

            {fine.length ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">ไม่ต้องปรับ:</span>{" "}
                {fine.map((row) => `${row.title} (${formatPercent(row.occupancy)})`).join(", ")}
              </p>
            ) : null}
            {tooFew.length ? (
              <p className="text-xs text-muted-foreground">
                ฉายไม่ถึง {MIN_SHOWTIMES} รอบ ยังไม่แนะนำ: {tooFew.map((row) => row.title).join(", ")}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground">ยังไม่มีรอบที่ฉายแล้วในช่วงนี้</p>
      )}
    </section>
  );
}
