import type { Metadata } from "next";
import { AdminSection } from "@/components/admin/admin-section";
import { ShiftForm } from "@/components/admin/shift-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteShift } from "@/lib/admin/actions";
import {
  bangkokDate,
  formatTime,
  nextDate,
  toBangkokIso,
} from "@/lib/admin/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "กะงาน" };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

async function Shifts({
  searchParams,
}: Pick<PageProps<"/admin/shifts">, "searchParams">) {
  const { date: requestedDate } = await searchParams;
  const date =
    typeof requestedDate === "string" && DATE_PATTERN.test(requestedDate)
      ? requestedDate
      : bangkokDate(new Date());
  const dayStart = toBangkokIso(date, "00:00");
  const dayEnd = toBangkokIso(nextDate(date), "00:00");

  const supabase = await createClient();
  const [{ data: staff }, { data: shifts }, { data: records }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name")
        .in("role", ["staff", "admin"])
        .order("full_name"),
      supabase
        .from("shifts")
        .select("id, staff_id, starts_at, ends_at")
        .gte("starts_at", dayStart)
        .lt("starts_at", dayEnd)
        .order("starts_at"),
      supabase
        .from("attendance")
        .select("id, staff_id, clock_in, clock_out")
        .gte("clock_in", dayStart)
        .lt("clock_in", dayEnd)
        .order("clock_in"),
    ]);

  const nameOf = new Map(
    (staff ?? []).map((person) => [person.id, person.full_name || "ไม่มีชื่อ"]),
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">กะงาน</h1>
        <form className="flex items-center gap-2">
          <Input
            key={date}
            type="date"
            name="date"
            aria-label="วันที่"
            defaultValue={date}
          />
          <Button type="submit" variant="outline">
            ดู
          </Button>
        </form>
      </div>

      <ShiftForm staff={staff ?? []} date={date} />

      <h2 className="mt-6 mb-2 text-lg font-semibold">ตารางกะ</h2>
      {shifts?.length ? (
        <ul className="divide-y rounded-lg border">
          {shifts.map((shift) => (
            <li
              key={shift.id}
              className="flex items-center justify-between gap-3 p-3"
            >
              <span>
                {nameOf.get(shift.staff_id) ?? "ไม่มีชื่อ"}
                <span className="ml-2 text-sm text-muted-foreground">
                  {formatTime(shift.starts_at)} – {formatTime(shift.ends_at)}
                </span>
              </span>
              <form action={deleteShift}>
                <input type="hidden" name="id" value={shift.id} />
                <Button type="submit" variant="outline" size="sm">
                  ลบ
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">ไม่มีกะในวันนี้</p>
      )}

      <h2 className="mt-6 mb-2 text-lg font-semibold">การลงเวลา</h2>
      {records?.length ? (
        <ul className="divide-y rounded-lg border text-sm">
          {records.map((record) => (
            <li key={record.id} className="flex justify-between gap-3 p-2">
              <span>{nameOf.get(record.staff_id) ?? "ไม่มีชื่อ"}</span>
              <span>
                {formatTime(record.clock_in)} –{" "}
                {record.clock_out ? formatTime(record.clock_out) : "ยังไม่ออก"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">ไม่มีการลงเวลาในวันนี้</p>
      )}
    </>
  );
}

export default function ShiftsPage({
  searchParams,
}: PageProps<"/admin/shifts">) {
  return (
    <AdminSection path="/admin/shifts">
      <Shifts searchParams={searchParams} />
    </AdminSection>
  );
}
