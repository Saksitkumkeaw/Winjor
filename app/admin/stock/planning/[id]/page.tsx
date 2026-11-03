import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminSection } from "@/components/admin/admin-section";
import { IngredientForm } from "@/components/admin/ingredient-form";
import { DecisionWorkbench } from "@/components/dss/decision-workbench";
import { formatPercent, formatQty, StatusBadge, Tile } from "@/components/dss/parts";
import { UsageChart } from "@/components/dss/usage-chart";
import { formatDate, formatTime } from "@/lib/admin/format";
import { TEST_DAYS, TRAIN_DAYS } from "@/lib/dss/backtest";
import { OPTION_LABEL } from "@/lib/dss/inventory";
import { loadIngredientPlans, parseLookback, parseServiceLevel } from "@/lib/dss/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ตัดสินใจสั่งซื้อ" };

function baht(value: number): string {
  return `${Math.round(value).toLocaleString("th-TH")} บาท`;
}

async function Decision({
  params,
  searchParams,
}: PageProps<"/admin/stock/planning/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const lookback = parseLookback(query.days);
  const serviceLevel = parseServiceLevel(query.level);

  const supabase = await createClient();
  const [loaded, { data: decisions }] = await Promise.all([
    loadIngredientPlans(supabase, { lookback, serviceLevel, ingredientId: id }),
    supabase
      .from("reorder_decisions")
      .select(
        "id, recommended_option, recommended_qty, approved_option, approved_qty, service_level, demand_adjust_pct, d, sigma, rop, on_hand, created_at, profiles(full_name)",
      )
      .eq("ingredient_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const current = loaded?.plans[0];
  if (!loaded || !current) notFound();

  const { ingredient, history, plan, backtest } = current;
  const { unit } = ingredient;
  const usage = history.slice(-lookback);
  const dates = loaded.dates.slice(-lookback);
  const legacy = backtest?.policies.find((policy) => policy.key === "A");
  const dss = backtest?.policies.find((policy) => policy.key === "B");
  const costChange =
    legacy && dss && legacy.result.totalCost > 0
      ? (dss.result.totalCost - legacy.result.totalCost) / legacy.result.totalCost
      : null;

  return (
    <>
      <Link
        href={`/admin/stock/planning?days=${lookback}&level=${serviceLevel}`}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← วางแผนสั่งซื้อ
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{ingredient.name}</h1>
        <StatusBadge status={plan.status} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        ข้อมูล {lookback} วันล่าสุด · ระดับบริการเริ่มต้น {serviceLevel}% · ตัดสินใจตาม 4
        ขั้นของ Simon
      </p>

      <section aria-labelledby="intelligence-heading" className="mt-6">
        <h2 id="intelligence-heading" className="text-lg font-semibold">
          1. Intelligence: สถานการณ์ตอนนี้
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <Tile
            label="คงเหลือ"
            value={formatQty(ingredient.quantity_on_hand, unit)}
            tone={plan.status === "order" ? "alert" : undefined}
          />
          <Tile label="ใช้เฉลี่ยต่อวัน (d)" value={formatQty(plan.d, unit)} />
          <Tile label="ความผันผวน (σ)" value={formatQty(plan.sigma, unit)} note="ส่วนเบี่ยงเบนมาตรฐานรายวัน" />
          <Tile
            label="พอใช้อีก"
            value={plan.daysLeft === null ? "–" : `${plan.daysLeft.toFixed(1)} วัน`}
            note={`รอของ ${ingredient.lead_time_days} วัน`}
          />
        </div>
        <div className="mt-4 rounded-lg border p-4">
          <UsageChart dates={dates} values={usage} average={plan.d} unit={unit} />
        </div>
      </section>

      <DecisionWorkbench
        key={`${lookback}-${serviceLevel}`}
        ingredient={ingredient}
        usage={usage}
        lookback={lookback}
        initialServiceLevel={serviceLevel}
      />

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-muted-foreground">
          แก้ต้นทุนและเวลารอของ (ค่าที่ใช้เป็นสมมติฐาน)
        </summary>
        <div className="mt-2">
          <IngredientForm ingredient={ingredient} />
        </div>
      </details>

      <section aria-labelledby="feedback-heading" className="mt-8">
        <h2 id="feedback-heading" className="text-lg font-semibold">
          4. Implementation / Feedback: ผลย้อนหลังและประวัติ
        </h2>

        {backtest && legacy && dss ? (
          <>
            <p className="mt-2 text-sm">
              ใช้ {TRAIN_DAYS} วันแรกหา d และ σ แล้วจำลองการสั่งด้วยยอดจริง {TEST_DAYS} วันหลัง
              DSS (ทางเลือก B) ได้ระดับบริการ{" "}
              <strong>{formatPercent(dss.result.serviceLevel)}</strong> จากเป้า {serviceLevel}%
              ขาดของ {dss.result.stockoutDays} วัน เทียบวิธีเดิม {legacy.result.stockoutDays} วัน
              {costChange !== null
                ? ` ต้นทุนช่วงทดสอบ${costChange > 0 ? "สูงขึ้น" : "ลดลง"} ${Math.abs(Math.round(costChange * 100))}%`
                : ""}
            </p>
            <div className="mt-3 overflow-x-auto rounded-lg border">
              <table className="w-full min-w-xl text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="p-2 font-medium">นโยบาย</th>
                    <th className="p-2 text-right font-medium">ระดับบริการจริง</th>
                    <th className="p-2 text-right font-medium">รอบสั่ง</th>
                    <th className="p-2 text-right font-medium">วันที่ของขาด</th>
                    <th className="p-2 text-right font-medium">วันที่มีของ</th>
                    <th className="p-2 text-right font-medium">ค่าสั่ง</th>
                    <th className="p-2 text-right font-medium">ค่าเก็บ</th>
                    <th className="p-2 text-right font-medium">รวม {TEST_DAYS} วัน</th>
                  </tr>
                </thead>
                <tbody>
                  {backtest.policies.map(({ key, policy, result }) => (
                    <tr key={key} className="border-t">
                      <td className="p-2">
                        {key} · {OPTION_LABEL[key]}
                        <div className="text-xs text-muted-foreground">
                          ROP {formatQty(policy.reorderPoint)} · Q {formatQty(policy.orderQty)}
                        </div>
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {formatPercent(result.serviceLevel)}
                        <div className="text-xs text-muted-foreground">
                          {result.cyclesWithoutStockout}/{result.cycles} รอบ
                        </div>
                      </td>
                      <td className="p-2 text-right tabular-nums">{result.orders}</td>
                      <td className="p-2 text-right tabular-nums">{result.stockoutDays}</td>
                      <td className="p-2 text-right tabular-nums">
                        {formatPercent(result.inStockRate)}
                      </td>
                      <td className="p-2 text-right tabular-nums">{baht(result.orderingCost)}</td>
                      <td className="p-2 text-right tabular-nums">{baht(result.holdingCost)}</td>
                      <td className="p-2 text-right tabular-nums">{baht(result.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              MAPE ของการใช้ค่าเฉลี่ย {formatQty(backtest.trainMean, unit)}/วัน ทำนายยอดรายวัน ={" "}
              <strong className="text-foreground">{formatPercent(backtest.mape)}</strong>{" "}
              ความคลาดเคลื่อนรายวันนี้คือเหตุผลที่ต้องมีของสำรอง (SS)
            </p>
          </>
        ) : (
          <p className="mt-2 text-muted-foreground">
            ต้องมีข้อมูลอย่างน้อย {TRAIN_DAYS + TEST_DAYS} วันและตั้งต้นทุนครบจึงทดสอบย้อนหลังได้
          </p>
        )}

        <h3 className="mt-6 mb-2 font-semibold">ประวัติการตัดสินใจ</h3>
        {decisions?.length ? (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-xl text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-2 font-medium">เวลา</th>
                  <th className="p-2 font-medium">ผู้อนุมัติ</th>
                  <th className="p-2 font-medium">ระบบแนะนำ</th>
                  <th className="p-2 font-medium">อนุมัติ</th>
                  <th className="p-2 font-medium">เงื่อนไข</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((decision) => (
                  <tr key={decision.id} className="border-t">
                    <td className="p-2 whitespace-nowrap">
                      {formatDate(decision.created_at)} {formatTime(decision.created_at)}
                    </td>
                    <td className="p-2">{decision.profiles?.full_name || "–"}</td>
                    <td className="p-2">
                      {decision.recommended_option} · {formatQty(decision.recommended_qty, unit)}
                    </td>
                    <td className="p-2">
                      {decision.approved_option} · {formatQty(decision.approved_qty, unit)}
                      {decision.approved_option !== decision.recommended_option ||
                      decision.approved_qty !== decision.recommended_qty ? (
                        <span className="ml-1 text-xs text-amber-800">ต่างจากที่แนะนำ</span>
                      ) : null}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      บริการ {decision.service_level}% · ปรับ{" "}
                      {decision.demand_adjust_pct > 0 ? "+" : ""}
                      {decision.demand_adjust_pct}% · d {formatQty(decision.d)} · σ{" "}
                      {formatQty(decision.sigma)} · ROP {formatQty(decision.rop)} · เหลือ{" "}
                      {formatQty(decision.on_hand)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground">ยังไม่มีการอนุมัติ</p>
        )}
      </section>
    </>
  );
}

export default function DecisionPage(props: PageProps<"/admin/stock/planning/[id]">) {
  return (
    <AdminSection path="/admin/stock/planning">
      <Decision {...props} />
    </AdminSection>
  );
}
