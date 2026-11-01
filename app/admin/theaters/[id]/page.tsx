import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminSection } from "@/components/admin/admin-section";
import { SeatEditor } from "@/components/admin/seat-editor";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ผังที่นั่ง" };

async function TheaterSeats({
  params,
}: Pick<PageProps<"/admin/theaters/[id]">, "params">) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: theater }, { data: seats }, { data: seatTypes }] =
    await Promise.all([
      supabase.from("theaters").select("name").eq("id", id).maybeSingle(),
      supabase
        .from("seats")
        .select("id, row_label, seat_number, seat_type_id, is_active")
        .eq("theater_id", id)
        .order("row_label")
        .order("seat_number"),
      supabase.from("seat_types").select("id, name").order("surcharge"),
    ]);

  if (!theater) notFound();

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">ผังที่นั่ง {theater.name}</h1>
      <SeatEditor
        key={id}
        theaterId={id}
        seats={seats ?? []}
        seatTypes={seatTypes ?? []}
      />
    </>
  );
}

export default function TheaterSeatsPage({
  params,
}: PageProps<"/admin/theaters/[id]">) {
  return (
    <AdminSection path="/admin/theaters">
      <TheaterSeats params={params} />
    </AdminSection>
  );
}
