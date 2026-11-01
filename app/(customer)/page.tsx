import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">
        <h1 className="text-2xl font-semibold">ภาพยนตร์ที่กำลังฉาย</h1>
        <p className="mt-2 text-muted-foreground">
          รายการหนังและรอบฉายจะแสดงที่นี่ในเฟส 3
        </p>
      </main>
    </>
  );
}
