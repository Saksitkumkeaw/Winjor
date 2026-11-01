import type { Metadata } from "next";
import { RoleSection } from "@/components/role-section";
import { SECTION_ACCESS } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "POS หน้าร้าน" };

export default function StaffPage() {
  return (
    <RoleSection
      section="POS หน้าร้าน"
      allowed={SECTION_ACCESS.staff}
      path="/staff"
    >
      <h1 className="text-2xl font-semibold">POS หน้าร้าน</h1>
      <p className="mt-2 text-muted-foreground">
        การขายหน้าร้านและสแกนตั๋วจะอยู่ที่นี่ในเฟส 4
      </p>
    </RoleSection>
  );
}
