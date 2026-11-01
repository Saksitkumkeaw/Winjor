import type { Metadata } from "next";
import { PickupForm } from "@/components/staff/pickup-form";
import { StaffSection } from "@/components/staff/staff-section";
import { TicketScanner } from "@/components/staff/ticket-scanner";

export const metadata: Metadata = { title: "สแกนตั๋ว" };

export default function ScanPage() {
  return (
    <StaffSection path="/staff/scan">
      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h1 className="mb-4 text-2xl font-semibold">สแกนตั๋ว</h1>
          <TicketScanner />
        </section>
        <section>
          <h2 className="mb-4 text-2xl font-semibold">รับสินค้า</h2>
          <PickupForm />
        </section>
      </div>
    </StaffSection>
  );
}
