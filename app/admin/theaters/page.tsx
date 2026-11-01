import type { Metadata } from "next";
import Link from "next/link";
import { AdminSection } from "@/components/admin/admin-section";
import { TheaterForm } from "@/components/admin/theater-form";
import { Button } from "@/components/ui/button";
import { setTheaterActive } from "@/lib/admin/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "โรงและผังที่นั่ง" };

async function TheaterList() {
  const supabase = await createClient();
  const { data: theaters } = await supabase
    .from("theaters")
    .select("id, name, is_active, seats(count)")
    .order("name");

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">โรงและผังที่นั่ง</h1>
      <TheaterForm />
      {theaters?.length ? (
        <ul className="mt-4 divide-y rounded-lg border">
          {theaters.map((theater) => (
            <li key={theater.id} className="flex items-center gap-3 p-3">
              <Link
                href={`/admin/theaters/${theater.id}`}
                className="min-w-0 flex-1 hover:underline"
              >
                <span className="font-medium">{theater.name}</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  {theater.seats[0]?.count ?? 0} ที่นั่ง
                  {theater.is_active ? "" : " · ปิดใช้งาน"}
                </span>
              </Link>
              <form action={setTheaterActive}>
                <input type="hidden" name="id" value={theater.id} />
                <input
                  type="hidden"
                  name="is_active"
                  value={String(!theater.is_active)}
                />
                <Button type="submit" variant="outline">
                  {theater.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-muted-foreground">ยังไม่มีโรงในระบบ</p>
      )}
    </>
  );
}

export default function TheatersPage() {
  return (
    <AdminSection path="/admin/theaters">
      <TheaterList />
    </AdminSection>
  );
}
