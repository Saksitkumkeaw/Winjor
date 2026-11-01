export function normalizeOrderNo(input: string): string | null {
  const code = input.trim().toUpperCase();
  return /^WJ-\d{6,}$/.test(code) ? code : null;
}
