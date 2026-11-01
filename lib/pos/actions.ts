"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SECTION_ACCESS } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import type { BookingItem } from "@/lib/booking/actions";
import { createClient } from "@/lib/supabase/server";
import type { ScanResult } from "./scan-results";

export type CheckInResult = {
  result: ScanResult;
  title?: string;
  theater?: string;
  seat?: string;
  starts_at?: string;
  checked_in_at?: string | null;
};

export type PickupResult = {
  result: "ok" | "picked_up" | "not_found" | "no_items" | "unpaid";
  items?: { name: string; quantity: number }[];
  picked_up_at?: string;
};

const ORDER_ERRORS: Record<string, string> = {
  WJ001: "ต้องมีตั๋วหรือสินค้าอย่างน้อย 1 รายการ และเลือกได้ไม่เกิน 6 ที่นั่ง",
  WJ002: "รอบฉายนี้ปิดการขายแล้ว",
  WJ003: "มีที่นั่งที่ขายไม่ได้ กรุณาเลือกใหม่",
  WJ004: "รายการสินค้าไม่ถูกต้อง",
  WJ005: "มีคนจองที่นั่งนี้ไปแล้ว กรุณาเลือกใหม่",
};

async function staffClient() {
  await requireRole(SECTION_ACCESS.staff, "/staff");
  return createClient();
}

export async function posCreateOrder(
  showtimeId: string | null,
  seatIds: string[],
  items: BookingItem[],
): Promise<{ error: string }> {
  const supabase = await staffClient();
  const { data, error } = await supabase.rpc("pos_create_order", {
    p_showtime_id: showtimeId ?? undefined,
    p_seat_ids: seatIds,
    p_items: items,
  });

  if (error) {
    return { error: ORDER_ERRORS[error.code] ?? "สร้างรายการขายไม่สำเร็จ" };
  }

  redirect(`/staff/orders/${data}`);
}

export async function confirmCash(
  orderId: string,
): Promise<{ error?: string }> {
  const supabase = await staffClient();
  const { data, error } = await supabase.rpc("pos_confirm_cash", {
    p_order_id: orderId,
  });

  if (error || (data !== "paid" && data !== "already_paid")) {
    return { error: "รับเงินไม่สำเร็จ รายการนี้อาจหมดเวลาแล้ว" };
  }

  revalidatePath(`/staff/orders/${orderId}`);
  return {};
}

export async function posCancelOrder(orderId: string) {
  const supabase = await staffClient();
  await supabase.rpc("pos_cancel_order", { p_order_id: orderId });
  redirect("/staff");
}

export async function checkInTicket(token: string): Promise<CheckInResult> {
  const supabase = await staffClient();
  const { data, error } = await supabase.rpc("check_in_ticket", {
    p_qr_token: token.trim(),
  });

  if (error) return { result: "invalid" };
  return data as CheckInResult;
}

export type OrderTicket = {
  token: string;
  seat: string;
  used: boolean;
};

export type OrderTickets = {
  orderNo: string;
  title?: string;
  theater?: string;
  startsAt?: string;
  tickets: OrderTicket[];
};

export async function findOrderTickets(
  orderNo: string,
): Promise<OrderTickets | null> {
  const supabase = await staffClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "order_no, tickets(qr_token, status, seats(row_label, seat_number), showtimes(starts_at, movies(title), theaters(name)))",
    )
    .eq("order_no", orderNo)
    .eq("status", "paid")
    .maybeSingle();

  if (!order) return null;

  const showtime = order.tickets[0]?.showtimes;
  return {
    orderNo: order.order_no,
    title: showtime?.movies.title,
    theater: showtime?.theaters.name,
    startsAt: showtime?.starts_at,
    tickets: order.tickets.flatMap((ticket) =>
      ticket.qr_token
        ? [
            {
              token: ticket.qr_token,
              seat: `${ticket.seats.row_label}${ticket.seats.seat_number}`,
              used: ticket.status === "used",
            },
          ]
        : [],
    ),
  };
}

export async function pickupOrderItems(orderNo: string): Promise<PickupResult> {
  const supabase = await staffClient();
  const { data, error } = await supabase.rpc("pickup_order_items", {
    p_order_no: orderNo,
  });

  if (error) return { result: "not_found" };
  return data as PickupResult;
}
