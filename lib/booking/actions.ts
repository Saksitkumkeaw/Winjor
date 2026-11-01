"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createCharge, downloadQrCode, getCharge } from "./omise";
import { syncCharge } from "./payment";

export type BookingItem = {
  product_id: string;
  quantity: number;
};

const HOLD_ERRORS: Record<string, string> = {
  WJ001: "เลือกได้ 1-6 ที่นั่ง",
  WJ002: "รอบฉายนี้ปิดการขายแล้ว",
  WJ003: "มีที่นั่งที่จองไม่ได้ กรุณาเลือกใหม่",
  WJ004: "รายการสินค้าไม่ถูกต้อง",
  WJ005: "มีคนจองที่นั่งนี้ไปแล้ว กรุณาเลือกใหม่",
};

export async function holdSeats(
  showtimeId: string,
  seatIds: string[],
  items: BookingItem[],
): Promise<{ error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`/login?next=${encodeURIComponent(`/showtimes/${showtimeId}`)}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("hold_seats", {
    p_showtime_id: showtimeId,
    p_seat_ids: seatIds,
    p_items: items,
  });

  if (error) {
    return { error: HOLD_ERRORS[error.code] ?? "จองที่นั่งไม่สำเร็จ" };
  }

  redirect(`/checkout/${data}`);
}

export async function cancelOrder(orderId: string) {
  const supabase = await createClient();
  await supabase.rpc("cancel_order", { p_order_id: orderId });
  redirect("/");
}

// RLS ทำให้เห็นเฉพาะคำสั่งซื้อของตัวเอง จึงจ่ายแทนคนอื่นไม่ได้
async function payableOrder(orderId: string) {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_no, total, status, expires_at")
    .eq("id", orderId)
    .maybeSingle();

  if (
    !order ||
    order.status !== "pending" ||
    new Date(order.expires_at) <= new Date()
  ) {
    return null;
  }
  return order;
}

async function returnUri(orderId: string): Promise<string> {
  const origin = (await headers()).get("origin");
  return `${origin}/checkout/${orderId}`;
}

export type PaymentResult =
  | { error: string }
  | { redirectTo: string }
  | { qrCode: string };

export async function payWithCard(
  orderId: string,
  cardToken: string,
): Promise<PaymentResult> {
  const order = await payableOrder(orderId);
  if (!order) return { error: "คำสั่งซื้อนี้หมดเวลาแล้ว" };

  try {
    const charge = await createCharge({
      orderId: order.id,
      orderNo: order.order_no,
      baht: order.total,
      returnUri: await returnUri(order.id),
      card: cardToken,
    });

    await createAdminClient().from("payments").insert({
      order_id: order.id,
      method: "card",
      provider: "omise",
      provider_charge_id: charge.id,
      amount: order.total,
    });

    if (charge.status === "failed") {
      await syncCharge(charge.id);
      return { error: charge.failure_message ?? "บัตรถูกปฏิเสธ" };
    }
    if (charge.authorize_uri && charge.status === "pending") {
      return { redirectTo: charge.authorize_uri };
    }

    await syncCharge(charge.id);
    return { redirectTo: `/tickets` };
  } catch {
    return { error: "ชำระเงินไม่สำเร็จ กรุณาลองใหม่" };
  }
}

export async function payWithPromptPay(
  orderId: string,
): Promise<PaymentResult> {
  const order = await payableOrder(orderId);
  if (!order) return { error: "คำสั่งซื้อนี้หมดเวลาแล้ว" };

  try {
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("payments")
      .select("provider_charge_id")
      .eq("order_id", order.id)
      .eq("method", "promptpay")
      .eq("status", "pending")
      .maybeSingle();

    if (existing?.provider_charge_id) {
      const charge = await getCharge(existing.provider_charge_id);
      return { qrCode: await downloadQrCode(charge) };
    }

    const charge = await createCharge({
      orderId: order.id,
      orderNo: order.order_no,
      baht: order.total,
      returnUri: await returnUri(order.id),
      promptPayExpiresAt: order.expires_at,
    });

    await createAdminClient().from("payments").insert({
      order_id: order.id,
      method: "promptpay",
      provider: "omise",
      provider_charge_id: charge.id,
      amount: order.total,
    });

    return { qrCode: await downloadQrCode(charge) };
  } catch {
    return { error: "สร้าง QR ไม่สำเร็จ กรุณาลองใหม่" };
  }
}

export async function checkPayment(orderId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: payments } = await supabase
    .from("payments")
    .select("provider_charge_id")
    .eq("order_id", orderId)
    .eq("status", "pending");

  for (const payment of payments ?? []) {
    if (payment.provider_charge_id) {
      await syncCharge(payment.provider_charge_id);
    }
  }

  const { data: order } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();
  return order?.status ?? null;
}
