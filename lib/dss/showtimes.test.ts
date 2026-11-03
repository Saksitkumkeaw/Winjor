import { describe, expect, it } from "vitest";
import { adviseShowtimes, median, type MovieDemand } from "./showtimes";

function movie(title: string, showsPerDay: number, occupancy: number): MovieDemand {
  return {
    movie_id: title,
    title,
    showtimes: showsPerDay * 7,
    shows_per_day: showsPerDay,
    tickets: 0,
    seats: 0,
    occupancy,
    sold_out_share: 0,
    previous_occupancy: occupancy - 0.1,
  };
}

describe("adviseShowtimes", () => {
  it("แบ่ง 4 มุมจากอัตราเข้าชมและค่ากลางของรอบต่อวัน", () => {
    const { medianShows, advice } = adviseShowtimes([
      movie("รอบน้อยแต่เต็ม", 1, 0.95),
      movie("รอบเยอะแต่ว่าง", 4, 0.15),
      movie("รอบเยอะและเต็ม", 3, 0.8),
      movie("รอบน้อยและว่าง", 1, 0.2),
      movie("ปกติ", 2, 0.5),
    ]);

    expect(medianShows).toBe(2);
    expect(advice.map((row) => row.action)).toEqual(["add", "reduce", "keep", "watch", "normal"]);
    expect(advice[0].trend).toBeCloseTo(0.1, 6);
  });

  it("ค่ากลางของจำนวนคู่", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});
