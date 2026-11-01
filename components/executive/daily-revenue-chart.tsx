"use client";

import { useState } from "react";
import { formatBaht } from "@/lib/admin/format";
import { cn } from "@/lib/utils";

export type DailyPoint = {
  date: string;
  revenue: number;
  tickets: number;
};

const CHART_HEIGHT = 200;

function dayLabel(date: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T00:00:00+07:00`));
}

export function DailyRevenueChart({ points }: { points: DailyPoint[] }) {
  const [active, setActive] = useState<number>();

  const max = Math.max(...points.map((point) => point.revenue), 1);
  const labelStep = Math.max(1, Math.ceil(points.length / 7));
  const hovered = active === undefined ? undefined : points[active];

  return (
    <div>
      <div className="mb-2 min-h-10 text-sm" aria-live="polite">
        {hovered ? (
          <>
            <div className="font-medium">{dayLabel(hovered.date)}</div>
            <div className="text-muted-foreground">
              {formatBaht(hovered.revenue)} · {hovered.tickets} ตั๋ว
            </div>
          </>
        ) : (
          <div className="text-muted-foreground">
            ชี้ที่แท่งกราฟเพื่อดูรายละเอียด
          </div>
        )}
      </div>

      <div className="relative" style={{ height: CHART_HEIGHT }}>
        <div className="absolute inset-x-0 top-0 border-t border-dashed" />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed" />
        <span className="absolute top-0 right-0 bg-background pl-1 text-xs text-muted-foreground">
          {formatBaht(max)}
        </span>
        <div
          className="absolute inset-0 flex items-end gap-0.5 border-b"
          onMouseLeave={() => setActive(undefined)}
        >
          {points.map((point, index) => (
            <button
              key={point.date}
              type="button"
              aria-label={`${dayLabel(point.date)} ${formatBaht(point.revenue)} ${point.tickets} ตั๋ว`}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(undefined)}
              className="flex h-full min-w-0 flex-1 items-end outline-none"
            >
              <span
                className={cn(
                  "w-full rounded-t bg-sky-600",
                  active === index && "bg-sky-800",
                )}
                style={{
                  height: `${(point.revenue / max) * 100}%`,
                  minHeight: point.revenue > 0 ? 2 : 0,
                }}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-1 flex gap-0.5 text-xs text-muted-foreground">
        {points.map((point, index) => (
          <span key={point.date} className="min-w-0 flex-1 overflow-visible">
            {index % labelStep === 0 ? (
              <span className="whitespace-nowrap">{dayLabel(point.date)}</span>
            ) : null}
          </span>
        ))}
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          ดูเป็นตาราง
        </summary>
        <table className="mt-2 w-full">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="p-1 font-medium">วันที่</th>
              <th className="p-1 text-right font-medium">ยอดขาย</th>
              <th className="p-1 text-right font-medium">ตั๋ว</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.date} className="border-t">
                <td className="p-1">{dayLabel(point.date)}</td>
                <td className="p-1 text-right tabular-nums">
                  {formatBaht(point.revenue)}
                </td>
                <td className="p-1 text-right tabular-nums">{point.tickets}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
