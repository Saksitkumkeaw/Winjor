import type { Metadata } from "next";
import Link from "next/link";
import { StaffSection } from "@/components/staff/staff-section";
import { buttonVariants } from "@/components/ui/button";
import {
  bangkokDate,
  formatTime,
  nextDate,
  toBangkokIso,
} from "@/lib/admin/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "POS หน้าร้าน" };

async function TodayShowtimes() {
  const supabase = await createClient();
  const now = new Date();

  const { data: showtimes } = await supabase
    .from("showtimes")
    .select("id, starts_at, movies(title), theaters(name)")
    .eq("status", "scheduled")
    .gt("starts_at", now.toISOString())
    .lt("starts_at", toBangkokIso(nextDate(bangkokDate(now)), "00:00"))
    .order("starts_at");

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">ขายตั๋ววันนี้</h1>
      {showtimes?.length ? (
        <ul className="divide-y rounded-lg border">
          {showtimes.map((showtime) => (
            <li
              key={showtime.id}
              className="flex items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {showtime.movies.title}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatTime(showtime.starts_at)} · {showtime.theaters.name}
                </div>
              </div>
              <Link
                href={`/staff/showtimes/${showtime.id}`}
                className={buttonVariants()}
              >
                ขาย
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">ไม่มีรอบฉายเหลือในวันนี้</p>
      )}
    </>
  );
}

export default function StaffPage() {
  return (
    <StaffSection path="/staff">
      <TodayShowtimes />
    </StaffSection>
  );
}
