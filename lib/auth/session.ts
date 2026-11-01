import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME, type Role } from "./roles";

export type CurrentProfile = {
  id: string;
  fullName: string;
  role: Role;
};

export const getCurrentProfile = cache(
  async (): Promise<CurrentProfile | null> => {
    // Supabase อ่าน Date.now() เพื่อตรวจอายุ session จึงต้องหยุด prerender ก่อนถึงจุดนี้
    await connection();

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single();
    if (!data) return null;

    return { id: user.id, fullName: data.full_name, role: data.role as Role };
  },
);

export async function requireRole(
  allowed: readonly Role[],
  currentPath: string,
): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  }
  if (!allowed.includes(profile.role)) {
    redirect(ROLE_HOME[profile.role]);
  }

  return profile;
}
