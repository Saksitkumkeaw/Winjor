import type { Metadata } from "next";
import { ProfileForm } from "@/components/member/profile-form";
import { RoleSection } from "@/components/role-section";
import { formatDate, formatTime } from "@/lib/admin/format";
import { ROLES } from "@/lib/auth/roles";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "บัญชีของฉัน" };

const POINT_LABEL = {
  earn: "ได้รับคะแนน",
  redeem: "ใช้คะแนน",
  reverse: "ปรับคืนคะแนน",
};

async function Account() {
  const current = await getCurrentProfile();
  const supabase = await createClient();

  const [{ data: profile }, { data: history }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, points_balance")
      .eq("id", current?.id ?? "")
      .maybeSingle(),
    supabase
      .from("point_transactions")
      .select("id, points, type, created_at")
      .eq("profile_id", current?.id ?? "")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (!profile) return null;

  return (
    <>
      <h1 className="text-2xl font-semibold">บัญชีของฉัน</h1>
      <div className="mt-4 rounded-lg border p-4">
        <div className="text-sm text-muted-foreground">คะแนนสะสม</div>
        <div className="text-3xl font-semibold">{profile.points_balance}</div>
        <div className="mt-1 text-sm text-muted-foreground">
          ทุก 10 บาทได้ 1 คะแนน และ 100 คะแนนแลกส่วนลดได้ 20 บาท
        </div>
      </div>

      <h2 className="mt-6 mb-3 text-lg font-semibold">ข้อมูลส่วนตัว</h2>
      <ProfileForm fullName={profile.full_name} phone={profile.phone} />

      <h2 className="mt-6 mb-3 text-lg font-semibold">ประวัติคะแนน</h2>
      {history?.length ? (
        <ul className="divide-y rounded-lg border text-sm">
          {history.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 p-2">
              <span>
                {POINT_LABEL[item.type]}{" "}
                <span className="text-muted-foreground">
                  {formatDate(item.created_at)} {formatTime(item.created_at)}
                </span>
              </span>
              <span className="font-medium">
                {item.points > 0 ? "+" : ""}
                {item.points}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">ยังไม่มีประวัติคะแนน</p>
      )}
    </>
  );
}

export default function AccountPage() {
  return (
    <RoleSection section="บัญชีของฉัน" allowed={ROLES} path="/account">
      <Account />
    </RoleSection>
  );
}
