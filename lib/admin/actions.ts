"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SECTION_ACCESS } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  parseMovie,
  parseSeatType,
  parseShowtime,
  parseTheater,
  posterExtension,
} from "./validation";

export type FormState = {
  error?: string;
  notice?: string;
};

export type SeatChange = {
  id: string;
  seat_type_id: string;
  is_active: boolean;
};

const DUPLICATE_KEY = "23505";
const OVERLAPPING_SHOWTIME = "23P01";

async function adminClient() {
  await requireRole(SECTION_ACCESS.admin, "/admin");
  return createClient();
}

export async function saveMovie(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseMovie(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await adminClient();
  const values: typeof parsed.data & { poster_url?: string } = parsed.data;

  const poster = formData.get("poster");
  if (poster instanceof File && poster.size > 0) {
    const extension = posterExtension(poster);
    if (!extension.ok) return { error: extension.error };

    const path = `${crypto.randomUUID()}.${extension.data}`;
    const { error } = await supabase.storage
      .from("posters")
      .upload(path, poster, { contentType: poster.type });
    if (error) return { error: "อัปโหลดโปสเตอร์ไม่สำเร็จ" };

    values.poster_url = supabase.storage
      .from("posters")
      .getPublicUrl(path).data.publicUrl;
  }

  const id = formData.get("id");
  const { error } =
    typeof id === "string" && id
      ? await supabase.from("movies").update(values).eq("id", id)
      : await supabase.from("movies").insert(values);
  if (error) return { error: "บันทึกข้อมูลหนังไม่สำเร็จ" };

  revalidatePath("/admin/movies");
  redirect("/admin/movies");
}

export async function saveSeatType(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseSeatType(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await adminClient();
  const id = formData.get("id");
  const { error } =
    typeof id === "string" && id
      ? await supabase.from("seat_types").update(parsed.data).eq("id", id)
      : await supabase.from("seat_types").insert(parsed.data);

  if (error) {
    return {
      error:
        error.code === DUPLICATE_KEY
          ? "มีประเภทที่นั่งชื่อนี้แล้ว"
          : "บันทึกประเภทที่นั่งไม่สำเร็จ",
    };
  }

  revalidatePath("/admin/seat-types");
  return { notice: "บันทึกแล้ว" };
}

export async function createTheater(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseTheater(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await adminClient();
  const { data, error } = await supabase.rpc("create_theater", {
    p_name: parsed.data.name,
    p_rows: parsed.data.rows,
    p_seats_per_row: parsed.data.seatsPerRow,
  });

  if (error) {
    return {
      error:
        error.code === DUPLICATE_KEY
          ? "มีโรงชื่อนี้แล้ว"
          : "สร้างโรงไม่สำเร็จ",
    };
  }

  revalidatePath("/admin/theaters");
  redirect(`/admin/theaters/${data}`);
}

export async function setTheaterActive(formData: FormData) {
  const supabase = await adminClient();
  const { error } = await supabase
    .from("theaters")
    .update({ is_active: formData.get("is_active") === "true" })
    .eq("id", String(formData.get("id")));
  if (error) throw new Error("เปลี่ยนสถานะโรงไม่สำเร็จ");

  revalidatePath("/admin/theaters");
}

export async function saveSeats(
  theaterId: string,
  changes: SeatChange[],
): Promise<FormState> {
  const supabase = await adminClient();

  const groups = new Map<string, SeatChange[]>();
  for (const change of changes) {
    const key = `${change.seat_type_id}:${change.is_active}`;
    groups.set(key, [...(groups.get(key) ?? []), change]);
  }

  for (const group of groups.values()) {
    const { seat_type_id, is_active } = group[0];
    const { error } = await supabase
      .from("seats")
      .update({ seat_type_id, is_active })
      .eq("theater_id", theaterId)
      .in(
        "id",
        group.map((seat) => seat.id),
      );
    if (error) return { error: "บันทึกผังที่นั่งไม่สำเร็จ" };
  }

  revalidatePath(`/admin/theaters/${theaterId}`);
  return { notice: "บันทึกผังที่นั่งแล้ว" };
}

export async function createShowtime(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseShowtime(formData, new Date());
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await adminClient();
  const { error } = await supabase.from("showtimes").insert({
    ...parsed.data,
    // trigger ในฐานข้อมูลคำนวณค่าจริงจากความยาวหนัง
    ends_at: parsed.data.starts_at,
  });

  if (error) {
    return {
      error:
        error.code === OVERLAPPING_SHOWTIME
          ? "เวลาทับกับรอบอื่นในโรงนี้ โดยรวมเวลาทำความสะอาด 20 นาทีแล้ว"
          : "เพิ่มรอบฉายไม่สำเร็จ",
    };
  }

  revalidatePath("/admin/showtimes");
  return { notice: "เพิ่มรอบฉายแล้ว" };
}

export async function cancelShowtime(formData: FormData) {
  const supabase = await adminClient();
  const { error } = await supabase
    .from("showtimes")
    .update({ status: "cancelled" })
    .eq("id", String(formData.get("id")));
  if (error) throw new Error("ยกเลิกรอบฉายไม่สำเร็จ");

  revalidatePath("/admin/showtimes");
}
