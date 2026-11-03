import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { PlanStatus } from "@/lib/dss/inventory";
import { cn } from "@/lib/utils";

export function formatQty(value: number, unit?: string): string {
  const number = value.toLocaleString("th-TH", { maximumFractionDigits: value < 10 ? 1 : 0 });
  return unit ? `${number} ${unit}` : number;
}

export function formatPercent(value: number | null): string {
  return value === null ? "–" : `${Math.round(value * 100)}%`;
}

const STATUS: Record<PlanStatus, { label: string; className: string }> = {
  order: { label: "สั่งเลย", className: "bg-red-50 text-red-800 ring-red-600/30" },
  soon: { label: "ใกล้ถึงจุดสั่ง", className: "bg-amber-50 text-amber-900 ring-amber-600/30" },
  ok: { label: "ปกติ", className: "bg-emerald-50 text-emerald-800 ring-emerald-600/30" },
  idle: { label: "ไม่มีการใช้", className: "bg-muted text-muted-foreground ring-foreground/10" },
};

export function StatusBadge({ status }: { status: PlanStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1",
        STATUS[status].className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {STATUS[status].label}
    </span>
  );
}

export function Tile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "alert";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        tone === "alert" && "border-red-600 bg-red-50 text-red-950",
      )}
    >
      <div className={cn("text-sm", tone ? "text-red-900" : "text-muted-foreground")}>
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {note ? (
        <div className={cn("mt-1 text-xs", tone ? "text-red-900" : "text-muted-foreground")}>
          {note}
        </div>
      ) : null}
    </div>
  );
}

// ปุ่มเลือกค่าที่เก็บใน search params โดยคงค่าอื่นไว้
export function PresetLinks<T extends number>({
  label,
  name,
  values,
  current,
  params,
  suffix,
}: {
  label: string;
  name: string;
  values: readonly T[];
  current: T;
  params: Record<string, string>;
  suffix: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
      <span className="text-sm text-muted-foreground">{label}</span>
      {values.map((value) => (
        <Link
          key={value}
          href={`?${new URLSearchParams({ ...params, [name]: String(value) })}`}
          aria-current={current === value ? "page" : undefined}
          scroll={false}
          className={buttonVariants({
            variant: current === value ? "default" : "outline",
            size: "sm",
          })}
        >
          {value}
          {suffix}
        </Link>
      ))}
    </div>
  );
}
