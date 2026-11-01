import "server-only";
import { toSatang, type OmiseCharge } from "./charge";

const API_URL = "https://api.omise.co";

function authHeader(): string {
  const secretKey = process.env.OMISE_SECRET_KEY;
  if (!secretKey) throw new Error("ยังไม่ได้ตั้งค่า OMISE_SECRET_KEY");
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

async function omiseRequest<T>(path: string, body?: URLSearchParams): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: authHeader() },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const failure = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(failure?.message ?? `Omise ตอบกลับ ${response.status}`);
  }
  return response.json() as Promise<T>;
}

type CreateChargeInput = {
  orderId: string;
  orderNo: string;
  baht: number;
  returnUri: string;
} & ({ card: string } | { promptPayExpiresAt: string });

export function createCharge(input: CreateChargeInput): Promise<OmiseCharge> {
  const body = new URLSearchParams({
    amount: String(toSatang(input.baht)),
    currency: "thb",
    description: `Winjor ${input.orderNo}`,
    return_uri: input.returnUri,
    "metadata[order_id]": input.orderId,
  });

  if ("card" in input) {
    body.set("card", input.card);
  } else {
    body.set("source[type]", "promptpay");
    body.set("expires_at", input.promptPayExpiresAt);
  }

  return omiseRequest<OmiseCharge>("/charges", body);
}

export function getCharge(chargeId: string): Promise<OmiseCharge> {
  return omiseRequest<OmiseCharge>(`/charges/${encodeURIComponent(chargeId)}`);
}

export function refundCharge(chargeId: string, baht: number) {
  return omiseRequest(
    `/charges/${encodeURIComponent(chargeId)}/refunds`,
    new URLSearchParams({ amount: String(toSatang(baht)) }),
  );
}

// ลิงก์รูป QR ต้องใช้คีย์ลับ จึงดาวน์โหลดฝั่งเซิร์ฟเวอร์แล้วส่งเป็น data URL
export async function downloadQrCode(charge: OmiseCharge): Promise<string> {
  const uri = charge.source?.scannable_code?.image?.download_uri;
  if (!uri) throw new Error("Omise ไม่ได้ส่ง QR กลับมา");

  const response = await fetch(uri, {
    headers: { Authorization: authHeader() },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`ดาวน์โหลด QR ไม่สำเร็จ ${response.status}`);

  const contentType = response.headers.get("content-type") ?? "image/svg+xml";
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}
