import { describe, expect, it } from "vitest";
import { ROLE_HOME, ROLES, safeNextPath, SECTION_ACCESS } from "./roles";

describe("safeNextPath", () => {
  it.each([
    ["/staff", "/staff"],
    ["/movies/1?date=today#seats", "/movies/1?date=today#seats"],
  ])("รับ path ภายใน %s", (input, expected) => {
    expect(safeNextPath(input, "/")).toBe(expected);
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "evil",
    "",
    null,
    undefined,
    42,
  ])("ปฏิเสธ %j", (input) => {
    expect(safeNextPath(input, "/fallback")).toBe("/fallback");
  });
});

describe("สิทธิ์ตามบทบาท", () => {
  it("ทุกบทบาทมีหน้าแรก", () => {
    expect(Object.keys(ROLE_HOME).sort()).toEqual([...ROLES].sort());
  });

  it("ผู้ดูแลระบบใช้ POS ได้ แต่ดูรายงานผู้บริหารไม่ได้", () => {
    expect(SECTION_ACCESS.staff).toContain("admin");
    expect(SECTION_ACCESS.executive).not.toContain("admin");
  });

  it("ลูกค้าเข้าส่วนหลังบ้านไม่ได้", () => {
    for (const roles of Object.values(SECTION_ACCESS)) {
      expect(roles).not.toContain("customer");
    }
  });
});
