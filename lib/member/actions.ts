"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/admin/actions";
import { ROLES, SECTION_ACCESS } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { parseMember, parseProfile } from "./validation";

const DUPLICATE_KEY = "23505";

const POINT_ERRORS: Record<string, string> = {
  WJ010: "คำสั่งซื้อนี้ใช้คะแนนไม่ได้",
  WJ011: "เริ่มชำระเงินแล้ว จึงเปลี่ยนคะแนนไม่ได้ ให้ยกเลิกแล้วจองใหม่",
  WJ012: "แลกได้ทีละ 100 คะแนน",
  WJ013: "ยอดหลังหักส่วนลดต้องไม่ต่ำกว่า 20 บาท",
  WJ014: "คะแนนไม่พอ",
};

export async function updateProfile(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseProfile(formData);
  if (!parsed.ok) return { error: parsed.error };

  const profile = await requireRole(ROLES, "/account");
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", profile.id);

  if (error) {
    return {
      error:
        error.code === DUPLICATE_KEY
          ? "เบอร์นี้มีผู้ใช้แล้ว"
          : "บันทึกข้อมูลไม่สำเร็จ",
    };
  }

  revalidatePath("/account");
  return { notice: "บันทึกแล้ว" };
}

export async function applyPoints(
  orderId: string,
  points: number,
): Promise<FormState> {
  await requireRole(ROLES, "/");
  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_points", {
    p_order_id: orderId,
    p_points: points,
  });

  if (error) return { error: POINT_ERRORS[error.code] ?? "ใช้คะแนนไม่สำเร็จ" };

  revalidatePath(`/checkout/${orderId}`);
  revalidatePath(`/staff/orders/${orderId}`);
  return {};
}

export async function attachMember(
  orderId: string,
  phone: string,
): Promise<FormState> {
  await requireRole(SECTION_ACCESS.staff, "/staff");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_attach_member", {
    p_order_id: orderId,
    p_phone: phone,
  });

  const result = (data as { result?: string } | null)?.result;
  if (error || result === "locked") {
    return { error: "ผูกสมาชิกกับรายการนี้ไม่ได้" };
  }
  if (result === "not_found") return { error: "ไม่พบสมาชิกเบอร์นี้" };

  revalidatePath(`/staff/orders/${orderId}`);
  return {};
}

export async function registerMember(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseMember(formData);
  if (!parsed.ok) return { error: parsed.error };

  await requireRole(SECTION_ACCESS.staff, "/staff/members");

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("phone", parsed.data.phone)
    .maybeSingle();
  if (existing) return { error: "เบอร์นี้เป็นสมาชิกแล้ว" };

  const { error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
    },
  });

  if (error) {
    return {
      error:
        error.code === "email_exists"
          ? "อีเมลนี้เป็นสมาชิกแล้ว"
          : "สมัครสมาชิกไม่สำเร็จ",
    };
  }

  return { notice: `สมัครสมาชิกให้ ${parsed.data.fullName} แล้ว` };
}

export async function clockIn(): Promise<FormState> {
  await requireRole(SECTION_ACCESS.staff, "/staff/attendance");
  const supabase = await createClient();
  const { error } = await supabase.rpc("clock_in");
  if (error) return { error: "ลงเวลาเข้างานไม่สำเร็จ" };

  revalidatePath("/staff/attendance");
  return {};
}

export async function clockOut(): Promise<FormState> {
  await requireRole(SECTION_ACCESS.staff, "/staff/attendance");
  const supabase = await createClient();
  const { error } = await supabase.rpc("clock_out");
  if (error) return { error: "ลงเวลาออกงานไม่สำเร็จ" };

  revalidatePath("/staff/attendance");
  return {};
}
