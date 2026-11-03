import { bangkokDate, shiftDate } from "@/lib/admin/format";
import type { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { runBacktest, TEST_DAYS, TRAIN_DAYS, type BacktestResult } from "./backtest";
import { buildOptions, SERVICE_LEVELS, type Plan, type ServiceLevel } from "./inventory";
import { DEMAND_PRESETS, type MovieDemand } from "./showtimes";

type Client = Awaited<ReturnType<typeof createClient>>;

export const LOOKBACK_PRESETS = [30, 60, 90] as const;
export type Lookback = (typeof LOOKBACK_PRESETS)[number];
const HISTORY_DAYS = TRAIN_DAYS + TEST_DAYS;

export type Ingredient = Pick<
  Tables<"ingredients">,
  | "id"
  | "name"
  | "unit"
  | "quantity_on_hand"
  | "reorder_level"
  | "unit_cost"
  | "order_cost"
  | "holding_rate"
  | "lead_time_days"
  | "discount_min_qty"
  | "discount_pct"
>;

export const INGREDIENT_COLUMNS =
  "id, name, unit, quantity_on_hand, reorder_level, unit_cost, order_cost, holding_rate, lead_time_days, discount_min_qty, discount_pct";

export type IngredientPlan = {
  ingredient: Ingredient;
  // ยอดใช้ 90 วันย้อนหลัง ไม่รวมวันนี้ที่ยังขายไม่จบ
  history: number[];
  plan: Plan;
  backtest: BacktestResult | null;
};

type SearchValue = string | string[] | undefined;

export function parseLookback(value: SearchValue): Lookback {
  return LOOKBACK_PRESETS.find((days) => String(days) === value) ?? 30;
}

export function parseServiceLevel(value: SearchValue): ServiceLevel {
  return SERVICE_LEVELS.find((level) => String(level) === value) ?? 95;
}

export function parseDemandDays(value: SearchValue): (typeof DEMAND_PRESETS)[number] {
  return DEMAND_PRESETS.find((days) => String(days) === value) ?? 14;
}

export function planSettings(ingredient: Ingredient) {
  return {
    reorderLevel: ingredient.reorder_level,
    unitCost: ingredient.unit_cost,
    orderCost: ingredient.order_cost,
    holdingRate: ingredient.holding_rate,
    leadTimeDays: ingredient.lead_time_days,
    discountMinQty: ingredient.discount_min_qty,
    discountPct: ingredient.discount_pct,
  };
}

export async function loadIngredientPlans(
  supabase: Client,
  { lookback, serviceLevel, ingredientId }: {
    lookback: Lookback;
    serviceLevel: ServiceLevel;
    ingredientId?: string;
  },
): Promise<{ dates: string[]; plans: IngredientPlan[] } | null> {
  const today = bangkokDate(new Date());
  let ingredientQuery = supabase.from("ingredients").select(INGREDIENT_COLUMNS).order("name");
  if (ingredientId) ingredientQuery = ingredientQuery.eq("id", ingredientId);

  const [{ data: ingredients }, { data: usage, error }] = await Promise.all([
    ingredientQuery,
    supabase.rpc("ingredient_daily_usage", {
      p_from: shiftDate(today, -HISTORY_DAYS),
      p_to: shiftDate(today, -1),
    }),
  ]);
  if (!ingredients || error || !usage) return null;

  const { dates, ingredients: daily } = usage as unknown as {
    dates: string[];
    ingredients: { ingredient_id: string; usage: number[] }[];
  };
  const byId = new Map(daily.map((row) => [row.ingredient_id, row.usage]));

  return {
    dates,
    plans: ingredients.map((ingredient) => {
      const history = byId.get(ingredient.id) ?? Array<number>(dates.length).fill(0);
      const settings = planSettings(ingredient);
      return {
        ingredient,
        history,
        plan: buildOptions({
          ...settings,
          usage: history.slice(-lookback),
          onHand: ingredient.quantity_on_hand,
          serviceLevel,
          demandAdjustPct: 0,
        }),
        backtest: runBacktest(history, { ...settings, serviceLevel }),
      };
    }),
  };
}

export async function loadShowtimeDemand(
  supabase: Client,
  days: number,
): Promise<MovieDemand[] | null> {
  const today = bangkokDate(new Date());
  const { data, error } = await supabase.rpc("showtime_demand", {
    p_from: shiftDate(today, 1 - days),
    p_to: today,
  });
  if (error || !data) return null;
  return data as unknown as MovieDemand[];
}

export type MovieShowtime = {
  id: string;
  starts_at: string;
  theater: string;
  sold: number;
  capacity: number;
};

// รอบที่ยังไม่ฉายของหนังเรื่องเดียว พร้อมจำนวนที่ขายแล้ว ใช้ตัดสินใจเพิ่มหรือลดรอบ
export async function loadMovieShowtimes(
  supabase: Client,
  movieId: string,
): Promise<MovieShowtime[]> {
  const [{ data: showtimes }, { data: seats }] = await Promise.all([
    supabase
      .from("showtimes")
      .select("id, starts_at, theater_id, theaters(name), tickets(status)")
      .eq("movie_id", movieId)
      .eq("status", "scheduled")
      .gt("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(60),
    supabase.from("seats").select("theater_id").eq("is_active", true),
  ]);

  const capacity = new Map<string, number>();
  for (const seat of seats ?? []) {
    capacity.set(seat.theater_id, (capacity.get(seat.theater_id) ?? 0) + 1);
  }

  return (showtimes ?? []).map((showtime) => ({
    id: showtime.id,
    starts_at: showtime.starts_at,
    theater: showtime.theaters.name,
    sold: showtime.tickets.filter((ticket) =>
      ["held", "paid", "used"].includes(ticket.status),
    ).length,
    capacity: capacity.get(showtime.theater_id) ?? 0,
  }));
}
