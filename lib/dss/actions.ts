"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/admin/actions";
import { SECTION_ACCESS } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { buildOptions, OPTION_LABEL } from "./inventory";
import { loadIngredientPlans, parseLookback, parseServiceLevel, planSettings } from "./queries";
import { parseDecision } from "./validation";

// คำนวณซ้ำที่ server จากข้อมูลในฐานข้อมูล บันทึกจึงไม่ขึ้นกับตัวเลขที่หน้าเว็บส่งมา
export async function approveReorder(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseDecision(formData);
  if (!parsed.ok) return { error: parsed.error };
  const input = parsed.data;

  await requireRole(SECTION_ACCESS.admin, "/admin/stock/planning");
  const supabase = await createClient();

  const lookback = parseLookback(String(formData.get("lookback")));
  const serviceLevel = parseServiceLevel(String(formData.get("service_level")));
  const loaded = await loadIngredientPlans(supabase, {
    lookback,
    serviceLevel,
    ingredientId: input.ingredientId,
  });
  const current = loaded?.plans[0];
  if (!current) return { error: "โหลดข้อมูลวัตถุดิบไม่สำเร็จ" };

  const plan = buildOptions({
    ...planSettings(current.ingredient),
    leadTimeDays: input.leadTimeDays,
    orderCost: input.orderCost,
    usage: current.history.slice(-lookback),
    onHand: current.ingredient.quantity_on_hand,
    serviceLevel,
    demandAdjustPct: input.demandAdjustPct,
  });
  if (!plan.recommended) return { error: "ยังคำนวณทางเลือกไม่ได้ กรุณาตั้งต้นทุนก่อน" };
  if (!plan.options.some((option) => option.key === input.option)) {
    return { error: "ทางเลือกนี้ใช้ไม่ได้กับค่าปัจจุบัน" };
  }

  const { error } = await supabase.from("reorder_decisions").insert({
    ingredient_id: input.ingredientId,
    recommended_option: plan.recommended.key,
    recommended_qty: plan.recommended.orderQty,
    approved_option: input.option,
    approved_qty: input.quantity,
    service_level: serviceLevel,
    demand_adjust_pct: input.demandAdjustPct,
    d: Math.round(plan.d * 100) / 100,
    sigma: Math.round(plan.sigma * 100) / 100,
    rop: Math.round(plan.reorderPoint * 100) / 100,
    on_hand: current.ingredient.quantity_on_hand,
    lead_time_days: input.leadTimeDays,
    order_cost: input.orderCost,
  });
  if (error) return { error: "บันทึกการตัดสินใจไม่สำเร็จ" };

  revalidatePath(`/admin/stock/planning/${input.ingredientId}`);
  return {
    notice: `อนุมัติทางเลือก ${input.option} (${OPTION_LABEL[input.option]}) สั่ง ${input.quantity.toLocaleString("th-TH")} ${current.ingredient.unit} แล้ว เมื่อของมาถึงให้รับเข้าที่หน้าสต็อก`,
  };
}
