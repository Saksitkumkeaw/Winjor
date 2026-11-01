import type { Metadata } from "next";
import { SeatPicker } from "@/components/booking/seat-picker";
import { StaffSection } from "@/components/staff/staff-section";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ขายสินค้า" };

async function ProductSale() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price")
    .eq("is_active", true)
    .order("name");

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">ขายสินค้า</h1>
      <SeatPicker
        mode="pos"
        showtimeId={null}
        initialSeats={[]}
        products={products ?? []}
      />
    </>
  );
}

export default function ProductSalePage() {
  return (
    <StaffSection path="/staff/sale">
      <ProductSale />
    </StaffSection>
  );
}
