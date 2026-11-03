// ทดสอบย้อนหลัง: หา d และ σ จากช่วงแรก แล้วจำลองการสั่งซื้อด้วยยอดใช้จริงของช่วงหลัง

import { buildOptions, DAYS_PER_YEAR, mean, type OptionKey, type PlanInput } from "./inventory";

export const TRAIN_DAYS = 60;
export const TEST_DAYS = 30;

export type Policy = { reorderPoint: number; orderQty: number };

export type SimulationResult = {
  orders: number;
  // รอบสั่งที่ของมาถึงภายในช่วงทดสอบ
  cycles: number;
  cyclesWithoutStockout: number;
  serviceLevel: number | null;
  stockoutDays: number;
  // สัดส่วนวันที่มีของพอขาย ใช้ดูคู่กับ serviceLevel เมื่อรอบสั่งมีน้อย
  inStockRate: number;
  orderingCost: number;
  holdingCost: number;
  totalCost: number;
};

// สั่งตอนสิ้นวันเมื่อ inventory position ≤ ROP ของมาถึงตอนสิ้นวันที่ L จึงใช้ได้ตั้งแต่วันถัดไป
export function simulate({
  usage,
  policy,
  leadTimeDays,
  orderCost,
  holdingCostPerYear,
  startOnHand,
}: {
  usage: number[];
  policy: Policy;
  leadTimeDays: number;
  orderCost: number;
  holdingCostPerYear: number;
  startOnHand: number;
}): SimulationResult {
  let onHand = startOnHand;
  let holdingCost = 0;
  let stockoutDays = 0;
  const stockoutOnDay: boolean[] = [];
  const pending: { arrives: number; qty: number }[] = [];
  const placed: number[] = [];

  usage.forEach((demand, day) => {
    const short = demand > onHand;
    stockoutOnDay.push(short);
    if (short) stockoutDays += 1;
    onHand = Math.max(onHand - demand, 0);

    for (const order of pending.filter((item) => item.arrives === day)) {
      onHand += order.qty;
    }

    const onOrder = pending
      .filter((item) => item.arrives > day)
      .reduce((sum, item) => sum + item.qty, 0);
    if (policy.orderQty > 0 && onHand + onOrder <= policy.reorderPoint) {
      if (leadTimeDays === 0) onHand += policy.orderQty;
      else pending.push({ arrives: day + leadTimeDays, qty: policy.orderQty });
      placed.push(day);
    }

    holdingCost += (onHand * holdingCostPerYear) / DAYS_PER_YEAR;
  });

  const finished = placed.filter((day) => day + leadTimeDays < usage.length);
  const cyclesWithoutStockout = finished.filter(
    (day) => !stockoutOnDay.slice(day + 1, day + leadTimeDays + 1).some(Boolean),
  ).length;
  const orderingCost = placed.length * orderCost;

  return {
    orders: placed.length,
    cycles: finished.length,
    cyclesWithoutStockout,
    serviceLevel: finished.length ? cyclesWithoutStockout / finished.length : null,
    stockoutDays,
    inStockRate: usage.length ? 1 - stockoutDays / usage.length : 1,
    orderingCost,
    holdingCost,
    totalCost: orderingCost + holdingCost,
  };
}

// MAPE ของการใช้ค่าเฉลี่ยช่วงเทรนทำนายยอดรายวัน ไม่นับวันที่ยอดจริงเป็น 0
export function meanAbsolutePercentError(forecast: number, actual: number[]): number | null {
  const errors = actual
    .filter((value) => value > 0)
    .map((value) => Math.abs(value - forecast) / value);
  return errors.length ? mean(errors) : null;
}

export type BacktestResult = {
  trainMean: number;
  mape: number | null;
  policies: { key: OptionKey; policy: Policy; result: SimulationResult }[];
};

export function runBacktest(
  usage: number[],
  input: Omit<PlanInput, "usage" | "onHand" | "demandAdjustPct">,
): BacktestResult | null {
  if (usage.length < TRAIN_DAYS + TEST_DAYS) return null;
  const train = usage.slice(-(TRAIN_DAYS + TEST_DAYS), -TEST_DAYS);
  const test = usage.slice(-TEST_DAYS);

  const plan = buildOptions({ ...input, usage: train, onHand: 0, demandAdjustPct: 0 });
  const policies = plan.options.map((option) => {
    const policy = { reorderPoint: option.reorderPoint, orderQty: option.orderQty };
    return {
      key: option.key,
      policy,
      // เริ่มทุกนโยบายแบบเพิ่งรับของ เพื่อเทียบกันอย่างยุติธรรม
      result: simulate({
        usage: test,
        policy,
        leadTimeDays: input.leadTimeDays,
        orderCost: input.orderCost,
        holdingCostPerYear: option.unitCost * input.holdingRate,
        startOnHand: policy.reorderPoint + policy.orderQty,
      }),
    };
  });

  return {
    trainMean: plan.d,
    mape: meanAbsolutePercentError(plan.d, test),
    policies,
  };
}
