import { describe, expect, it } from "vitest";
import { bangkokDate, formatTime, nextDate, toBangkokIso } from "./format";
import {
  MAX_SEATS_PER_ROW,
  MAX_THEATER_ROWS,
  parseIngredient,
  parseMovie,
  parseProduct,
  parseRecipeItem,
  parseSeatType,
  parseShowtime,
  parseStockChange,
  parseTheater,
  posterExtension,
} from "./validation";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("parseMovie", () => {
  const valid = { title: " หนัง ", duration_min: "120", status: "now_showing" };

  it("ตัดช่องว่างและแปลงค่าว่างเป็น null", () => {
    const result = parseMovie(form({ ...valid, release_date: "" }));
    expect(result).toMatchObject({
      ok: true,
      data: { title: "หนัง", duration_min: 120, release_date: null },
    });
  });

  it.each([
    [{ ...valid, title: "  " }],
    [{ ...valid, duration_min: "0" }],
    [{ ...valid, duration_min: "abc" }],
    [{ ...valid, status: "draft" }],
    [{ ...valid, release_date: "01/02/2026" }],
  ])("ปฏิเสธ %j", (values) => {
    expect(parseMovie(form(values)).ok).toBe(false);
  });
});

describe("posterExtension", () => {
  it("รับไฟล์ภาพที่อนุญาต", () => {
    expect(posterExtension({ type: "image/webp", size: 1000 })).toEqual({
      ok: true,
      data: "webp",
    });
  });

  it("ปฏิเสธชนิดไฟล์อื่นและไฟล์ใหญ่เกิน", () => {
    expect(posterExtension({ type: "image/svg+xml", size: 1 }).ok).toBe(false);
    expect(posterExtension({ type: "image/png", size: 900_001 }).ok).toBe(false);
  });
});

describe("parseSeatType", () => {
  it("รับราคาทศนิยมสองตำแหน่ง", () => {
    expect(parseSeatType(form({ name: "VIP", surcharge: "60.50" }))).toEqual({
      ok: true,
      data: { name: "VIP", surcharge: 60.5 },
    });
  });

  it("ปฏิเสธราคาติดลบ", () => {
    expect(parseSeatType(form({ name: "VIP", surcharge: "-1" })).ok).toBe(false);
  });
});

describe("parseProduct", () => {
  it("ปฏิเสธชื่อว่างและราคาผิด", () => {
    expect(parseProduct(form({ name: " ", price: "60" })).ok).toBe(false);
    expect(parseProduct(form({ name: "ป๊อปคอร์น", price: "abc" })).ok).toBe(false);
  });
});

describe("parseRecipeItem", () => {
  it("ปริมาณต้องมากกว่า 0", () => {
    const zero = { ingredient_id: "i", quantity: "0" };
    expect(parseRecipeItem(form(zero)).ok).toBe(false);
  });
});

describe("parseIngredient", () => {
  it("ต้องมีหน่วย", () => {
    const missing = { name: "เนย", unit: "", reorder_level: "10" };
    expect(parseIngredient(form(missing)).ok).toBe(false);
  });
});

describe("parseStockChange", () => {
  const purchase = { ingredient_id: "i", change: "100", reason: "purchase" };

  it("รับเข้าสต็อกเป็นจำนวนบวก", () => {
    expect(parseStockChange(form(purchase))).toEqual({
      ok: true,
      data: { ingredient_id: "i", change: 100, reason: "purchase" },
    });
  });

  it("การปรับยอดใช้จำนวนลบได้", () => {
    const adjustment = { ...purchase, change: "-5", reason: "adjustment" };
    expect(parseStockChange(form(adjustment)).ok).toBe(true);
  });

  it.each([
    [{ ...purchase, change: "-5" }],
    [{ ...purchase, change: "0" }],
    [{ ...purchase, change: "abc" }],
    [{ ...purchase, reason: "sale" }],
  ])("ปฏิเสธ %j", (values) => {
    expect(parseStockChange(form(values)).ok).toBe(false);
  });
});

describe("parseTheater", () => {
  it("จำกัดผังที่นั่งไม่เกิน 1,000 ที่นั่ง", () => {
    expect(MAX_THEATER_ROWS * MAX_SEATS_PER_ROW).toBeLessThanOrEqual(1000);
  });

  it.each([
    ["0", "10"],
    ["27", "10"],
    ["5", "31"],
  ])("ปฏิเสธ %s แถว แถวละ %s ที่นั่ง", (rows, seats) => {
    const values = { name: "โรง 1", rows, seats_per_row: seats };
    expect(parseTheater(form(values)).ok).toBe(false);
  });
});

describe("parseShowtime", () => {
  const now = new Date("2026-11-01T05:00:00Z");
  const valid = {
    movie_id: "m",
    theater_id: "t",
    date: "2026-11-01",
    time: "19:30",
    base_price: "180",
  };

  it("แปลงเวลาไทยเป็น UTC", () => {
    expect(parseShowtime(form(valid), now)).toMatchObject({
      ok: true,
      data: { starts_at: "2026-11-01T12:30:00.000Z" },
    });
  });

  it("ปฏิเสธเวลาที่ผ่านไปแล้ว", () => {
    const past = { ...valid, time: "11:59" };
    expect(parseShowtime(form(past), now).ok).toBe(false);
  });

  it("ปฏิเสธวันที่ที่ไม่มีจริง", () => {
    const invalid = { ...valid, date: "2026-13-40" };
    expect(parseShowtime(form(invalid), now).ok).toBe(false);
  });
});

describe("เวลาไทย", () => {
  it("คำนวณวันตามเวลาไทย ไม่ใช่ UTC", () => {
    expect(bangkokDate(new Date("2026-11-01T18:00:00Z"))).toBe("2026-11-02");
  });

  it("ขึ้นวันถัดไปข้ามเดือนได้", () => {
    expect(nextDate("2026-11-30")).toBe("2026-12-01");
  });

  it("แสดงเวลาแบบ 24 ชั่วโมง", () => {
    expect(formatTime(toBangkokIso("2026-11-01", "19:05"))).toBe("19:05");
  });
});
