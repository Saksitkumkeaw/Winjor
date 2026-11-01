import type { Metadata } from "next";
import Link from "next/link";
import { AdminSection } from "@/components/admin/admin-section";
import { bangkokDate, toBangkokIso } from "@/lib/admin/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "หลังบ้าน" };

async function Overview() {
  const supabase = await createClient();
  const today = toBangkokIso(bangkokDate(new Date()), "00:00");

  const [movies, theaters, showtimes] = await Promise.all([
    supabase
      .from("movies")
      .select("id", { count: "exact", head: true })
      .eq("status", "now_showing"),
    supabase
      .from("theaters")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("showtimes")
      .select("id", { count: "exact", head: true })
      .eq("status", "scheduled")
      .gte("starts_at", today),
  ]);

  const stats = [
    { label: "หนังที่กำลังฉาย", value: movies.count, href: "/admin/movies" },
    { label: "รอบฉายที่จะถึง", value: showtimes.count, href: "/admin/showtimes" },
    { label: "โรงที่เปิดใช้", value: theaters.count, href: "/admin/theaters" },
  ];

  return (
    <>
      <h1 className="text-2xl font-semibold">ภาพรวม</h1>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-lg border p-4 hover:bg-muted"
          >
            <div className="text-sm text-muted-foreground">{stat.label}</div>
            <div className="mt-1 text-2xl font-semibold">{stat.value ?? 0}</div>
          </Link>
        ))}
      </div>
    </>
  );
}

export default function AdminPage() {
  return (
    <AdminSection path="/admin">
      <Overview />
    </AdminSection>
  );
}
