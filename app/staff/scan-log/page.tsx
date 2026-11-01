import type { Metadata } from "next";
import { StaffSection } from "@/components/staff/staff-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  bangkokDate,
  formatTime,
  nextDate,
  toBangkokIso,
} from "@/lib/admin/format";
import { scanResultLabel } from "@/lib/pos/scan-results";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "ประวัติการสแกน" };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROWS = 500;

async function ScanLog({
  searchParams,
}: Pick<PageProps<"/staff/scan-log">, "searchParams">) {
  const { date: requestedDate } = await searchParams;
  const date =
    typeof requestedDate === "string" && DATE_PATTERN.test(requestedDate)
      ? requestedDate
      : bangkokDate(new Date());

  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("scan_logs")
    .select(
      "id, result, input_hint, created_at, profiles(full_name), tickets(seats(row_label, seat_number), orders(order_no), showtimes(movies(title), theaters(name)))",
    )
    .gte("created_at", toBangkokIso(date, "00:00"))
    .lt("created_at", toBangkokIso(nextDate(date), "00:00"))
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  const passed = logs?.filter((log) => log.result === "ok").length ?? 0;
  const failed = (logs?.length ?? 0) - passed;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">ประวัติการสแกน</h1>
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

      <dl className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-3">
          <dt className="text-sm text-muted-foreground">ทั้งหมด</dt>
          <dd className="text-2xl font-semibold">{logs?.length ?? 0}</dd>
        </div>
        <div className="rounded-lg border p-3">
          <dt className="text-sm text-muted-foreground">ผ่าน</dt>
          <dd className="text-2xl font-semibold">{passed}</dd>
        </div>
        <div className="rounded-lg border p-3">
          <dt className="text-sm text-muted-foreground">ไม่ผ่าน</dt>
          <dd className="text-2xl font-semibold">{failed}</dd>
        </div>
      </dl>

      {logs?.length ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-2xl text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-2 font-medium">เวลา</th>
                <th className="p-2 font-medium">ผล</th>
                <th className="p-2 font-medium">ตั๋ว</th>
                <th className="p-2 font-medium">คำสั่งซื้อ</th>
                <th className="p-2 font-medium">พนักงาน</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t">
                  <td className="p-2 whitespace-nowrap">
                    {formatTime(log.created_at)}
                  </td>
                  <td
                    className={cn(
                      "p-2 whitespace-nowrap font-medium",
                      log.result === "ok" ? "text-emerald-700" : "text-red-700",
                    )}
                  >
                    {scanResultLabel(log.result)}
                  </td>
                  <td className="p-2">
                    {log.tickets
                      ? `${log.tickets.showtimes.movies.title} · ${log.tickets.showtimes.theaters.name} · ที่นั่ง ${log.tickets.seats.row_label}${log.tickets.seats.seat_number}`
                      : `รหัส ${log.input_hint}…`}
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    {log.tickets?.orders.order_no ?? "-"}
                  </td>
                  <td className="p-2">{log.profiles?.full_name || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground">ไม่มีประวัติการสแกนในวันนี้</p>
      )}
      {logs?.length === MAX_ROWS ? (
        <p className="mt-2 text-sm text-muted-foreground">
          แสดง {MAX_ROWS} รายการล่าสุดของวันนี้
        </p>
      ) : null}
    </>
  );
}

export default function ScanLogPage({
  searchParams,
}: PageProps<"/staff/scan-log">) {
  return (
    <StaffSection path="/staff/scan-log">
      <ScanLog searchParams={searchParams} />
    </StaffSection>
  );
}
