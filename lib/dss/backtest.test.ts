import { describe, expect, it } from "vitest";
import { meanAbsolutePercentError, runBacktest, simulate } from "./backtest";

const settings = {
  reorderLevel: 300,
  unitCost: 0.08,
  orderCost: 100,
  holdingRate: 0.25,
  leadTimeDays: 3,
  discountMinQty: null,
  discountPct: null,
  serviceLevel: 95 as const,
};

describe("simulate", () => {
  it("ยอดใช้คงที่ต้องไม่เกิดของขาด", () => {
    const result = simulate({
      usage: Array(30).fill(100),
      policy: { reorderPoint: 300, orderQty: 500 },
      leadTimeDays: 3,
      orderCost: 100,
      holdingCostPerYear: 0.02,
      startOnHand: 800,
    });
    expect(result.stockoutDays).toBe(0);
    expect(result.cycles).toBeGreaterThan(0);
    expect(result.serviceLevel).toBe(1);
    expect(result.inStockRate).toBe(1);
    expect(result.orderingCost).toBe(result.orders * 100);
  });

  it("จุดสั่งต่ำกว่ายอดใช้ระหว่างรอของต้องเกิดของขาด", () => {
    const result = simulate({
      usage: Array(30).fill(100),
      policy: { reorderPoint: 100, orderQty: 500 },
      leadTimeDays: 3,
      orderCost: 100,
      holdingCostPerYear: 0.02,
      startOnHand: 600,
    });
    expect(result.stockoutDays).toBeGreaterThan(0);
    expect(result.serviceLevel).toBe(0);
  });
});

describe("runBacktest", () => {
  it("ข้อมูลคงที่ไม่มีความผันผวน ทุกนโยบายต้องไม่ขาด", () => {
    const result = runBacktest(Array(90).fill(100), settings);
    expect(result?.policies.map((policy) => policy.key)).toEqual(["A", "B"]);
    for (const policy of result?.policies ?? []) {
      expect(policy.result.stockoutDays).toBe(0);
    }
    expect(result?.mape).toBe(0);
  });

  it("ข้อมูลไม่ถึง 90 วันทดสอบไม่ได้", () => {
    expect(runBacktest(Array(60).fill(100), settings)).toBeNull();
  });
});

describe("meanAbsolutePercentError", () => {
  it("ไม่นับวันที่ยอดจริงเป็น 0", () => {
    expect(meanAbsolutePercentError(100, [100, 200, 0, 50])).toBeCloseTo((0 + 0.5 + 1) / 3, 6);
    expect(meanAbsolutePercentError(100, [0, 0])).toBeNull();
  });
});
