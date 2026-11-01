import { Suspense, type ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import type { Role } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";

type RoleSectionProps = {
  section: string;
  allowed: readonly Role[];
  path: string;
  children: ReactNode;
};

async function Guarded({
  allowed,
  path,
  children,
}: Omit<RoleSectionProps, "section">) {
  await requireRole(allowed, path);
  return children;
}

// ทุกหน้าที่จำกัดบทบาทต้องครอบด้วยคอมโพเนนต์นี้ เพราะ layout ไม่รันซ้ำเมื่อเปลี่ยนหน้า
export function RoleSection({ section, ...guard }: RoleSectionProps) {
  return (
    <>
      <SiteHeader section={section} />
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">
        <Suspense
          fallback={<p className="text-muted-foreground">กำลังโหลด…</p>}
        >
          <Guarded {...guard} />
        </Suspense>
      </main>
    </>
  );
}
