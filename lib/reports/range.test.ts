import { describe, expect, it } from "vitest";
import { parseRange } from "./range";

const today = "2026-11-01";

describe("parseRange", () => {
  it("ค่าเริ่มต้นคือ 7 วันล่าสุดรวมวันนี้", () => {
    expect(parseRange({}, today)).toEqual({
      from: "2026-10-26",
      to: today,
      days: 7,
    });
  });

  it("รับช่วงสำเร็จรูป", () => {
    expect(parseRange({ days: "30" }, today).from).toBe("2026-10-03");
  });

  it("ค่าที่ไม่รู้จักกลับไปใช้ค่าเริ่มต้น", () => {
    expect(parseRange({ days: "9999" }, today).days).toBe(7);
  });

  it("รับช่วงวันที่กำหนดเอง", () => {
    const range = { from: "2026-10-01", to: "2026-10-03" };
    expect(parseRange(range, today)).toEqual({ ...range, days: 3 });
  });

  it.each([
    [{ from: "2026-11-02", to: "2026-11-01" }],
    [{ from: "2020-01-01", to: "2026-11-01" }],
    [{ from: "2026-13-01", to: "2026-11-01" }],
  ])("ปฏิเสธช่วงผิด %j", (range) => {
    expect(parseRange(range, today).days).toBe(7);
  });
});
