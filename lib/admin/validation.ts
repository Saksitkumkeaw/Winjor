import type { MovieStatus } from "@/lib/supabase/database.types";
import { toBangkokIso } from "./format";

export type Parsed<T> = { ok: true; data: T } | { ok: false; error: string };

export const MAX_THEATER_ROWS = 26;
// รวมแล้วต้องไม่เกิน 1,000 ที่นั่ง ซึ่งเป็นจำนวนแถวสูงสุดที่ Supabase ส่งกลับต่อครั้ง
export const MAX_SEATS_PER_ROW = 30;
export const MAX_POSTER_BYTES = 900_000;

const POSTER_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MOVIE_STATUSES: readonly string[] = [
  "coming_soon",
  "now_showing",
  "ended",
];

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function text(form: FormData, field: string): string {
  const value = form.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function integer(form: FormData, field: string): number {
  const value = text(form, field);
  return /^\d+$/.test(value) ? Number(value) : Number.NaN;
}

function amount(form: FormData, field: string): number {
  const value = text(form, field);
  return /^\d+(\.\d{1,2})?$/.test(value) ? Number(value) : Number.NaN;
}

export function parseMovie(form: FormData): Parsed<{
  title: string;
  synopsis: string;
  duration_min: number;
  rating: string;
  release_date: string | null;
  status: MovieStatus;
}> {
  const title = text(form, "title");
  const duration = integer(form, "duration_min");
  const status = text(form, "status");
  const releaseDate = text(form, "release_date");

  if (!title) return fail("กรุณากรอกชื่อหนัง");
  if (!(duration > 0)) return fail("ความยาวหนังต้องเป็นจำนวนนาทีมากกว่า 0");
  if (!MOVIE_STATUSES.includes(status)) return fail("สถานะหนังไม่ถูกต้อง");
  if (releaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
    return fail("วันที่เข้าฉายไม่ถูกต้อง");
  }

  return {
    ok: true,
    data: {
      title,
      synopsis: text(form, "synopsis"),
      duration_min: duration,
      rating: text(form, "rating"),
      release_date: releaseDate || null,
      status: status as MovieStatus,
    },
  };
}

export function posterExtension(file: {
  type: string;
  size: number;
}): Parsed<string> {
  const extension = POSTER_TYPES[file.type];
  if (!extension) return fail("โปสเตอร์ต้องเป็นไฟล์ JPG, PNG หรือ WebP");
  if (file.size > MAX_POSTER_BYTES) {
    return fail("โปสเตอร์ต้องมีขนาดไม่เกิน 900 KB");
  }
  return { ok: true, data: extension };
}

export function parseSeatType(
  form: FormData,
): Parsed<{ name: string; surcharge: number }> {
  const name = text(form, "name");
  const surcharge = amount(form, "surcharge");

  if (!name) return fail("กรุณากรอกชื่อประเภทที่นั่ง");
  if (Number.isNaN(surcharge)) return fail("ราคาเพิ่มต้องเป็นตัวเลขตั้งแต่ 0");

  return { ok: true, data: { name, surcharge } };
}

export function parseProduct(
  form: FormData,
): Parsed<{ name: string; price: number }> {
  const name = text(form, "name");
  const price = amount(form, "price");

  if (!name) return fail("กรุณากรอกชื่อสินค้า");
  if (Number.isNaN(price)) return fail("ราคาต้องเป็นตัวเลขตั้งแต่ 0");

  return { ok: true, data: { name, price } };
}

export function parseRecipeItem(
  form: FormData,
): Parsed<{ ingredient_id: string; quantity: number }> {
  const ingredientId = text(form, "ingredient_id");
  const quantity = amount(form, "quantity");

  if (!ingredientId) return fail("กรุณาเลือกวัตถุดิบ");
  if (!(quantity > 0)) return fail("ปริมาณต้องมากกว่า 0");

  return { ok: true, data: { ingredient_id: ingredientId, quantity } };
}

export function parseIngredient(
  form: FormData,
): Parsed<{ name: string; unit: string; reorder_level: number }> {
  const name = text(form, "name");
  const unit = text(form, "unit");
  const reorderLevel = amount(form, "reorder_level");

  if (!name) return fail("กรุณากรอกชื่อวัตถุดิบ");
  if (!unit) return fail("กรุณากรอกหน่วย");
  if (Number.isNaN(reorderLevel)) {
    return fail("จุดแจ้งเตือนต้องเป็นตัวเลขตั้งแต่ 0");
  }

  return { ok: true, data: { name, unit, reorder_level: reorderLevel } };
}

export function parseStockChange(form: FormData): Parsed<{
  ingredient_id: string;
  change: number;
  reason: "purchase" | "adjustment";
}> {
  const ingredientId = text(form, "ingredient_id");
  const change = Number(text(form, "change"));
  const reason = text(form, "reason");

  if (!ingredientId) return fail("กรุณาเลือกวัตถุดิบ");
  if (reason !== "purchase" && reason !== "adjustment") {
    return fail("ประเภทรายการไม่ถูกต้อง");
  }
  if (!Number.isFinite(change) || change === 0) {
    return fail("จำนวนต้องเป็นตัวเลขที่ไม่ใช่ 0");
  }
  if (reason === "purchase" && change < 0) {
    return fail("การรับเข้าต้องเป็นจำนวนบวก");
  }

  return { ok: true, data: { ingredient_id: ingredientId, change, reason } };
}

export function parseTheater(
  form: FormData,
): Parsed<{ name: string; rows: number; seatsPerRow: number }> {
  const name = text(form, "name");
  const rows = integer(form, "rows");
  const seatsPerRow = integer(form, "seats_per_row");

  if (!name) return fail("กรุณากรอกชื่อโรง");
  if (!(rows >= 1 && rows <= MAX_THEATER_ROWS)) {
    return fail(`จำนวนแถวต้องอยู่ระหว่าง 1-${MAX_THEATER_ROWS}`);
  }
  if (!(seatsPerRow >= 1 && seatsPerRow <= MAX_SEATS_PER_ROW)) {
    return fail(`จำนวนที่นั่งต่อแถวต้องอยู่ระหว่าง 1-${MAX_SEATS_PER_ROW}`);
  }

  return { ok: true, data: { name, rows, seatsPerRow } };
}

export function parseShowtime(
  form: FormData,
  now: Date,
): Parsed<{
  movie_id: string;
  theater_id: string;
  starts_at: string;
  base_price: number;
}> {
  const movieId = text(form, "movie_id");
  const theaterId = text(form, "theater_id");
  const date = text(form, "date");
  const time = text(form, "time");
  const basePrice = amount(form, "base_price");

  if (!movieId) return fail("กรุณาเลือกหนัง");
  if (!theaterId) return fail("กรุณาเลือกโรง");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return fail("กรุณาเลือกวันและเวลา");
  }

  const start = new Date(`${date}T${time}:00+07:00`);
  if (Number.isNaN(start.getTime())) return fail("วันหรือเวลาไม่ถูกต้อง");
  if (start <= now) return fail("เวลาเริ่มฉายต้องอยู่ในอนาคต");
  if (Number.isNaN(basePrice)) return fail("ราคาตั๋วต้องเป็นตัวเลขตั้งแต่ 0");

  return {
    ok: true,
    data: {
      movie_id: movieId,
      theater_id: theaterId,
      starts_at: toBangkokIso(date, time),
      base_price: basePrice,
    },
  };
}
