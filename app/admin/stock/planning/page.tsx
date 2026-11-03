import type { Metadata } from "next";
import Link from "next/link";
import { AdminSection } from "@/components/admin/admin-section";
import {
  formatPercent,
  formatQty,
  PresetLinks,
  StatusBadge,
  Tile,
} from "@/components/dss/parts";
import { SERVICE_LEVELS } from "@/lib/dss/inventory";
import {
  LOOKBACK_PRESETS,
  loadIngredientPlans,
  parseLookback,
  parseServiceLevel,
} from "@/lib/dss/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "วางแผนสั่งซื้อ" };

const STATUS_ORDER = { order: 0, soon: 1, ok: 2, idle: 3 };

async function Planning({
  searchParams,
}: Pick<PageProps<"/admin/stock/planning">, "searchParams">) {
  const params = await searchParams;
  const lookback = parseLookback(params.days);
  const serviceLevel = parseServiceLevel(params.level);
  const query = { days: String(lookback), level: String(serviceLevel) };

  const supabase = await createClient();
  const result = await loadIngredientPlans(supabase, { lookback, serviceLevel });
  if (!result) {
    return <p className="text-destructive">โหลดข้อมูลวัตถุดิบไม่สำเร็จ</p>;
  }

  const rows = [...result.plans].sort(
    (a, b) =>
      STATUS_ORDER[a.plan.status] - STATUS_ORDER[b.plan.status] ||
      a.ingredient.name.localeCompare(b.ingredient.name, "th"),
  );
  const toOrder = rows.filter((row) => row.plan.status === "order");
  const soon = rows.filter((row) => row.plan.status === "soon");

  // รวมรอบสั่งของทุกวัตถุดิบก่อนหาร เพราะแต่ละตัวมีรอบสั่งในช่วงทดสอบไม่กี่รอบ
  const pooled = (key: "A" | "B") => {
    const results = rows.flatMap(
      (row) => row.backtest?.policies.find((policy) => policy.key === key)?.result ?? [],
    );
    const cycles = results.reduce((sum, result) => sum + result.cycles, 0);
    return {
      service: cycles
        ? results.reduce((sum, result) => sum + result.cyclesWithoutStockout, 0) / cycles
        : null,
      cycles,
      stockoutDays: results.reduce((sum, result) => sum + result.stockoutDays, 0),
    };
  };
  const dssService = pooled("B");
  const legacyService = pooled("A");

  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">วางแผนสั่งซื้อวัตถุดิบ</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          คำนวณจุดสั่งซื้อ (ROP) และปริมาณสั่งที่ประหยัดที่สุด (EOQ) จากยอดใช้จริงย้อนหลัง
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2">
        <PresetLinks
          label="ข้อมูลย้อนหลัง"
          name="days"
          values={LOOKBACK_PRESETS}
          current={lookback}
          params={query}
          suffix=" วัน"
        />
        <PresetLinks
          label="ระดับบริการ"
          name="level"
          values={SERVICE_LEVELS}
          current={serviceLevel}
          params={query}
          suffix="%"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile
          label="ต้องสั่งวันนี้"
          value={`${toOrder.length} รายการ`}
          note={toOrder.map((row) => row.ingredient.name).join(", ") || "ยังไม่มี"}
          tone={toOrder.length ? "alert" : undefined}
        />
        <Tile
          label="ใกล้ถึงจุดสั่ง"
          value={`${soon.length} รายการ`}
          note={soon.map((row) => row.ingredient.name).join(", ") || "ยังไม่มี"}
        />
        <Tile
          label="ระดับบริการจาก backtest"
          value={formatPercent(dssService.service)}
          note={`เป้า ${serviceLevel}% จาก ${dssService.cycles} รอบสั่ง · วิธีเดิมได้ ${formatPercent(legacyService.service)} · ของขาด ${dssService.stockoutDays} เทียบ ${legacyService.stockoutDays} วัน`}
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border">
        <table className="w-full min-w-2xl text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-2 font-medium">วัตถุดิบ</th>
              <th className="p-2 text-right font-medium">คงเหลือ</th>
              <th className="p-2 text-right font-medium">ใช้ต่อวัน (d)</th>
              <th className="p-2 text-right font-medium">σ</th>
              <th className="p-2 text-right font-medium">พอใช้อีก</th>
              <th className="p-2 text-right font-medium">จุดสั่ง (ROP)</th>
              <th className="p-2 text-right font-medium">สั่งครั้งละ (Q*)</th>
              <th className="p-2 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ ingredient, plan }) => {
              const href = `/admin/stock/planning/${ingredient.id}?${new URLSearchParams(query)}`;
              return (
                <tr key={ingredient.id} className="relative border-t hover:bg-muted/50">
                  <td className="p-2">
                    <Link href={href} className="font-medium after:absolute after:inset-0 hover:underline">
                      {ingredient.name}
                    </Link>
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {formatQty(ingredient.quantity_on_hand, ingredient.unit)}
                  </td>
                  <td className="p-2 text-right tabular-nums">{formatQty(plan.d)}</td>
                  <td className="p-2 text-right tabular-nums">{formatQty(plan.sigma)}</td>
                  <td className="p-2 text-right tabular-nums">
                    {plan.daysLeft === null ? "–" : `${plan.daysLeft.toFixed(1)} วัน`}
                  </td>
                  <td className="p-2 text-right tabular-nums">{formatQty(plan.reorderPoint)}</td>
                  <td className="p-2 text-right tabular-nums">
                    {plan.missingCost ? "ยังไม่ตั้งต้นทุน" : formatQty(Math.ceil(plan.eoq))}
                  </td>
                  <td className="p-2">
                    <StatusBadge status={plan.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        สั่งเลย = คงเหลือ ≤ ROP · ใกล้ถึงจุดสั่ง = คงเหลือ ≤ ROP + ยอดใช้ 2 วัน · ข้อมูล{" "}
        {lookback} วันล่าสุด ไม่รวมวันนี้
      </p>
    </>
  );
}

export default function PlanningPage({
  searchParams,
}: PageProps<"/admin/stock/planning">) {
  return (
    <AdminSection path="/admin/stock/planning">
      <Planning searchParams={searchParams} />
    </AdminSection>
  );
}
