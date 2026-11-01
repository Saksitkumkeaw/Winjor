import { toBangkokIso, nextDate } from "../admin/format";
import type { Parsed } from "../admin/validation";

const POINTS_PER_STEP = 100;
const BAHT_PER_STEP = 20;
const MIN_PAYABLE_BAHT = 20;
const MIN_PASSWORD_LENGTH = 8;

function text(form: FormData, field: string): string {
  const value = form.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

// ตัวเลือกการแลกคะแนน โดยคงยอดจ่ายขั้นต่ำของ Omise ไว้
export function redeemOptions(available: number, subtotal: number): number[] {
  const byBalance = Math.floor(available / POINTS_PER_STEP);
  const byTotal = Math.floor((subtotal - MIN_PAYABLE_BAHT) / BAHT_PER_STEP);
  const steps = Math.max(0, Math.min(byBalance, byTotal));
  return Array.from({ length: steps + 1 }, (_, step) => step * POINTS_PER_STEP);
}

export function pointsToBaht(points: number): number {
  return (points / POINTS_PER_STEP) * BAHT_PER_STEP;
}

export function parseProfile(
  form: FormData,
): Parsed<{ full_name: string; phone: string | null }> {
  const fullName = text(form, "full_name");
  const phone = text(form, "phone");

  if (!fullName) return fail("กรุณากรอกชื่อ");
  if (phone && !/^0\d{8,9}$/.test(phone)) {
    return fail("เบอร์โทรศัพท์ต้องเป็นตัวเลข 9-10 หลักที่ขึ้นต้นด้วย 0");
  }

  return { ok: true, data: { full_name: fullName, phone: phone || null } };
}

export function parseMember(form: FormData): Parsed<{
  fullName: string;
  phone: string;
  email: string;
  password: string;
}> {
  const profile = parseProfile(form);
  if (!profile.ok) return profile;

  const email = text(form, "email");
  const password = form.get("password");

  if (!profile.data.phone) return fail("กรุณากรอกเบอร์โทรศัพท์");
  if (!email.includes("@")) return fail("กรุณากรอกอีเมล");
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return fail(`รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
  }

  return {
    ok: true,
    data: {
      fullName: profile.data.full_name,
      phone: profile.data.phone,
      email,
      password,
    },
  };
}

export function parseShift(
  form: FormData,
): Parsed<{ staff_id: string; starts_at: string; ends_at: string }> {
  const staffId = text(form, "staff_id");
  const date = text(form, "date");
  const start = text(form, "start");
  const end = text(form, "end");

  if (!staffId) return fail("กรุณาเลือกพนักงาน");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^\d{2}:\d{2}$/.test(start) ||
    !/^\d{2}:\d{2}$/.test(end)
  ) {
    return fail("กรุณาเลือกวันและเวลา");
  }
  if (start === end) return fail("เวลาเริ่มและเวลาจบต้องไม่เท่ากัน");

  // เวลาจบน้อยกว่าเวลาเริ่มหมายถึงกะข้ามวัน
  const endDate = end < start ? nextDate(date) : date;

  return {
    ok: true,
    data: {
      staff_id: staffId,
      starts_at: toBangkokIso(date, start),
      ends_at: toBangkokIso(endDate, end),
    },
  };
}
