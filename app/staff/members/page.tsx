import type { Metadata } from "next";
import { MemberRegisterForm } from "@/components/staff/member-register-form";
import { StaffSection } from "@/components/staff/staff-section";

export const metadata: Metadata = { title: "สมัครสมาชิก" };

export default function MembersPage() {
  return (
    <StaffSection path="/staff/members">
      <h1 className="mb-1 text-2xl font-semibold">สมัครสมาชิกหน้าร้าน</h1>
      <p className="mb-4 text-muted-foreground">
        ลูกค้าเข้าสู่ระบบด้วยอีเมลและรหัสผ่านนี้ได้ทันที
        ส่วนการสะสมคะแนนหน้าร้านใช้เบอร์โทรศัพท์
      </p>
      <MemberRegisterForm />
    </StaffSection>
  );
}
