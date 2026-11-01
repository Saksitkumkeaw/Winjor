import type { Metadata } from "next";
import { RoleSection } from "@/components/role-section";
import { SECTION_ACCESS } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "หลังบ้าน" };

export default function AdminPage() {
  return (
    <RoleSection
      section="หลังบ้าน"
      allowed={SECTION_ACCESS.admin}
      path="/admin"
    >
      <h1 className="text-2xl font-semibold">หลังบ้าน</h1>
      <p className="mt-2 text-muted-foreground">
        การจัดการหนัง โรง และรอบฉายจะอยู่ที่นี่ในเฟส 2
      </p>
    </RoleSection>
  );
}
