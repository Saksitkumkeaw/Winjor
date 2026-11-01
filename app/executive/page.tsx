import type { Metadata } from "next";
import Link from "next/link";
import {
  DailyRevenueChart,
  type DailyPoint,
} from "@/components/executive/daily-revenue-chart";
import { RoleSection } from "@/components/role-section";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bangkokDate, formatBaht } from "@/lib/admin/format";
import { SECTION_ACCESS } from "@/lib/auth/roles";
import { parseRange, RANGE_PRESETS } from "@/lib/reports/range";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "รายงานผู้บริหาร" };

type SalesReport = {
  revenue: number;
  orders: number;
  tickets: number;
  seats_sold: number;
  seats_available: number;
  refunded: number;
  daily: DailyPoint[];
  movies: { title: string; tickets: number; revenue: number }[];
  products: { name: string; quantity: number; revenue: number }[];
  channels: { channel: "online" | "pos"; revenue: number }[];
};

const CHANNEL_LABEL = { online: "ออนไลน์", pos: "หน้าร้าน" };

function Tile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {note ? (
        <div className="mt-1 text-xs text-muted-foreground">{note}</div>
      ) : null}
    </div>
  );
}

function RankedList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: { key: string; label: string; detail: string; value: number }[];
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <section className="rounded-lg border p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {rows.length ? (
        <ul className="flex flex-col gap-3 text-sm">
          {rows.map((row) => (
            <li key={row.key}>
              <div className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{row.label}</span>
                <span className="tabular-nums">{formatBaht(row.value)}</span>
              </div>
              <div className="mt-1 h-2 rounded-sm bg-muted">
                <div
                  className="h-full rounded-sm bg-sky-600"
                  style={{ width: `${(row.value / max) * 100}%` }}
                />
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {row.detail}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

async function Report({
  searchParams,
}: Pick<PageProps<"/executive">, "searchParams">) {
  const params = await searchParams;
  const supabase = await createClient();
  const range = parseRange(params, bangkokDate(new Date()));

  const { data, error } = await supabase.rpc("sales_report", {
    p_from: range.from,
    p_to: range.to,
  });

  if (error || !data) {
    return <p className="text-destructive">โหลดรายงานไม่สำเร็จ</p>;
  }

  const report = data as unknown as SalesReport;
  const occupancy = report.seats_available
    ? Math.round((report.seats_sold / report.seats_available) * 100)
    : 0;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">รายงานผู้บริหาร</h1>
        <div className="flex flex-wrap items-center gap-2">
          {RANGE_PRESETS.map((days) => (
            <Link
              key={days}
              href={`/executive?days=${days}`}
              aria-current={range.days === days ? "page" : undefined}
              className={buttonVariants({
                variant: range.days === days ? "default" : "outline",
              })}
            >
              {days} วัน
            </Link>
          ))}
          <form className="flex items-center gap-2">
            <Input
              key={`from-${range.from}`}
              type="date"
              name="from"
              aria-label="ตั้งแต่วันที่"
              defaultValue={range.from}
            />
            <Input
              key={`to-${range.to}`}
              type="date"
              name="to"
              aria-label="ถึงวันที่"
              defaultValue={range.to}
            />
            <Button type="submit" variant="outline">
              ดู
            </Button>
          </form>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="ยอดขาย"
          value={formatBaht(report.revenue)}
          note={`${report.orders} คำสั่งซื้อ`}
        />
        <Tile label="ตั๋วที่ขาย" value={report.tickets.toLocaleString("th-TH")} />
        <Tile
          label="อัตราการเข้าชม"
          value={`${occupancy}%`}
          note={`${report.seats_sold}/${report.seats_available} ที่นั่งของรอบในช่วงนี้`}
        />
        <Tile label="ยอดคืนเงิน" value={formatBaht(report.refunded)} />
      </div>

      <section className="mt-4 rounded-lg border p-4">
        <h2 className="mb-2 font-semibold">ยอดขายรายวัน</h2>
        <DailyRevenueChart points={report.daily} />
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <RankedList
          title="หนังขายดี"
          empty="ยังไม่มียอดขายตั๋ว"
          rows={report.movies.slice(0, 5).map((movie) => ({
            key: movie.title,
            label: movie.title,
            detail: `${movie.tickets} ตั๋ว`,
            value: movie.revenue,
          }))}
        />
        <RankedList
          title="สินค้าขายดี"
          empty="ยังไม่มียอดขายสินค้า"
          rows={report.products.slice(0, 5).map((product) => ({
            key: product.name,
            label: product.name,
            detail: `${product.quantity} ชิ้น`,
            value: product.revenue,
          }))}
        />
        <RankedList
          title="ช่องทางขาย"
          empty="ยังไม่มียอดขาย"
          rows={report.channels.map((channel) => ({
            key: channel.channel,
            label: CHANNEL_LABEL[channel.channel],
            detail: "ยอดหลังหักส่วนลด",
            value: channel.revenue,
          }))}
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        นับยอดตามวันที่สั่งซื้อ และไม่รวมคำสั่งซื้อที่คืนเงินแล้ว
        หนังและสินค้าแสดงยอดก่อนหักส่วนลดจากคะแนน
      </p>
    </>
  );
}

export default function ExecutivePage({ searchParams }: PageProps<"/executive">) {
  return (
    <RoleSection
      section="รายงานผู้บริหาร"
      allowed={SECTION_ACCESS.executive}
      path="/executive"
    >
      <Report searchParams={searchParams} />
    </RoleSection>
  );
}
