import { describe, expect, it } from "vitest";
import {
  annualCost,
  buildOptions,
  eoq,
  evaluatePriceTiers,
  explain,
  mean,
  normalCdf,
  reorderPoint,
  safetyStock,
  stdDev,
  zForServiceLevel,
  type PlanInput,
} from "./inventory";

describe("สถิติพื้นฐาน", () => {
  it("ค่าเฉลี่ยและส่วนเบี่ยงเบนมาตรฐานของตัวอย่าง", () => {
    expect(mean([2, 4, 4, 4, 5, 5, 7, 9])).toBe(5);
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(stdDev([5])).toBe(0);
  });

  it("ค่า z ตามตาราง", () => {
    expect(zForServiceLevel(90)).toBe(1.282);
    expect(zForServiceLevel(95)).toBe(1.645);
    expect(zForServiceLevel(99)).toBe(2.326);
  });

  it("Φ ของการแจกแจงปกติ", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.645)).toBeCloseTo(0.95, 3);
    expect(normalCdf(-1.282)).toBeCloseTo(0.1, 3);
  });
});

describe("EOQ", () => {
  it("ตัวอย่างหลอดภาพ: ค่าสั่งเท่ากับค่าเก็บที่ Q*", () => {
    const holding = 400 * 0.05;
    const q = eoq(360, 10_000, holding);
    expect(q).toBeCloseTo(600, 6);

    const cost = annualCost({
      annualDemand: 10_000,
      unitCost: 400,
      orderQty: q,
      holdingCost: holding,
      orderCost: 360,
    });
    expect(cost.ordering).toBeCloseTo(6_000, 6);
    expect(cost.holding).toBeCloseTo(6_000, 6);
    expect(cost.relevant).toBeCloseTo(12_000, 6);
    expect(cost.total).toBeCloseTo(4_012_000, 6);
  });

  it("ตัวอย่างรายวัน: Q* = 500 และรอบสั่งทุก 5 วัน", () => {
    const q = eoq(500, 100, 0.4);
    expect(q).toBeCloseTo(500, 6);
    expect(q / 100).toBeCloseTo(5, 6);
  });

  it("ไม่มีการใช้ต้องได้ 0", () => {
    expect(eoq(500, 0, 0.4)).toBe(0);
  });
});

describe("Safety stock และ ROP", () => {
  it("ใช้ √L ไม่ใช่ L", () => {
    const ss = safetyStock(1.645, 10, 4);
    expect(ss).toBeCloseTo(32.9, 6);
    expect(reorderPoint(100, 4, ss)).toBeCloseTo(432.9, 6);
  });
});

describe("Quantity discount", () => {
  it("ตัวอย่างแบตเตอรี่: เลือก Q = 100 ที่ราคา 270", () => {
    const { options, best } = evaluatePriceTiers({
      tiers: [
        { minQty: 0, unitCost: 300 },
        { minQty: 100, unitCost: 270 },
        { minQty: 400, unitCost: 264 },
      ],
      annualDemand: 1_200,
      orderCost: 200,
      holdingRate: 0.25,
    });

    expect(options[0].orderQty).toBeCloseTo(80, 6);
    expect(options[0].cost.total).toBeCloseTo(366_000, 6);
    expect(options[1].orderQty).toBe(100);
    expect(options[1].cost.total).toBeCloseTo(329_775, 6);
    expect(options[2].orderQty).toBe(400);
    expect(options[2].cost.total).toBeCloseTo(330_600, 6);
    expect(best.unitCost).toBe(270);
  });
});

const base: PlanInput = {
  usage: [90, 110, 95, 105, 100, 120, 80],
  onHand: 1_000,
  reorderLevel: 300,
  unitCost: 0.08,
  orderCost: 100,
  holdingRate: 0.25,
  leadTimeDays: 3,
  discountMinQty: null,
  discountPct: null,
  serviceLevel: 95,
  demandAdjustPct: 0,
};

describe("buildOptions", () => {
  it("สร้างทางเลือก A และ B และแนะนำตัวที่ได้ระดับบริการตามเป้า", () => {
    const plan = buildOptions(base);
    expect(plan.d).toBeCloseTo(100, 6);
    expect(plan.options.map((option) => option.key)).toEqual(["A", "B"]);
    expect(plan.options[0].orderQty).toBe(700);
    expect(plan.options[1].orderQty).toBe(Math.ceil(eoq(100, 36_500, 0.02)));
    expect(plan.reorderPoint).toBeCloseTo(300 + 1.645 * plan.sigma * Math.sqrt(3), 6);
    expect(plan.recommended?.key).toBe("B");
  });

  it("วิธีเดิมที่ไม่มีของสำรองมีโอกาสไม่ขาดราวครึ่งเดียว", () => {
    const plan = buildOptions(base);
    expect(plan.options[0].serviceProbability).toBeCloseTo(0.5, 2);
    expect(plan.options[0].meetsTarget).toBe(false);
  });

  it("% ปรับคาดการณ์คูณทั้ง d และ σ", () => {
    const normal = buildOptions(base);
    const boosted = buildOptions({ ...base, demandAdjustPct: 40 });
    expect(boosted.d).toBeCloseTo(normal.d * 1.4, 6);
    expect(boosted.sigma).toBeCloseTo(normal.sigma * 1.4, 6);
  });

  it("แยกสถานะสั่งเลย ใกล้ถึง และปกติ", () => {
    const rop = buildOptions(base).reorderPoint;
    expect(buildOptions({ ...base, onHand: rop }).status).toBe("order");
    expect(buildOptions({ ...base, onHand: rop + 150 }).status).toBe("soon");
    expect(buildOptions({ ...base, onHand: rop + 250 }).status).toBe("ok");
    expect(buildOptions({ ...base, usage: [0, 0, 0] }).status).toBe("idle");
  });

  it("เพิ่มทางเลือก C เมื่อส่วนลดคุ้มกว่า", () => {
    const plan = buildOptions({ ...base, discountMinQty: 20_000, discountPct: 5 });
    const discount = plan.options.find((option) => option.key === "C");
    expect(discount?.orderQty).toBe(20_000);
    expect(discount?.unitCost).toBeCloseTo(0.076, 6);
    expect(plan.recommended?.key).toBe("C");
  });

  it("ไม่เสนอส่วนลดที่ต้องสั่งมากเกินคุ้ม", () => {
    const plan = buildOptions({ ...base, discountMinQty: 1_000_000, discountPct: 5 });
    expect(plan.options.some((option) => option.key === "C")).toBe(false);
  });

  it("ยังไม่ตั้งต้นทุนต้องไม่คำนวณ EOQ", () => {
    const plan = buildOptions({ ...base, unitCost: 0 });
    expect(plan.missingCost).toBe(true);
    expect(plan.options.map((option) => option.key)).toEqual(["A"]);
  });
});

describe("explain", () => {
  it("บอกจำนวนและที่มาของจุดสั่งซื้อ", () => {
    const plan = buildOptions({ ...base, onHand: 200 });
    const text = explain(plan, 200, 3, "กรัม");
    expect(text).toContain("แนะนำสั่ง");
    expect(text).toContain("ต่ำกว่าจุดสั่งซื้อ");
    expect(text).toContain("× รอ 3 วัน");
  });
});
