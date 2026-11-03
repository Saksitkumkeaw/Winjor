// ตัวแบบสินค้าคงคลัง (EOQ, ROP, Safety Stock, Quantity Discount) ใช้ได้ทั้งฝั่ง server และหน้า What-if

export const SERVICE_LEVELS = [90, 95, 99] as const;
export type ServiceLevel = (typeof SERVICE_LEVELS)[number];

export const DAYS_PER_YEAR = 365;
// วิธีเดิม: สั่งเมื่อถึงจุดแจ้งเตือน ครั้งละ 7 วันของยอดใช้เฉลี่ย
export const LEGACY_ORDER_DAYS = 7;

const Z_TABLE: Record<ServiceLevel, number> = { 90: 1.282, 95: 1.645, 99: 2.326 };

export function zForServiceLevel(level: ServiceLevel): number {
  return Z_TABLE[level];
}

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// ส่วนเบี่ยงเบนมาตรฐานของตัวอย่าง (หารด้วย n - 1)
export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  const squares = values.reduce((sum, value) => sum + (value - average) ** 2, 0);
  return Math.sqrt(squares / (values.length - 1));
}

// D และ H ต้องใช้หน่วยเวลาเดียวกัน
export function eoq(orderCost: number, demand: number, holdingCost: number): number {
  if (demand <= 0) return 0;
  return Math.sqrt((2 * orderCost * demand) / holdingCost);
}

export function safetyStock(z: number, sigma: number, leadTimeDays: number): number {
  return z * sigma * Math.sqrt(leadTimeDays);
}

export function reorderPoint(dailyDemand: number, leadTimeDays: number, safety: number): number {
  return dailyDemand * leadTimeDays + safety;
}

export type CostBreakdown = {
  purchase: number;
  ordering: number;
  holding: number;
  safety: number;
  relevant: number;
  total: number;
};

export function annualCost({
  annualDemand,
  unitCost,
  orderQty,
  holdingCost,
  orderCost,
  safety = 0,
}: {
  annualDemand: number;
  unitCost: number;
  orderQty: number;
  holdingCost: number;
  orderCost: number;
  safety?: number;
}): CostBreakdown {
  const purchase = annualDemand * unitCost;
  const ordering = orderQty > 0 ? (orderCost * annualDemand) / orderQty : 0;
  const holding = (orderQty / 2) * holdingCost;
  const safetyHolding = Math.max(safety, 0) * holdingCost;
  const relevant = ordering + holding + safetyHolding;
  return {
    purchase,
    ordering,
    holding,
    safety: safetyHolding,
    relevant,
    total: purchase + relevant,
  };
}

export type PriceTier = { minQty: number; unitCost: number };

export type TierResult = PriceTier & { orderQty: number; cost: CostBreakdown };

// บท 7.9: หา EOQ ของแต่ละราคา ถ้าต่ำกว่าขั้นต่ำให้ใช้ขั้นต่ำ แล้วเลือกต้นทุนรวมต่ำสุด
export function evaluatePriceTiers({
  tiers,
  annualDemand,
  orderCost,
  holdingRate,
  safety = 0,
}: {
  tiers: PriceTier[];
  annualDemand: number;
  orderCost: number;
  holdingRate: number;
  safety?: number;
}): { options: TierResult[]; best: TierResult } {
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  const options = sorted.map((tier) => {
    const holdingCost = tier.unitCost * holdingRate;
    const orderQty = Math.max(eoq(orderCost, annualDemand, holdingCost), tier.minQty);
    return {
      ...tier,
      orderQty,
      cost: annualCost({
        annualDemand,
        unitCost: tier.unitCost,
        orderQty,
        holdingCost,
        orderCost,
        safety,
      }),
    };
  });
  const best = options.reduce((cheapest, option) =>
    option.cost.total < cheapest.cost.total ? option : cheapest,
  );
  return { options, best };
}

// ฟังก์ชันการแจกแจงสะสมของการแจกแจงปกติมาตรฐาน (Abramowitz & Stegun 7.1.26)
export function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + 0.3275911 * (Math.abs(x) / Math.SQRT2));
  const poly =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-((x / Math.SQRT2) ** 2));
  return 0.5 * (1 + sign * erf);
}

export type OptionKey = "A" | "B" | "C";

export const OPTION_LABEL: Record<OptionKey, string> = {
  A: "วิธีเดิม",
  B: "EOQ + ROP",
  C: "ส่วนลดตามปริมาณ",
};

export type ReorderOption = {
  key: OptionKey;
  orderQty: number;
  reorderPoint: number;
  safetyStock: number;
  unitCost: number;
  // โอกาสที่ของไม่ขาดในแต่ละรอบสั่ง
  serviceProbability: number;
  daysCovered: number;
  cost: CostBreakdown;
  meetsTarget: boolean;
};

export type PlanInput = {
  usage: number[];
  onHand: number;
  reorderLevel: number;
  unitCost: number;
  orderCost: number;
  holdingRate: number;
  leadTimeDays: number;
  discountMinQty: number | null;
  discountPct: number | null;
  serviceLevel: ServiceLevel;
  demandAdjustPct: number;
};

export type PlanStatus = "order" | "soon" | "ok" | "idle";

export type Plan = {
  d: number;
  sigma: number;
  annualDemand: number;
  holdingCost: number;
  z: number;
  safetyStock: number;
  reorderPoint: number;
  eoq: number;
  daysLeft: number | null;
  status: PlanStatus;
  // ต้นทุนยังไม่ครบ จึงคำนวณ EOQ ไม่ได้
  missingCost: boolean;
  options: ReorderOption[];
  recommended: ReorderOption | null;
};

function legacyServiceProbability(reorderLevel: number, d: number, sigma: number, leadTime: number): number {
  const leadDemand = d * leadTime;
  const spread = sigma * Math.sqrt(leadTime);
  if (spread === 0) return reorderLevel >= leadDemand ? 1 : 0;
  return normalCdf((reorderLevel - leadDemand) / spread);
}

export function buildOptions(input: PlanInput): Plan {
  const factor = 1 + input.demandAdjustPct / 100;
  const d = mean(input.usage) * factor;
  const sigma = stdDev(input.usage) * factor;
  const leadTime = input.leadTimeDays;
  const annualDemand = d * DAYS_PER_YEAR;
  const holdingCost = input.unitCost * input.holdingRate;
  const z = zForServiceLevel(input.serviceLevel);
  const target = input.serviceLevel / 100;
  const safety = safetyStock(z, sigma, leadTime);
  const rop = reorderPoint(d, leadTime, safety);
  const missingCost = holdingCost <= 0;
  const economic = missingCost ? 0 : eoq(input.orderCost, annualDemand, holdingCost);
  const daysLeft = d > 0 ? input.onHand / d : null;

  let status: PlanStatus = "ok";
  if (d <= 0) status = "idle";
  else if (input.onHand <= rop) status = "order";
  else if (input.onHand <= rop + d * 2) status = "soon";

  const option = (
    key: OptionKey,
    orderQty: number,
    reorder: number,
    unitCost: number,
    serviceProbability: number,
  ): ReorderOption => {
    const optionSafety = reorder - d * leadTime;
    return {
      key,
      orderQty,
      reorderPoint: reorder,
      safetyStock: optionSafety,
      unitCost,
      serviceProbability,
      daysCovered: d > 0 ? orderQty / d : 0,
      cost: annualCost({
        annualDemand,
        unitCost,
        orderQty,
        holdingCost: unitCost * input.holdingRate,
        orderCost: input.orderCost,
        safety: optionSafety,
      }),
      meetsTarget: serviceProbability >= target - 0.005,
    };
  };

  const options: ReorderOption[] = [];
  if (d > 0) {
    options.push(
      option(
        "A",
        Math.ceil(d * LEGACY_ORDER_DAYS),
        input.reorderLevel,
        input.unitCost,
        legacyServiceProbability(input.reorderLevel, d, sigma, leadTime),
      ),
    );
    if (!missingCost) {
      options.push(option("B", Math.ceil(economic), rop, input.unitCost, target));

      if (input.discountMinQty && input.discountPct) {
        const discounted = input.unitCost * (1 - input.discountPct / 100);
        const { best } = evaluatePriceTiers({
          tiers: [
            { minQty: 0, unitCost: input.unitCost },
            { minQty: input.discountMinQty, unitCost: discounted },
          ],
          annualDemand,
          orderCost: input.orderCost,
          holdingRate: input.holdingRate,
          safety,
        });
        // ใส่ทางเลือก C เฉพาะเมื่อปริมาณที่ได้ส่วนลดคุ้มกว่า
        if (best.minQty > 0) {
          options.push(option("C", Math.ceil(best.orderQty), rop, discounted, target));
        }
      }
    }
  }

  const candidates = options.filter((item) => item.meetsTarget);
  const pool = candidates.length ? candidates : options;
  const recommended = pool.length
    ? pool.reduce((cheapest, item) => (item.cost.total < cheapest.cost.total ? item : cheapest))
    : null;

  return {
    d,
    sigma,
    annualDemand,
    holdingCost,
    z,
    safetyStock: safety,
    reorderPoint: rop,
    eoq: economic,
    daysLeft,
    status,
    missingCost,
    options,
    recommended,
  };
}

function quantity(value: number, unit: string): string {
  return `${Math.round(value).toLocaleString("th-TH")} ${unit}`;
}

// เหตุผลของคำแนะนำเป็นภาษาไทย
export function explain(plan: Plan, onHand: number, leadTimeDays: number, unit: string): string {
  if (plan.status === "idle") {
    return "ช่วงนี้ไม่มีการใช้วัตถุดิบนี้ จึงยังไม่ต้องสั่ง";
  }
  if (plan.missingCost || !plan.recommended) {
    return "ยังไม่ได้ตั้งต้นทุนต่อหน่วยหรืออัตราค่าเก็บรักษา จึงคำนวณ EOQ ไม่ได้";
  }

  const choice = plan.recommended;
  const formula = `ใช้ ${quantity(plan.d, unit)} ต่อวัน × รอ ${leadTimeDays} วัน + สำรอง ${quantity(plan.safetyStock, unit)}`;
  const label = `ทางเลือก ${choice.key} (${OPTION_LABEL[choice.key]})`;

  if (plan.status === "order") {
    return `แนะนำสั่ง ${quantity(choice.orderQty, unit)} ตาม${label} เพราะเหลือ ${quantity(onHand, unit)} ต่ำกว่าจุดสั่งซื้อ ${quantity(plan.reorderPoint, unit)} (${formula})`;
  }
  const until = Math.max(0, (onHand - plan.reorderPoint) / plan.d);
  return `ยังไม่ต้องสั่ง เหลือ ${quantity(onHand, unit)} สูงกว่าจุดสั่งซื้อ ${quantity(plan.reorderPoint, unit)} (${formula}) อีกราว ${until.toFixed(1)} วันจะถึงจุดสั่ง เมื่อถึงแล้วให้สั่ง ${quantity(choice.orderQty, unit)} ตาม${label}`;
}
