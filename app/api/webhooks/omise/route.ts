import { NextResponse, type NextRequest } from "next/server";
import { syncCharge } from "@/lib/booking/payment";
import type { Json } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

type OmiseEvent = {
  id?: string;
  data?: { object?: string; id?: string };
};

// เนื้อหา webhook เป็นแค่สัญญาณ สถานะจริงอ่านจาก Omise API ใน syncCharge เสมอ
export async function POST(request: NextRequest) {
  const event = (await request.json().catch(() => null)) as OmiseEvent | null;
  if (!event?.id) {
    return NextResponse.json({ error: "invalid event" }, { status: 400 });
  }

  const admin = createAdminClient();
  await admin.from("webhook_events").upsert(
    { provider_event_id: event.id, payload: event as Json },
    { onConflict: "provider_event_id", ignoreDuplicates: true },
  );

  if (event.data?.object === "charge" && event.data.id) {
    await syncCharge(event.data.id);
  }

  await admin
    .from("webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("provider_event_id", event.id);

  return NextResponse.json({ received: true });
}
