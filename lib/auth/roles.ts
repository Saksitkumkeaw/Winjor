export const ROLES = ["customer", "staff", "admin", "executive"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  customer: "ลูกค้า",
  staff: "พนักงาน",
  admin: "ผู้ดูแลระบบ",
  executive: "ผู้บริหาร",
};

export const ROLE_HOME: Record<Role, string> = {
  customer: "/",
  staff: "/staff",
  admin: "/admin",
  executive: "/executive",
};

// ตรงกับตารางสิทธิ์ใน docs/requirements.md
export const SECTION_ACCESS = {
  staff: ["staff", "admin"],
  admin: ["admin"],
  executive: ["executive"],
} as const satisfies Record<string, readonly Role[]>;

const BASE = "http://internal.invalid";

// รับเฉพาะ path ภายในเว็บ กันการส่งผู้ใช้ไปเว็บอื่นหลังล็อกอิน
export function safeNextPath(next: unknown, fallback: string): string {
  if (typeof next !== "string" || !next.startsWith("/")) return fallback;

  try {
    const url = new URL(next, BASE);
    if (url.origin !== BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
