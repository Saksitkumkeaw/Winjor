export const SCAN_RESULT_LABEL = {
  ok: "เข้าชมได้",
  used: "ตั๋วนี้ถูกใช้แล้ว",
  not_found: "ไม่พบตั๋วนี้",
  invalid: "ตั๋วนี้ใช้ไม่ได้",
  too_early: "ยังไม่ถึงเวลาเข้าโรง",
  too_late: "เลยเวลาเข้าโรงแล้ว",
} as const;

export type ScanResult = keyof typeof SCAN_RESULT_LABEL;

export function scanResultLabel(result: string): string {
  return result in SCAN_RESULT_LABEL
    ? SCAN_RESULT_LABEL[result as ScanResult]
    : result;
}
