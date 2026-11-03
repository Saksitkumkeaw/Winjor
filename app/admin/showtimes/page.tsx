import type { Metadata } from "next";
import { AdminSection } from "@/components/admin/admin-section";
import { ShowtimeForm } from "@/components/admin/showtime-form";
import { PresetLinks } from "@/components/dss/parts";
import { ShowtimeDemand } from "@/components/dss/showtime-demand";
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
import {
  loadMovieShowtimes,
  loadShowtimeDemand,
  parseDemandDays,
} from "@/lib/dss/queries";
import { adviseShowtimes, DEMAND_PRESETS } from "@/lib/dss/showtimes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "จัดการรอบฉาย" };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

async function Showtimes({
  searchParams,
}: Pick<PageProps<"/admin/showtimes">, "searchParams">) {
  const { date: requestedDate, demand, movie } = await searchParams;
  const date =
    typeof requestedDate === "string" && DATE_PATTERN.test(requestedDate)
      ? requestedDate
      : bangkokDate(new Date());
  const demandDays = parseDemandDays(demand);

  const supabase = await createClient();
  const [{ data: showtimes }, { data: movies }, { data: theaters }, demandRows] =
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
      loadShowtimeDemand(supabase, demandDays),
    ]);
  const { advice, medianShows, tooFew } = adviseShowtimes(demandRows ?? []);
  const movieId =
    typeof movie === "string" && movies?.some((item) => item.id === movie)
      ? movie
      : undefined;
  const selectedShowtimes = movieId
    ? await loadMovieShowtimes(supabase, movieId)
    : null;
  const params = { date, demand: String(demandDays) };

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

      <ShowtimeDemand
        advice={advice}
        medianShows={medianShows}
        tooFew={tooFew}
        days={demandDays}
        params={params}
        selected={
          movieId && selectedShowtimes
            ? { movieId, showtimes: selectedShowtimes }
            : undefined
        }
        presets={
          <PresetLinks
            label="ย้อนหลัง"
            name="demand"
            values={DEMAND_PRESETS}
            current={demandDays}
            params={{ date }}
            suffix=" วัน"
          />
        }
      />

      <ShowtimeForm
        movies={movies ?? []}
        theaters={theaters ?? []}
        date={date}
        movieId={movieId}
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
