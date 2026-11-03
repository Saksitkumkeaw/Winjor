import { describe, expect, it } from "vitest";
import { adviseShowtimes, median, type MovieDemand } from "./showtimes";

function movie(title: string, showsPerDay: number, occupancy: number): MovieDemand {
  return {
    movie_id: title,
    title,
    showtimes: Math.round(showsPerDay * 7),
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

  it("ไม่แนะนำหนังที่ฉายน้อยกว่า 3 รอบ และไม่นำมาคิดค่ากลาง", () => {
    const { medianShows, advice, tooFew } = adviseShowtimes([
      movie("ฉายรอบเดียว", 0.1, 0),
      movie("เต็ม", 1, 0.9),
      movie("ว่าง", 3, 0.1),
    ]);
    expect(tooFew.map((row) => row.title)).toEqual(["ฉายรอบเดียว"]);
    expect(advice.map((row) => row.action)).toEqual(["add", "reduce"]);
    expect(medianShows).toBe(2);
  });

  it("แนะนำให้ออกโรงเมื่อคนดูต่ำกว่า 10% และไม่ดีขึ้น", () => {
    const fading = { ...movie("คนหาย", 4, 0.05), previous_occupancy: 0.07 };
    const fresh = { ...movie("เพิ่งเข้า", 4, 0.05), previous_occupancy: null };
    const recovering = { ...movie("กำลังดีขึ้น", 4, 0.08), previous_occupancy: 0.04 };
    const { advice } = adviseShowtimes([fading, fresh, recovering, movie("ปกติ", 2, 0.5)]);
    expect(advice.map((row) => row.action)).toEqual(["end", "reduce", "reduce", "normal"]);
  });

  it("ค่ากลางของจำนวนคู่", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});
