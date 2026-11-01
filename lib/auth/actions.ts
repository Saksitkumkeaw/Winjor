"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME, safeNextPath } from "./roles";

export type AuthState = {
  error?: string;
  notice?: string;
};

const MIN_PASSWORD_LENGTH = 8;

function text(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

export async function signIn(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = text(formData, "email");
  const password = formData.get("password");

  if (!email || typeof password !== "string" || !password) {
    return { error: "กรุณากรอกอีเมลและรหัสผ่าน" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      error:
        error.code === "email_not_confirmed"
          ? "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ"
          : "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();
  const home = ROLE_HOME[profile?.role ?? "customer"];

  redirect(safeNextPath(formData.get("next"), home));
}

export async function signUp(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const fullName = text(formData, "full_name");
  const phone = text(formData, "phone");
  const email = text(formData, "email");
  const password = formData.get("password");

  if (!fullName || !email || typeof password !== "string") {
    return { error: "กรุณากรอกชื่อ อีเมล และรหัสผ่าน" };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร` };
  }

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: { full_name: fullName, phone: phone || null },
    },
  });

  if (error) {
    return {
      error:
        error.code === "weak_password"
          ? "รหัสผ่านนี้คาดเดาง่ายเกินไป กรุณาตั้งใหม่"
          : "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    };
  }

  if (data.session) {
    redirect("/");
  }

  // ข้อความเดียวกันทั้งอีเมลใหม่และอีเมลที่มีอยู่แล้ว เพื่อไม่เปิดเผยว่าใครเป็นสมาชิก
  return { notice: "กรุณาตรวจอีเมลและกดลิงก์ยืนยันเพื่อเปิดใช้งานบัญชี" };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
