// แนะนำการปรับจำนวนรอบฉายจากอัตราเข้าชมและจำนวนรอบต่อวัน

export const HIGH_OCCUPANCY = 0.75;
export const LOW_OCCUPANCY = 0.3;
export const DEMAND_PRESETS = [7, 14, 30] as const;
// รอบน้อยกว่านี้ อัตราเข้าชมยังบอกอะไรไม่ได้
export const MIN_SHOWTIMES = 3;

export type MovieDemand = {
  movie_id: string;
  title: string;
  showtimes: number;
  shows_per_day: number;
  tickets: number;
  seats: number;
  occupancy: number | null;
  sold_out_share: number | null;
  previous_occupancy: number | null;
};

export type ShowtimeAction = "add" | "keep" | "reduce" | "watch" | "normal";

export const ACTION_LABEL: Record<ShowtimeAction, string> = {
  add: "เพิ่มรอบ",
  keep: "รักษาไว้",
  reduce: "ลดรอบ",
  watch: "เฝ้าดู",
  normal: "ปกติ",
};

export type ShowtimeAdvice = MovieDemand & {
  action: ShowtimeAction;
  trend: number | null;
  reason: string;
};

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function perDay(value: number): string {
  return `${Number(value.toFixed(1)).toLocaleString("th-TH")} รอบ/วัน`;
}

// มุมบนซ้าย = เพิ่มรอบ, บนขวา = รักษาไว้, ล่างขวา = ลดรอบ, ล่างซ้าย = เฝ้าดู
export function adviseShowtimes(rows: MovieDemand[]): {
  medianShows: number;
  advice: ShowtimeAdvice[];
  // หนังที่ฉายน้อยกว่า MIN_SHOWTIMES รอบ ไม่นำมาแนะนำ
  tooFew: MovieDemand[];
} {
  const enough = rows.filter((row) => row.showtimes >= MIN_SHOWTIMES);
  const tooFew = rows.filter((row) => row.showtimes < MIN_SHOWTIMES);
  const medianShows = median(enough.map((row) => row.shows_per_day));

  const advice = enough.map((row) => {
    const occupancy = row.occupancy ?? 0;
    const fewShows = row.shows_per_day < medianShows;
    const trend =
      row.occupancy !== null && row.previous_occupancy !== null
        ? row.occupancy - row.previous_occupancy
        : null;
    const soldOut = row.sold_out_share ?? 0;

    let action: ShowtimeAction = "normal";
    if (occupancy >= HIGH_OCCUPANCY) action = fewShows ? "add" : "keep";
    else if (occupancy < LOW_OCCUPANCY) action = fewShows ? "watch" : "reduce";

    const shows = perDay(row.shows_per_day);
    const reason = {
      add: `มีแค่ ${shows} แต่คนดู ${percent(occupancy)} และขายหมด ${percent(soldOut)} ของรอบ`,
      keep: `มี ${shows} และยังคนดู ${percent(occupancy)}`,
      reduce: `มี ${shows} แต่คนดูแค่ ${percent(occupancy)}`,
      watch: `รอบน้อย (${shows}) และคนดูน้อย (${percent(occupancy)}) รอดูก่อน`,
      normal: `มี ${shows} คนดู ${percent(occupancy)}`,
    }[action];

    return { ...row, action, trend, reason };
  });

  return { medianShows, advice, tooFew };
}
