import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SeatPicker } from "@/components/booking/seat-picker";
import { SiteHeader } from "@/components/site-header";
import { formatDate, formatTime } from "@/lib/admin/format";
import { createClient } from "@/lib/supabase/server";

async function ShowtimeBooking({
  params,
}: Pick<PageProps<"/showtimes/[id]">, "params">) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: showtime }, { data: seats }, { data: products }] =
    await Promise.all([
      supabase
        .from("showtimes")
        .select("starts_at, status, movies(title), theaters(name)")
        .eq("id", id)
        .maybeSingle(),
      supabase.rpc("get_showtime_seats", { p_showtime_id: id }),
      supabase
        .from("products")
        .select("id, name, price")
        .eq("is_active", true)
        .order("name"),
    ]);

  if (!showtime) notFound();

  const closed =
    showtime.status !== "scheduled" ||
    new Date(showtime.starts_at) <= new Date();

  return (
    <>
      <h1 className="text-2xl font-semibold">{showtime.movies.title}</h1>
      <p className="mt-1 mb-4 text-muted-foreground">
        {showtime.theaters.name} · {formatDate(showtime.starts_at)}{" "}
        {formatTime(showtime.starts_at)}
      </p>
      {closed ? (
        <p className="text-muted-foreground">รอบฉายนี้ปิดการขายแล้ว</p>
      ) : (
        <SeatPicker
          showtimeId={id}
          initialSeats={seats ?? []}
          products={products ?? []}
        />
      )}
    </>
  );
}

export default function ShowtimePage({ params }: PageProps<"/showtimes/[id]">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 p-4">
        <Suspense fallback={<p className="text-muted-foreground">กำลังโหลด…</p>}>
          <ShowtimeBooking params={params} />
        </Suspense>
      </main>
    </>
  );
}
