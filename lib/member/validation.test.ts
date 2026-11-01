import { describe, expect, it } from "vitest";
import {
  parseMember,
  parseProfile,
  parseShift,
  pointsToBaht,
  redeemOptions,
} from "./validation";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("redeemOptions", () => {
  it("จำกัดตามคะแนนที่มี", () => {
    expect(redeemOptions(250, 500)).toEqual([0, 100, 200]);
  });

  it("คงยอดจ่ายอย่างน้อย 20 บาท", () => {
    expect(redeemOptions(1000, 60)).toEqual([0, 100, 200]);
  });

  it("ไม่มีตัวเลือกเมื่อคะแนนไม่พอ", () => {
    expect(redeemOptions(99, 500)).toEqual([0]);
  });

  it("ยอดต่ำกว่าขั้นต่ำต้องไม่คำนวณติดลบ", () => {
    expect(redeemOptions(500, 10)).toEqual([0]);
  });
});

describe("pointsToBaht", () => {
  it("100 คะแนนเท่ากับ 20 บาท", () => {
    expect(pointsToBaht(300)).toBe(60);
  });
});

describe("parseProfile", () => {
  it("เบอร์ว่างบันทึกเป็น null", () => {
    expect(parseProfile(form({ full_name: "ก", phone: "" }))).toEqual({
      ok: true,
      data: { full_name: "ก", phone: null },
    });
  });

  it("ปฏิเสธเบอร์ผิดรูปแบบ", () => {
    expect(parseProfile(form({ full_name: "ก", phone: "12345" })).ok).toBe(false);
  });
});

describe("parseMember", () => {
  const valid = {
    full_name: "ก",
    phone: "0812345678",
    email: "a@example.test",
    password: "12345678",
  };

  it("รับข้อมูลที่ครบ", () => {
    expect(parseMember(form(valid)).ok).toBe(true);
  });

  it.each([
    [{ ...valid, phone: "" }],
    [{ ...valid, email: "abc" }],
    [{ ...valid, password: "short" }],
  ])("ปฏิเสธ %j", (values) => {
    expect(parseMember(form(values)).ok).toBe(false);
  });
});

describe("parseShift", () => {
  const valid = {
    staff_id: "s",
    date: "2026-11-02",
    start: "10:00",
    end: "18:00",
  };

  it("แปลงเวลาไทยเป็น UTC", () => {
    expect(parseShift(form(valid))).toMatchObject({
      ok: true,
      data: {
        starts_at: "2026-11-02T03:00:00.000Z",
        ends_at: "2026-11-02T11:00:00.000Z",
      },
    });
  });

  it("กะข้ามวันจบวันถัดไป", () => {
    const overnight = { ...valid, start: "22:00", end: "02:00" };
    expect(parseShift(form(overnight))).toMatchObject({
      ok: true,
      data: { ends_at: "2026-11-02T19:00:00.000Z" },
    });
  });

  it("ปฏิเสธเวลาเท่ากัน", () => {
    expect(parseShift(form({ ...valid, end: "10:00" })).ok).toBe(false);
  });
});
