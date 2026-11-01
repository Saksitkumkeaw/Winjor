import type { MovieStatus } from "@/lib/supabase/database.types";

const TIME_ZONE = "Asia/Bangkok";

export const MOVIE_STATUS_LABEL: Record<MovieStatus, string> = {
  coming_soon: "เร็ว ๆ นี้",
  now_showing: "กำลังฉาย",
  ended: "จบแล้ว",
};

export function toBangkokIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+07:00`).toISOString();
}

export function bangkokDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function nextDate(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export function formatBaht(amount: number): string {
  return `${amount.toLocaleString("th-TH")} บาท`;
}
