import Link from "next/link";
import type { ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cancelShowtime } from "@/lib/admin/actions";
import { formatDate, formatTime } from "@/lib/admin/format";
import type { MovieShowtime } from "@/lib/dss/queries";
import {
  ACTION_LABEL,
  END_OCCUPANCY,
  HIGH_OCCUPANCY,
  LOW_OCCUPANCY,
  MIN_SHOWTIMES,
  type MovieDemand,
  type ShowtimeAction,
  type ShowtimeAdvice,
} from "@/lib/dss/showtimes";
import { cn } from "@/lib/utils";
import { EndMovieButton } from "./end-movie-button";
import { formatPercent } from "./parts";

const ACTION_STYLE: Record<ShowtimeAction, { bar: string; badge: string }> = {
  add: { bar: "bg-emerald-600", badge: "bg-emerald-50 text-emerald-800 ring-emerald-600/30" },
  end: { bar: "bg-red-900", badge: "bg-red-900 text-white ring-red-900" },
  keep: { bar: "bg-sky-600", badge: "bg-sky-50 text-sky-800 ring-sky-600/30" },
  reduce: { bar: "bg-red-600", badge: "bg-red-50 text-red-800 ring-red-600/30" },
  watch: { bar: "bg-amber-500", badge: "bg-amber-50 text-amber-900 ring-amber-600/30" },
  normal: { bar: "bg-slate-400", badge: "bg-muted text-muted-foreground ring-foreground/10" },
};

// เรื่องที่ต้องทำอะไรสักอย่างอยู่ด้านบน
const PRIORITY: Record<ShowtimeAction, number> = {
  add: 0,
  end: 1,
  reduce: 2,
  watch: 3,
  keep: 4,
  normal: 5,
};

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

// รอบที่ยังไม่ฉายของเรื่องที่เลือก เพิ่มหรือยกเลิกได้จากตรงนี้
function UpcomingShowtimes({
  row,
  showtimes,
  createHref,
}: {
  row: ShowtimeAdvice;
  showtimes: MovieShowtime[];
  createHref: string;
}) {
  return (
    <div className="mt-2 rounded-lg border bg-muted/30 p-3 sm:col-span-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">
          รอบที่จะถึงของ {row.title} {showtimes.length} รอบ
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={createHref} className={buttonVariants({ size: "sm" })}>
            เพิ่มรอบ
          </Link>
          <EndMovieButton movieId={row.movie_id} title={row.title} upcoming={showtimes.length} />
        </div>
      </div>
      {row.action === "end" ? (
        <p className="mb-2 text-xs text-red-800">
          แนะนำให้ออกโรง เมื่อกดปุ่ม ให้ออกโรง รอบที่ยังไม่มีคนจองจะถูกยกเลิกให้ทั้งหมด
        </p>
      ) : null}
      {row.action === "reduce" ? (
        <p className="mb-2 text-xs text-red-800">
          ควรยกเลิกรอบที่ยังขายได้น้อย รอบที่มีคนจองแล้วระบบจะคืนเงินให้อัตโนมัติ
        </p>
      ) : null}
      {showtimes.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-md">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-1.5 font-medium">วัน เวลา</th>
                <th className="p-1.5 font-medium">โรง</th>
                <th className="p-1.5 font-medium">ขายแล้ว</th>
                <th className="p-1.5 font-medium">
                  <span className="sr-only">จัดการ</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {showtimes.map((showtime) => {
                const share = showtime.capacity ? showtime.sold / showtime.capacity : 0;
                return (
                  <tr key={showtime.id} className="border-t">
                    <td className="p-1.5 whitespace-nowrap">
                      {formatDate(showtime.starts_at)} {formatTime(showtime.starts_at)}
                    </td>
                    <td className="p-1.5">{showtime.theater}</td>
                    <td className="p-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 rounded-sm bg-muted">
                          <div
                            className="h-full rounded-sm bg-sky-600"
                            style={{ width: `${Math.min(share, 1) * 100}%` }}
                          />
                        </div>
                        <span className="whitespace-nowrap tabular-nums">
                          {showtime.sold}/{showtime.capacity}
                        </span>
                      </div>
                    </td>
                    <td className="p-1.5 text-right">
                      <form action={cancelShowtime}>
                        <input type="hidden" name="id" value={showtime.id} />
                        <Button type="submit" variant="outline" size="sm">
                          {showtime.sold ? `ยกเลิก (คืนเงิน ${showtime.sold} ที่)` : "ยกเลิก"}
                        </Button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground">ยังไม่มีรอบที่จะถึง</p>
      )}
    </div>
  );
}

// แท่งยาว = คนดูมาก แท่งเลยเส้นเขียว = เต็ม ไม่ถึงเส้นแดง = ว่าง
function DemandRow({
  row,
  params,
  showtimes,
}: {
  row: ShowtimeAdvice;
  params: Record<string, string>;
  showtimes: MovieShowtime[] | null;
}) {
  const occupancy = Math.min(row.occupancy ?? 0, 1);
  const open = showtimes !== null;
  const toggleHref = `?${new URLSearchParams(
    open ? params : { ...params, movie: row.movie_id },
  )}`;
  const createHref = `?${new URLSearchParams({ ...params, movie: row.movie_id })}#new-showtime`;

  return (
    <li className="grid gap-x-4 gap-y-1 py-3 sm:grid-cols-[12rem_1fr]">
      <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-start sm:justify-start">
        <Link
          href={toggleHref}
          scroll={false}
          aria-expanded={open}
          className="min-w-0 truncate font-medium hover:underline"
        >
          {open ? "▾" : "▸"} {row.title}
        </Link>
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
          {row.action === "add" && !open ? (
            <Link href={createHref} className={buttonVariants({ size: "sm" })}>
              สร้างรอบ
            </Link>
          ) : null}
          {row.action === "end" && !open ? (
            <EndMovieButton movieId={row.movie_id} title={row.title} upcoming={null} />
          ) : null}
          {!open ? (
            <Link href={toggleHref} scroll={false} className="text-foreground underline">
              ดูรอบที่จะถึง
            </Link>
          ) : null}
        </div>
      </div>
      {open ? <UpcomingShowtimes row={row} showtimes={showtimes} createHref={createHref} /> : null}
    </li>
  );
}

export function ShowtimeDemand({
  advice,
  medianShows,
  tooFew,
  days,
  presets,
  params,
  selected,
  ended,
}: {
  advice: ShowtimeAdvice[];
  medianShows: number;
  tooFew: MovieDemand[];
  days: number;
  presets: ReactNode;
  // ค่าใน URL ที่ต้องคงไว้เมื่อกดเปิดหรือปิดรอบของหนัง
  params: Record<string, string>;
  selected?: { movieId: string; showtimes: MovieShowtime[] };
  // ชื่อหนังที่ออกโรงแล้ว ไม่นำมาแนะนำ
  ended: string[];
}) {
  const sorted = [...advice].sort(
    (a, b) => PRIORITY[a.action] - PRIORITY[b.action] || (b.occupancy ?? 0) - (a.occupancy ?? 0),
  );
  const counts = (["add", "end", "reduce", "watch"] as const)
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
            <span>ต่ำกว่า {END_OCCUPANCY * 100}% และไม่ดีขึ้น = ควรออกโรง</span>
            <span>
              รอบน้อย/เยอะ เทียบค่ากลาง {Number(medianShows.toFixed(1)).toLocaleString("th-TH")}{" "}
              รอบ/วัน
            </span>
          </div>

          <ul className="mt-1 divide-y text-sm">
            {sorted.map((row) => (
              <DemandRow
                key={row.movie_id}
                row={row}
                params={params}
                showtimes={selected?.movieId === row.movie_id ? selected.showtimes : null}
              />
            ))}
          </ul>

          {tooFew.length ? (
            <p className="mt-2 text-xs text-muted-foreground">
              ฉายไม่ถึง {MIN_SHOWTIMES} รอบ ยังไม่แนะนำ: {tooFew.map((row) => row.title).join(", ")}
            </p>
          ) : null}
          {ended.length ? (
            <p className="mt-1 text-xs text-muted-foreground">ออกโรงแล้ว: {ended.join(", ")}</p>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-muted-foreground">ยังไม่มีรอบที่ฉายแล้วในช่วงนี้</p>
      )}
    </section>
  );
}
