import { describe, expect, it } from "vitest";
import { isPaidCharge, toSatang, type OmiseCharge } from "./charge";

const paidCharge: OmiseCharge = {
  id: "chrg_test",
  amount: 36000,
  currency: "THB",
  status: "successful",
  paid: true,
  paid_at: "2026-11-01T10:00:00Z",
  authorize_uri: null,
  failure_message: null,
  metadata: { order_id: "order-1" },
  source: null,
};
const expected = { orderId: "order-1", baht: 360 };

describe("toSatang", () => {
  it("ปัดเศษทศนิยมของเลขทศนิยมลอยตัว", () => {
    expect(toSatang(19.99)).toBe(1999);
    expect(toSatang(1.1)).toBe(110);
  });
});

describe("isPaidCharge", () => {
  it("รับ charge ที่จ่ายแล้วและข้อมูลตรงกัน", () => {
    expect(isPaidCharge(paidCharge, expected)).toBe(true);
  });

  it.each([
    ["ยังไม่จ่าย", { paid: false }],
    ["ล้มเหลว", { status: "failed" as const }],
    ["ยอดเงินไม่ตรง", { amount: 100 }],
    ["สกุลเงินไม่ตรง", { currency: "USD" }],
    ["คนละคำสั่งซื้อ", { metadata: { order_id: "order-2" } }],
  ])("ปฏิเสธเมื่อ%s", (_label, change) => {
    expect(isPaidCharge({ ...paidCharge, ...change }, expected)).toBe(false);
  });
});
