import type { Parsed } from "@/lib/admin/validation";
import type { OptionKey } from "./inventory";

export type DecisionInput = {
  ingredientId: string;
  option: OptionKey;
  quantity: number;
  demandAdjustPct: number;
  leadTimeDays: number;
  orderCost: number;
};

function text(form: FormData, field: string): string {
  const value = form.get(field);
  return typeof value === "string" ? value.trim() : "";
}

export function parseDecision(form: FormData): Parsed<DecisionInput> {
  const ingredientId = text(form, "ingredient_id");
  const option = text(form, "option");
  const quantity = Number(text(form, "quantity"));
  const demandAdjustPct = Number(text(form, "demand_adjust_pct"));
  const leadTimeDays = Number(text(form, "lead_time_days"));
  const orderCost = Number(text(form, "order_cost"));

  if (!ingredientId) return { ok: false, error: "ไม่พบวัตถุดิบ" };
  if (option !== "A" && option !== "B" && option !== "C") {
    return { ok: false, error: "กรุณาเลือกทางเลือก" };
  }
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10_000_000) {
    return { ok: false, error: "จำนวนที่อนุมัติต้องมากกว่า 0" };
  }
  if (!Number.isInteger(demandAdjustPct) || demandAdjustPct < -30 || demandAdjustPct > 60) {
    return { ok: false, error: "% ปรับคาดการณ์ต้องอยู่ระหว่าง -30 ถึง 60" };
  }
  if (!Number.isInteger(leadTimeDays) || leadTimeDays < 0 || leadTimeDays > 60) {
    return { ok: false, error: "เวลารอของต้องเป็น 0-60 วัน" };
  }
  if (!Number.isFinite(orderCost) || orderCost < 0) {
    return { ok: false, error: "ค่าสั่งต่อครั้งต้องเป็นตัวเลขตั้งแต่ 0" };
  }

  return {
    ok: true,
    data: {
      ingredientId,
      option,
      quantity: Math.round(quantity * 100) / 100,
      demandAdjustPct,
      leadTimeDays,
      orderCost,
    },
  };
}
