"use client";

import { useActionState, useMemo, useState } from "react";
import { FormMessage } from "@/components/admin/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/admin/actions";
import { approveReorder } from "@/lib/dss/actions";
import {
  buildOptions,
  DAYS_PER_YEAR,
  explain,
  OPTION_LABEL,
  SERVICE_LEVELS,
  type OptionKey,
  type ReorderOption,
  type ServiceLevel,
} from "@/lib/dss/inventory";
import type { Ingredient } from "@/lib/dss/queries";
import { cn } from "@/lib/utils";
import { formatPercent, formatQty, StatusBadge } from "./parts";

const initialState: FormState = {};

function baht(value: number): string {
  return `${Math.round(value).toLocaleString("th-TH")} บาท`;
}

function number(value: number, digits = 2): string {
  return value.toLocaleString("th-TH", { maximumFractionDigits: digits });
}

export function DecisionWorkbench({
  ingredient,
  usage,
  lookback,
  initialServiceLevel,
}: {
  ingredient: Ingredient;
  usage: number[];
  lookback: number;
  initialServiceLevel: ServiceLevel;
}) {
  const [adjust, setAdjust] = useState(0);
  const [serviceLevel, setServiceLevel] = useState(initialServiceLevel);
  const [leadTime, setLeadTime] = useState(ingredient.lead_time_days);
  const [orderCost, setOrderCost] = useState(ingredient.order_cost);
  const [customOption, setCustomOption] = useState<OptionKey>();
  const [state, formAction, pending] = useActionState(approveReorder, initialState);

  const plan = useMemo(
    () =>
      buildOptions({
        usage,
        onHand: ingredient.quantity_on_hand,
        reorderLevel: ingredient.reorder_level,
        unitCost: ingredient.unit_cost,
        orderCost,
        holdingRate: ingredient.holding_rate,
        leadTimeDays: leadTime,
        discountMinQty: ingredient.discount_min_qty,
        discountPct: ingredient.discount_pct,
        serviceLevel,
        demandAdjustPct: adjust,
      }),
    [usage, ingredient, orderCost, leadTime, serviceLevel, adjust],
  );

  const { unit } = ingredient;
  const recommended = plan.recommended;
  const selected =
    plan.options.find((option) => option.key === customOption) ?? recommended;
  const changed =
    adjust !== 0 ||
    serviceLevel !== initialServiceLevel ||
    leadTime !== ingredient.lead_time_days ||
    orderCost !== ingredient.order_cost;

  const context = (
    <>
      <input type="hidden" name="ingredient_id" value={ingredient.id} />
      <input type="hidden" name="lookback" value={lookback} />
      <input type="hidden" name="service_level" value={serviceLevel} />
      <input type="hidden" name="demand_adjust_pct" value={adjust} />
      <input type="hidden" name="lead_time_days" value={leadTime} />
      <input type="hidden" name="order_cost" value={orderCost} />
    </>
  );

  const card = (option: ReorderOption) => {
    const isRecommended = option.key === recommended?.key;
    return (
      <div
        key={option.key}
        className={cn(
          "flex flex-col gap-2 rounded-lg border p-3",
          isRecommended && "border-sky-600 ring-2 ring-sky-600/30",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-semibold">
              {option.key} · {OPTION_LABEL[option.key]}
            </div>
            <div className="text-xs text-muted-foreground">
              {
                {
                  A: `สั่งเมื่อเหลือ ≤ จุดแจ้งเตือน ครั้งละ 7 วัน`,
                  B: "สั่ง Q* เมื่อถึง ROP ที่รวมของสำรอง",
                  C: `ซื้อ ≥ ${formatQty(ingredient.discount_min_qty ?? 0, unit)} ลด ${ingredient.discount_pct}%`,
                }[option.key]
              }
            </div>
          </div>
          {isRecommended ? (
            <span className="rounded-md bg-sky-600 px-2 py-0.5 text-xs font-medium text-white">
              แนะนำ
            </span>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">สั่งครั้งละ</dt>
          <dd className="text-right tabular-nums">
            {formatQty(option.orderQty, unit)}
            <div className="text-xs text-muted-foreground">
              พอใช้ {number(option.daysCovered, 1)} วัน
            </div>
          </dd>
          <dt className="text-muted-foreground">จุดสั่ง</dt>
          <dd className="text-right tabular-nums">{formatQty(option.reorderPoint, unit)}</dd>
          <dt className="text-muted-foreground">ต้นทุนรวม/ปี</dt>
          <dd className="text-right font-semibold tabular-nums">{baht(option.cost.total)}</dd>
          <dt className="text-muted-foreground">สั่ง + เก็บ + สำรอง</dt>
          <dd className="text-right tabular-nums">{baht(option.cost.relevant)}</dd>
          <dt className="text-muted-foreground">โอกาสไม่ขาด/รอบ</dt>
          <dd
            className={cn(
              "text-right font-semibold tabular-nums",
              option.meetsTarget ? "text-emerald-700" : "text-red-700",
            )}
          >
            {formatPercent(option.serviceProbability)}
          </dd>
        </dl>
        {!isRecommended ? (
          <form action={formAction} className="mt-auto">
            {context}
            <input type="hidden" name="option" value={option.key} />
            <input type="hidden" name="quantity" value={option.orderQty} />
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              เลือกทางเลือกนี้
            </Button>
          </form>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <section aria-labelledby="design-heading" className="mt-8">
        <h2 id="design-heading" className="text-lg font-semibold">
          2. Design: สร้างและเทียบทางเลือก
        </h2>

        <div className="mt-3 grid gap-4 rounded-lg border bg-muted/40 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="what-if-adjust">
              ปรับคาดการณ์ {adjust > 0 ? "+" : ""}
              {adjust}%
            </Label>
            <input
              id="what-if-adjust"
              type="range"
              min={-30}
              max={60}
              step={5}
              value={adjust}
              onChange={(event) => setAdjust(Number(event.target.value))}
              className="accent-sky-700"
            />
            <span className="text-xs text-muted-foreground">
              เช่น +40% ช่วงหนังฟอร์มใหญ่เข้า
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium" id="what-if-level">
              ระดับบริการ
            </span>
            <div className="flex gap-1" role="group" aria-labelledby="what-if-level">
              {SERVICE_LEVELS.map((level) => (
                <Button
                  key={level}
                  type="button"
                  size="sm"
                  variant={serviceLevel === level ? "default" : "outline"}
                  aria-pressed={serviceLevel === level}
                  onClick={() => setServiceLevel(level)}
                >
                  {level}%
                </Button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">z = {plan.z}</span>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="what-if-lead">รอของ L (วัน)</Label>
            <Input
              id="what-if-lead"
              type="number"
              min={0}
              max={60}
              value={leadTime}
              onChange={(event) =>
                setLeadTime(Math.min(60, Math.max(0, Math.round(Number(event.target.value) || 0))))
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="what-if-order-cost">ค่าสั่งต่อครั้ง F (บาท)</Label>
            <Input
              id="what-if-order-cost"
              type="number"
              min={0}
              value={orderCost}
              onChange={(event) => setOrderCost(Math.max(0, Number(event.target.value) || 0))}
            />
          </div>
          {changed ? (
            <div className="sm:col-span-2 lg:col-span-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAdjust(0);
                  setServiceLevel(initialServiceLevel);
                  setLeadTime(ingredient.lead_time_days);
                  setOrderCost(ingredient.order_cost);
                }}
              >
                กลับเป็นค่าเริ่มต้น
              </Button>
            </div>
          ) : null}
        </div>

        {plan.options.length ? (
          <div
            className={cn(
              "mt-3 grid gap-3",
              plan.options.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2",
            )}
          >
            {plan.options.map(card)}
          </div>
        ) : (
          <p className="mt-3 text-muted-foreground">ไม่มีการใช้ในช่วงนี้ จึงยังไม่มีทางเลือก</p>
        )}

        {!plan.missingCost && plan.d > 0 ? (
          <details className="mt-3 rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer font-medium">
              ดูสูตรและการแทนค่า (Q*, SS, ROP)
            </summary>
            <div className="mt-2 font-mono leading-7">
              <div>
                d = {number(plan.d)} {unit}/วัน, σ = {number(plan.sigma)}, D = d × {DAYS_PER_YEAR} ={" "}
                {number(plan.annualDemand, 0)}, H = C × I = {number(ingredient.unit_cost, 4)} ×{" "}
                {number(ingredient.holding_rate, 4)} = {number(plan.holdingCost, 4)} บาท/หน่วย/ปี
              </div>
              <div>
                Q* = √(2FD/H) = √(2 × {number(orderCost)} × {number(plan.annualDemand, 0)} ÷{" "}
                {number(plan.holdingCost, 4)}) = <strong>{formatQty(plan.eoq, unit)}</strong>
              </div>
              <div>
                SS = z × σ × √L = {plan.z} × {number(plan.sigma)} × √{leadTime} ={" "}
                <strong>{formatQty(plan.safetyStock, unit)}</strong>
              </div>
              <div>
                ROP = d × L + SS = {number(plan.d)} × {leadTime} + {number(plan.safetyStock)} ={" "}
                <strong>{formatQty(plan.reorderPoint, unit)}</strong>
              </div>
            </div>
          </details>
        ) : null}
      </section>

      <section aria-labelledby="choice-heading" className="mt-8">
        <h2 id="choice-heading" className="text-lg font-semibold">
          3. Choice: เลือกและอนุมัติ
        </h2>
        <div className="mt-3 rounded-lg border border-sky-600 bg-sky-50 p-3 text-sky-950">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <StatusBadge status={plan.status} />
            {changed ? (
              <span className="text-xs text-sky-900">คำนวณจากค่า What-if ที่ปรับไว้</span>
            ) : null}
          </div>
          <p>{explain(plan, ingredient.quantity_on_hand, leadTime, unit)}</p>
          {recommended?.key === "C" ? (
            <p className="mt-2 text-sm">
              เงื่อนไข: ต้องมีที่เก็บ {formatQty(recommended.orderQty, unit)} ซึ่งพอใช้ราว{" "}
              {number(recommended.daysCovered, 0)} วัน ตรวจพื้นที่เก็บและอายุของวัตถุดิบก่อนอนุมัติ
            </p>
          ) : null}
          {recommended && plan.options.some((option) => !option.meetsTarget) ? (
            <p className="mt-2 text-sm">
              ทางเลือกที่โอกาสไม่ขาดต่ำกว่า {serviceLevel}% จะไม่ถูกแนะนำ แม้ต้นทุนต่ำกว่า
            </p>
          ) : null}
        </div>

        {recommended ? (
          <div className="mt-3 flex flex-col gap-3">
            <form action={formAction}>
              {context}
              <input type="hidden" name="option" value={recommended.key} />
              <input type="hidden" name="quantity" value={recommended.orderQty} />
              <Button type="submit" disabled={pending}>
                อนุมัติทางเลือกที่แนะนำ ({recommended.key} · {formatQty(recommended.orderQty, unit)})
              </Button>
            </form>

            <form
              action={formAction}
              className="flex flex-wrap items-end gap-2 rounded-lg border p-3"
            >
              {context}
              <div className="flex flex-col gap-2">
                <Label htmlFor="custom-option">ทางเลือก</Label>
                <select
                  id="custom-option"
                  name="option"
                  value={selected?.key}
                  onChange={(event) => setCustomOption(event.target.value as OptionKey)}
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  {plan.options.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.key} · {OPTION_LABEL[option.key]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="custom-quantity">จำนวน ({unit})</Label>
                <Input
                  key={`${selected?.key}-${selected?.orderQty}`}
                  id="custom-quantity"
                  name="quantity"
                  type="number"
                  min={1}
                  step="any"
                  defaultValue={selected?.orderQty}
                  className="w-40"
                  required
                />
              </div>
              <Button type="submit" variant="outline" disabled={pending}>
                แก้จำนวนแล้วอนุมัติ
              </Button>
            </form>
            <FormMessage state={state} />
          </div>
        ) : null}
      </section>
    </>
  );
}
