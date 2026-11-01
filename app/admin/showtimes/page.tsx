import type { Metadata } from "next";
import { AdminSection } from "@/components/admin/admin-section";
import { ShowtimeForm } from "@/components/admin/showtime-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cancelShowtime } from "@/lib/admin/actions";
import {
  bangkokDate,
  formatBaht,
  formatTime,
  nextDate,
  toBangkokIso,
} from "@/lib/admin/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "จัดการรอบฉาย" };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

async function Showtimes({
  searchParams,
}: Pick<PageProps<"/admin/showtimes">, "searchParams">) {
  const { date: requestedDate } = await searchParams;
  const date =
    typeof requestedDate === "string" && DATE_PATTERN.test(requestedDate)
      ? requestedDate
      : bangkokDate(new Date());

  const supabase = await createClient();
  const [{ data: showtimes }, { data: movies }, { data: theaters }] =
    await Promise.all([
      supabase
        .from("showtimes")
        .select(
          "id, starts_at, ends_at, base_price, movies(title), theaters(name)",
        )
        .neq("status", "cancelled")
        .gte("starts_at", toBangkokIso(date, "00:00"))
        .lt("starts_at", toBangkokIso(nextDate(date), "00:00"))
        .order("starts_at"),
      supabase
        .from("movies")
        .select("id, title")
        .neq("status", "ended")
        .order("title"),
      supabase
        .from("theaters")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
    ]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">รอบฉาย</h1>
        <form className="flex items-center gap-2">
          <Input
            key={date}
            type="date"
            name="date"
            aria-label="วันที่"
            defaultValue={date}
          />
          <Button type="submit" variant="outline">
            ดู
          </Button>
        </form>
      </div>

      <ShowtimeForm
        movies={movies ?? []}
        theaters={theaters ?? []}
        date={date}
      />

      {showtimes?.length ? (
        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-xl text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-2 font-medium">เวลา</th>
                <th className="p-2 font-medium">โรง</th>
                <th className="p-2 font-medium">หนัง</th>
                <th className="p-2 font-medium">ราคา</th>
                <th className="p-2 font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {showtimes.map((showtime) => (
                <tr key={showtime.id} className="border-t">
                  <td className="p-2">
                    {formatTime(showtime.starts_at)}–
                    {formatTime(showtime.ends_at)}
                  </td>
                  <td className="p-2">{showtime.theaters.name}</td>
                  <td className="p-2">{showtime.movies.title}</td>
                  <td className="p-2">{formatBaht(showtime.base_price)}</td>
                  <td className="p-2">
                    <form action={cancelShowtime}>
                      <input type="hidden" name="id" value={showtime.id} />
                      <Button type="submit" variant="outline" size="sm">
                        ยกเลิก
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-muted-foreground">ไม่มีรอบฉายในวันนี้</p>
      )}
      <p className="mt-2 text-sm text-muted-foreground">
        เวลาจบรวมเวลาทำความสะอาด 20 นาที
      </p>
    </>
  );
}

export default function ShowtimesPage({
  searchParams,
}: PageProps<"/admin/showtimes">) {
  return (
    <AdminSection path="/admin/showtimes">
      <Showtimes searchParams={searchParams} />
    </AdminSection>
  );
}
