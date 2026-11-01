import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPaidCharge } from "./charge";
import { getCharge, refundCharge } from "./omise";

// จุดเดียวที่เปลี่ยนสถานะการจ่ายเงิน โดยเชื่อข้อมูลจาก Omise API เท่านั้น
export async function syncCharge(chargeId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, order_id, amount, status")
    .eq("provider_charge_id", chargeId)
    .maybeSingle();
  if (!payment || payment.status !== "pending") return;

  const charge = await getCharge(chargeId);

  if (charge.status === "failed" || charge.status === "expired") {
    await admin
      .from("payments")
      .update({ status: "failed" })
      .eq("id", payment.id)
      .eq("status", "pending");
    return;
  }

  const expected = { orderId: payment.order_id, baht: payment.amount };
  if (!isPaidCharge(charge, expected)) return;

  // กัน webhook และการตรวจจากหน้าเว็บทำงานซ้ำพร้อมกัน
  const { data: claimed } = await admin
    .from("payments")
    .update({ status: "succeeded", paid_at: charge.paid_at })
    .eq("id", payment.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  const { data: result, error } = await admin.rpc("finalize_order", {
    p_order_id: payment.order_id,
  });
  if (error) throw new Error(`finalize_order ล้มเหลว: ${error.message}`);

  if (result === "paid") return;

  // จ่ายหลังหมดเวลาหรือจ่ายซ้ำ บัตรคืนอัตโนมัติ ส่วน PromptPay ต้องให้ผู้ดูแลระบบคืนเอง
  const refundReason =
    result === "already_paid" ? "ชำระเงินซ้ำ" : "ชำระเงินหลังหมดเวลา";

  if (!charge.refundable) {
    await admin
      .from("payments")
      .update({ needs_refund: true, refund_reason: refundReason })
      .eq("id", payment.id);
    return;
  }

  await refundCharge(chargeId, payment.amount);
  await admin
    .from("payments")
    .update({
      status: "refunded",
      refunded_at: new Date().toISOString(),
      refund_reason: refundReason,
      refund_method: "omise",
    })
    .eq("id", payment.id);
}
