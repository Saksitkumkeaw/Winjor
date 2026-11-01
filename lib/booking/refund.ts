import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCharge, refundCharge } from "./omise";

// ตรวจเงื่อนไขก่อนคืนเงินที่ Omise เพราะการคืนเงินย้อนกลับไม่ได้
export async function refundPaidOrder(
  orderId: string,
  reason: string,
  manualConfirmed = false,
): Promise<string | null> {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "status, payments(provider_charge_id, amount, status, needs_refund), tickets(status, showtimes(starts_at, status))",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.status !== "paid") return "คำสั่งซื้อนี้คืนเงินไม่ได้";
  if (order.tickets.some((ticket) => ticket.status === "used")) {
    return "มีตั๋วที่ใช้แล้ว จึงคืนเงินไม่ได้";
  }
  if (
    order.tickets.some(
      (ticket) =>
        ticket.showtimes.status === "scheduled" &&
        new Date(ticket.showtimes.starts_at) <= new Date(),
    )
  ) {
    return "รอบฉายเริ่มแล้ว จึงคืนเงินไม่ได้";
  }

  const payments = order.payments.filter(
    (payment) => payment.status === "succeeded" && !payment.needs_refund,
  );

  try {
    const charges = await Promise.all(
      payments.map(async (payment) => ({
        payment,
        charge: payment.provider_charge_id
          ? await getCharge(payment.provider_charge_id)
          : null,
      })),
    );

    const automatic = charges.filter(({ charge }) => charge?.refundable);
    if (automatic.length < charges.length && !manualConfirmed) {
      return "PromptPay และเงินสดต้องคืนเงินให้ลูกค้าเอง แล้วติ๊กยืนยันก่อนบันทึก";
    }

    for (const { charge, payment } of automatic) {
      if (charge) await refundCharge(charge.id, payment.amount);
    }

    const { error } = await supabase.rpc("complete_refund", {
      p_order_id: orderId,
      p_reason: reason,
      p_refund_method: automatic.length ? "omise" : "manual",
    });

    return error ? "คืนเงินแล้วแต่บันทึกไม่สำเร็จ กรุณาตรวจรายการ" : null;
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : "ไม่ทราบสาเหตุ";
    return `Omise ไม่รับการคืนเงิน: ${message}`;
  }
}
