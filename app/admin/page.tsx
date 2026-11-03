import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminSection } from "@/components/admin/admin-section";
import { formatPercent, Tile } from "@/components/dss/parts";
import { ActionBadge } from "@/components/dss/showtime-demand";
import {
  DailyRevenueChart,
  type DailyPoint,
} from "@/components/executive/daily-revenue-chart";
import { bangkokDate, formatBaht, toBangkokIso } from "@/lib/admin/format";
import { loadIngredientPlans, loadShowtimeDemand } from "@/lib/dss/queries";
import { adviseShowtimes } from "@/lib/dss/showtimes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "หลังบ้าน" };

type TodaySummary = {
  revenue_today: number;
  revenue_yesterday: number;
  tickets_online: number;
  tickets_pos: number;
  showtimes_today: number;
  seats_sold: number;
  seats_available: number;
  sold_out_today: number;
  awaiting_pickup: number;
  daily: DailyPoint[];
};

function DecisionCard({
  title,
  href,
  empty,
  items,
}: {
  title: string;
  href: string;
  empty: string;
  items: { key: string; label: string; href: string; detail: ReactNode }[];
}) {
  return (
    <section
      className={
        items.length ? "rounded-lg border border-amber-500 bg-amber-50/60 p-4" : "rounded-lg border p-4"
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <Link href={href} className="text-sm text-muted-foreground hover:underline">
          ดูทั้งหมด
        </Link>
      </div>
      {items.length ? (
        <ul className="mt-2 flex flex-col gap-1.5 text-sm">
          {items.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-2">
              <Link href={item.href} className="min-w-0 truncate font-medium hover:underline">
                {item.label}
              </Link>
              <span className="shrink-0">{item.detail}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

async function Overview() {
  const supabase = await createClient();
  const today = toBangkokIso(bangkokDate(new Date()), "00:00");

  const [movies, theaters, showtimes, summary, plans, demand, weekDemand, activeMovies] =
    await Promise.all([
    supabase
      .from("movies")
      .select("id", { count: "exact", head: true })
      .eq("status", "now_showing"),
    supabase
      .from("theaters")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("showtimes")
      .select("id", { count: "exact", head: true })
      .eq("status", "scheduled")
      .gte("starts_at", today),
    supabase.rpc("admin_today_summary"),
    loadIngredientPlans(supabase, { lookback: 30, serviceLevel: 95 }),
    loadShowtimeDemand(supabase, 14),
    loadShowtimeDemand(supabase, 7),
    supabase.from("movies").select("id").neq("status", "ended"),
  ]);

  const stats = [
    { label: "หนังที่กำลังฉาย", value: movies.count, href: "/admin/movies" },
    { label: "รอบฉายที่จะถึง", value: showtimes.count, href: "/admin/showtimes" },
    { label: "โรงที่เปิดใช้", value: theaters.count, href: "/admin/theaters" },
  ];

  const toOrder = plans?.plans.filter((row) => row.plan.status === "order") ?? [];
  // หนังที่ออกโรงแล้วไม่ต้องตัดสินใจอีก
  const activeIds = new Set(activeMovies.data?.map((movie) => movie.id));
  const { advice } = adviseShowtimes(
    (demand ?? []).filter((row) => activeIds.has(row.movie_id)),
  );
  const addMore = advice.filter((row) => row.action === "add");
  const reduce = advice.filter((row) => row.action === "end" || row.action === "reduce");
  const day = summary.data as unknown as TodaySummary | null;
  const occupancy =
    day && day.seats_available ? day.seats_sold / day.seats_available : null;
  const revenueChange =
    day && day.revenue_yesterday > 0
      ? (day.revenue_today - day.revenue_yesterday) / day.revenue_yesterday
      : null;
  const weekMovies = (weekDemand ?? []).filter((row) => activeIds.has(row.movie_id)).sort(
    (a, b) => (b.occupancy ?? 0) - (a.occupancy ?? 0),
  );

  return (
    <>
      <h1 className="text-2xl font-semibold">ภาพรวม</h1>

      <h2 className="mt-4 mb-2 text-lg font-semibold">ต้องตัดสินใจ</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <DecisionCard
          title="วัตถุดิบที่ต้องสั่งวันนี้"
          href="/admin/stock/planning"
          empty="ยังไม่มีวัตถุดิบถึงจุดสั่งซื้อ"
          items={toOrder.map(({ ingredient, plan }) => ({
            key: ingredient.id,
            label: ingredient.name,
            href: `/admin/stock/planning/${ingredient.id}`,
            detail: (
              <span className="text-xs text-red-800">
                พอใช้ {plan.daysLeft?.toFixed(1) ?? "–"} วัน
              </span>
            ),
          }))}
        />
        <DecisionCard
          title="หนังที่ควรเพิ่มรอบ"
          href="/admin/showtimes"
          empty="ยังไม่มีเรื่องที่รอบน้อยแต่เต็ม"
          items={addMore.map((row) => ({
            key: row.movie_id,
            label: row.title,
            href: `/admin/showtimes?movie=${row.movie_id}#new-showtime`,
            detail: <ActionBadge action="add" />,
          }))}
        />
        <DecisionCard
          title="หนังที่ควรลดรอบหรือออกโรง"
          href="/admin/showtimes"
          empty="ยังไม่มีเรื่องที่รอบเยอะแต่ว่าง"
          items={reduce.map((row) => ({
            key: row.movie_id,
            label: row.title,
            href: `/admin/showtimes?movie=${row.movie_id}`,
            detail:
              row.action === "end" ? (
                <ActionBadge action="end" />
              ) : (
                <span className="text-xs text-muted-foreground">
                  เข้าชม {formatPercent(row.occupancy)}
                </span>
              ),
          }))}
        />
      </div>

      <h2 className="mt-6 mb-2 text-lg font-semibold">วันนี้</h2>
      {day ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            label="ยอดขาย"
            value={formatBaht(day.revenue_today)}
            note={
              revenueChange === null
                ? `เมื่อวาน ${formatBaht(day.revenue_yesterday)}`
                : `${revenueChange >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(revenueChange * 100))}% จากเมื่อวาน`
            }
          />
          <Tile
            label="ตั๋วที่ขาย"
            value={`${day.tickets_online + day.tickets_pos} ใบ`}
            note={`ออนไลน์ ${day.tickets_online} · หน้าร้าน ${day.tickets_pos}`}
          />
          <Tile
            label="อัตราเข้าชมรอบวันนี้"
            value={formatPercent(occupancy)}
            note={`${day.showtimes_today} รอบ · ขายหมด ${day.sold_out_today} รอบ`}
          />
          <Tile
            label="ออเดอร์รอรับสินค้า"
            value={`${day.awaiting_pickup} รายการ`}
            note="จ่ายแล้วตั้งแต่เมื่อวาน"
          />
        </div>
      ) : (
        <p className="text-destructive">โหลดข้อมูลวันนี้ไม่สำเร็จ</p>
      )}

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="flex items-baseline justify-between rounded-lg border px-3 py-2 text-muted-foreground hover:bg-muted"
          >
            {stat.label}
            <span className="font-semibold text-foreground tabular-nums">
              {stat.value ?? 0}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">ยอดขาย 7 วัน</h2>
          {day?.daily.length ? (
            <DailyRevenueChart points={day.daily} height={120} />
          ) : (
            <p className="text-sm text-muted-foreground">ยังไม่มียอดขาย</p>
          )}
        </section>
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-semibold">อัตราเข้าชมรายเรื่อง 7 วัน</h2>
          {weekMovies.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {weekMovies.map((row) => (
                <li key={row.movie_id}>
                  <div className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">{row.title}</span>
                    <span className="tabular-nums">{formatPercent(row.occupancy)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-sm bg-muted">
                    <div
                      className="h-full rounded-sm bg-sky-600"
                      style={{ width: `${Math.min(row.occupancy ?? 0, 1) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">ยังไม่มีรอบที่ฉายแล้ว</p>
          )}
        </section>
      </div>
    </>
  );
}

export default function AdminPage() {
  return (
    <AdminSection path="/admin">
      <Overview />
    </AdminSection>
  );
}
