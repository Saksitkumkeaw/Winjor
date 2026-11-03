import { describe, expect, it } from "vitest";
import { parseDecision } from "./validation";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

const valid = {
  ingredient_id: "i",
  option: "B",
  quantity: "1200",
  demand_adjust_pct: "40",
  lead_time_days: "3",
  order_cost: "100",
};

describe("parseDecision", () => {
  it("รับค่าที่ถูกต้อง", () => {
    expect(parseDecision(form(valid))).toEqual({
      ok: true,
      data: {
        ingredientId: "i",
        option: "B",
        quantity: 1200,
        demandAdjustPct: 40,
        leadTimeDays: 3,
        orderCost: 100,
      },
    });
  });

  it.each([
    ["ทางเลือกที่ไม่มี", { option: "D" }],
    ["จำนวน 0", { quantity: "0" }],
    ["% ปรับเกิน 60", { demand_adjust_pct: "61" }],
    ["เวลารอของติดลบ", { lead_time_days: "-1" }],
  ])("ไม่รับ%s", (_label, change) => {
    expect(parseDecision(form({ ...valid, ...change })).ok).toBe(false);
  });
});
