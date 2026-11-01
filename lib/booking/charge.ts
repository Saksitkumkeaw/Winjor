export type OmiseCharge = {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "successful" | "failed" | "expired" | "reversed";
  paid: boolean;
  paid_at: string | null;
  authorize_uri: string | null;
  failure_message: string | null;
  metadata: { order_id?: string };
  source: {
    scannable_code?: { image?: { download_uri?: string } };
  } | null;
};

export function toSatang(baht: number): number {
  return Math.round(baht * 100);
}

// ยอมรับเฉพาะ charge ที่จ่ายแล้ว และตรงกับคำสั่งซื้อและยอดเงินที่บันทึกไว้
export function isPaidCharge(
  charge: OmiseCharge,
  expected: { orderId: string; baht: number },
): boolean {
  return (
    charge.status === "successful" &&
    charge.paid &&
    charge.currency.toLowerCase() === "thb" &&
    charge.amount === toSatang(expected.baht) &&
    charge.metadata.order_id === expected.orderId
  );
}
