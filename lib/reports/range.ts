import { shiftDate } from "../admin/format";

export const RANGE_PRESETS = [7, 30, 90] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 367;

export type ReportRange = {
  from: string;
  to: string;
  days: number;
};

type RangeInput = {
  days?: string | string[];
  from?: string | string[];
  to?: string | string[];
};

function dayCount(from: string, to: string): number {
  const difference =
    new Date(`${to}T00:00:00Z`).getTime() -
    new Date(`${from}T00:00:00Z`).getTime();
  return Math.round(difference / 86_400_000) + 1;
}

function isDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    DATE_PATTERN.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
  );
}

export function parseRange(input: RangeInput, today: string): ReportRange {
  if (isDate(input.from) && isDate(input.to)) {
    const days = dayCount(input.from, input.to);
    if (days >= 1 && days <= MAX_DAYS) {
      return { from: input.from, to: input.to, days };
    }
  }

  const preset = RANGE_PRESETS.find((days) => String(days) === input.days);
  const days = preset ?? RANGE_PRESETS[0];
  return { from: shiftDate(today, 1 - days), to: today, days };
}
