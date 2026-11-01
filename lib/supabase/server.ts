import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "./database.types";

export async function createClient() {
  // Supabase อ่าน Date.now() เพื่อตรวจอายุ session จึงต้องหยุด prerender ก่อนสร้าง client
  await connection();

  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component เขียน cookie ไม่ได้ ส่วนนี้ proxy.ts ต่ออายุ session ให้แล้ว
          }
        },
      },
    },
  );
}
