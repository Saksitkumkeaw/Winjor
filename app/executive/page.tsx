import type { Metadata } from "next";
import { RoleSection } from "@/components/role-section";
import { SECTION_ACCESS } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "รายงานผู้บริหาร" };

export default function ExecutivePage() {
  return (
    <RoleSection
      section="รายงานผู้บริหาร"
      allowed={SECTION_ACCESS.executive}
      path="/executive"
    >
      <h1 className="text-2xl font-semibold">รายงานผู้บริหาร</h1>
      <p className="mt-2 text-muted-foreground">
        ยอดขายและอัตราการเข้าชมจะแสดงที่นี่ในเฟส 6
      </p>
    </RoleSection>
  );
}
