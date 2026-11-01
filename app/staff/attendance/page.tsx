import type { Metadata } from "next";
import { AttendanceButtons } from "@/components/staff/attendance-buttons";
import { StaffSection } from "@/components/staff/staff-section";
import { formatDate, formatTime } from "@/lib/admin/format";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ลงเวลางาน" };

async function Attendance() {
  const profile = await getCurrentProfile();
  const staffId = profile?.id ?? "";
  const supabase = await createClient();

  const [{ data: records }, { data: shifts }] = await Promise.all([
    supabase
      .from("attendance")
      .select("id, clock_in, clock_out")
      .eq("staff_id", staffId)
      .order("clock_in", { ascending: false })
      .limit(10),
    supabase
      .from("shifts")
      .select("id, starts_at, ends_at")
      .eq("staff_id", staffId)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at")
      .limit(10),
  ]);

  const openRecord = records?.find((record) => !record.clock_out);

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">ลงเวลางาน</h1>
        <p className="text-muted-foreground">
          {openRecord
            ? `เข้างานเมื่อ ${formatTime(openRecord.clock_in)} น.`
            : "ยังไม่ได้ลงเวลาเข้างาน"}
        </p>
        <AttendanceButtons working={Boolean(openRecord)} />

        <h2 className="mt-4 font-semibold">ประวัติล่าสุด</h2>
        {records?.length ? (
          <ul className="divide-y rounded-lg border text-sm">
            {records.map((record) => (
              <li key={record.id} className="flex justify-between gap-3 p-2">
                <span>{formatDate(record.clock_in)}</span>
                <span>
                  {formatTime(record.clock_in)} –{" "}
                  {record.clock_out ? formatTime(record.clock_out) : "ยังไม่ออก"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">ยังไม่มีประวัติ</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-semibold">กะของฉัน</h2>
        {shifts?.length ? (
          <ul className="divide-y rounded-lg border text-sm">
            {shifts.map((shift) => (
              <li key={shift.id} className="flex justify-between gap-3 p-2">
                <span>{formatDate(shift.starts_at)}</span>
                <span>
                  {formatTime(shift.starts_at)} – {formatTime(shift.ends_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">ยังไม่มีกะ</p>
        )}
      </section>
    </div>
  );
}

export default function AttendancePage() {
  return (
    <StaffSection path="/staff/attendance">
      <Attendance />
    </StaffSection>
  );
}
