import type { Metadata } from "next";
import { AdminSection } from "@/components/admin/admin-section";
import { SeatTypeForm } from "@/components/admin/seat-type-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ราคาตั๋ว" };

async function SeatTypes() {
  const supabase = await createClient();
  const { data: seatTypes } = await supabase
    .from("seat_types")
    .select("*")
    .order("surcharge");

  return (
    <>
      <h1 className="text-2xl font-semibold">ราคาตั๋ว</h1>
      <p className="mt-2 text-muted-foreground">
        ราคาตั๋ว = ราคาพื้นฐานของรอบฉาย + ราคาเพิ่มตามประเภทที่นั่ง
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {seatTypes?.map((seatType) => (
          <SeatTypeForm key={seatType.id} seatType={seatType} />
        ))}
        <SeatTypeForm />
      </div>
    </>
  );
}

export default function SeatTypesPage() {
  return (
    <AdminSection path="/admin/seat-types">
      <SeatTypes />
    </AdminSection>
  );
}
