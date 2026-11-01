import type { Metadata } from "next";
import { AdminSection } from "@/components/admin/admin-section";
import { controlClass } from "@/components/admin/form-parts";
import { Button } from "@/components/ui/button";
import { setUserRole } from "@/lib/admin/actions";
import { ROLE_LABEL, ROLES } from "@/lib/auth/roles";
import { getCurrentProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ผู้ใช้" };

const MAX_USERS = 200;

async function Users() {
  const current = await getCurrentProfile();
  const supabase = await createClient();

  const [{ data: profiles }, { data: authUsers }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, phone, role")
      .order("created_at", { ascending: false })
      .limit(MAX_USERS),
    createAdminClient().auth.admin.listUsers({ perPage: MAX_USERS }),
  ]);

  const emailOf = new Map(authUsers.users.map((user) => [user.id, user.email]));

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">ผู้ใช้และสิทธิ์</h1>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-2xl text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-2 font-medium">ชื่อ</th>
              <th className="p-2 font-medium">อีเมล</th>
              <th className="p-2 font-medium">เบอร์โทร</th>
              <th className="p-2 font-medium">บทบาท</th>
            </tr>
          </thead>
          <tbody>
            {profiles?.map((profile) => (
              <tr key={profile.id} className="border-t">
                <td className="p-2">{profile.full_name || "-"}</td>
                <td className="p-2">{emailOf.get(profile.id) ?? "-"}</td>
                <td className="p-2">{profile.phone ?? "-"}</td>
                <td className="p-2">
                  {profile.id === current?.id ? (
                    <span>{ROLE_LABEL[profile.role]} (คุณ)</span>
                  ) : (
                    <form action={setUserRole} className="flex gap-2">
                      <input type="hidden" name="id" value={profile.id} />
                      <select
                        key={profile.role}
                        name="role"
                        aria-label={`บทบาทของ ${profile.full_name}`}
                        defaultValue={profile.role}
                        className={controlClass}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABEL[role]}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" variant="outline" size="sm">
                        บันทึก
                      </Button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function UsersPage() {
  return (
    <AdminSection path="/admin/users">
      <Users />
    </AdminSection>
  );
}
