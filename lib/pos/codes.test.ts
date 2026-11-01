import { describe, expect, it } from "vitest";
import { normalizeOrderNo } from "./codes";

describe("normalizeOrderNo", () => {
  it("รับหมายเลขคำสั่งซื้อทั้งตัวเล็กและตัวใหญ่", () => {
    expect(normalizeOrderNo(" wj-000008 ")).toBe("WJ-000008");
  });

  it("ไม่แปลงรหัสใน QR เป็นหมายเลขคำสั่งซื้อ", () => {
    expect(normalizeOrderNo("a3f09c1b7d")).toBeNull();
    expect(normalizeOrderNo("WJ-12")).toBeNull();
  });
});
