import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeatPicker } from "@/components/booking/seat-picker";
import { StaffSection } from "@/components/staff/staff-section";
import { formatDate, formatTime } from "@/lib/admin/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ขายตั๋ว" };

async function ShowtimeSale({
  params,
}: Pick<PageProps<"/staff/showtimes/[id]">, "params">) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: showtime }, { data: seats }, { data: products }] =
    await Promise.all([
      supabase
        .from("showtimes")
        .select("starts_at, movies(title), theaters(name)")
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

  return (
    <>
      <h1 className="text-2xl font-semibold">{showtime.movies.title}</h1>
      <p className="mt-1 mb-4 text-muted-foreground">
        {showtime.theaters.name} · {formatDate(showtime.starts_at)}{" "}
        {formatTime(showtime.starts_at)}
      </p>
      <SeatPicker
        mode="pos"
        showtimeId={id}
        initialSeats={seats ?? []}
        products={products ?? []}
      />
    </>
  );
}

export default function ShowtimeSalePage({
  params,
}: PageProps<"/staff/showtimes/[id]">) {
  return (
    <StaffSection path="/staff">
      <ShowtimeSale params={params} />
    </StaffSection>
  );
}
