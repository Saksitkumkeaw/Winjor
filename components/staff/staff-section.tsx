import Link from "next/link";
import type { ReactNode } from "react";
import { RoleSection } from "@/components/role-section";
import { SECTION_ACCESS } from "@/lib/auth/roles";

const NAV_ITEMS = [
  { href: "/staff", label: "ขายตั๋ว" },
  { href: "/staff/sale", label: "ขายสินค้า" },
  { href: "/staff/scan", label: "สแกนและรับสินค้า" },
  { href: "/staff/scan-log", label: "ประวัติการสแกน" },
];

export function StaffSection({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  return (
    <RoleSection
      section="POS หน้าร้าน"
      allowed={SECTION_ACCESS.staff}
      path={path}
    >
      <nav
        aria-label="เมนูหน้าร้าน"
        className="mb-6 flex flex-wrap gap-x-4 gap-y-2 border-b pb-3 text-sm"
      >
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className="hover:underline">
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </RoleSection>
  );
}
