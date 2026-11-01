import Link from "next/link";
import type { ReactNode } from "react";
import { RoleSection } from "@/components/role-section";
import { SECTION_ACCESS } from "@/lib/auth/roles";

const NAV_ITEMS = [
  { href: "/admin", label: "ภาพรวม" },
  { href: "/admin/movies", label: "หนัง" },
  { href: "/admin/showtimes", label: "รอบฉาย" },
  { href: "/admin/theaters", label: "โรงและผังที่นั่ง" },
  { href: "/admin/seat-types", label: "ราคาตั๋ว" },
  { href: "/admin/products", label: "สินค้า" },
  { href: "/admin/stock", label: "สต็อก" },
  { href: "/admin/orders", label: "คำสั่งซื้อ" },
  { href: "/admin/shifts", label: "กะงาน" },
  { href: "/admin/users", label: "ผู้ใช้" },
];

export function AdminSection({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  return (
    <RoleSection
      section="หลังบ้าน"
      allowed={SECTION_ACCESS.admin}
      path={path}
    >
      <nav
        aria-label="เมนูหลังบ้าน"
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
