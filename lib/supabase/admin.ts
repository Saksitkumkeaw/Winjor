import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// ข้าม RLS ทั้งหมด ใช้เฉพาะงานที่ยืนยันกับ Omise แล้ว ห้ามส่งออกไปฝั่งหน้าเว็บ
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY");

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secretKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
