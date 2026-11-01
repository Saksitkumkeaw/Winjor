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

  // จ่ายหลังหมดเวลา หรือจ่ายซ้ำด้วยอีกวิธีหนึ่ง จึงคืนเงินทันที
  if (result !== "paid") {
    await refundCharge(chargeId, payment.amount);
    await admin
      .from("payments")
      .update({
        status: "refunded",
        refunded_at: new Date().toISOString(),
        refund_reason:
          result === "already_paid" ? "ชำระเงินซ้ำ" : "ชำระเงินหลังหมดเวลา",
      })
      .eq("id", payment.id);
  }
}
