import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { SiteHeader } from "@/components/site-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { safeNextPath } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

async function LoginFormWithParams({
  searchParams,
}: Pick<PageProps<"/login">, "searchParams">) {
  const { next, error } = await searchParams;
  const safeNext = safeNextPath(next, "");

  return (
    <LoginForm
      next={safeNext || undefined}
      error={
        error === "confirm"
          ? "ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุ กรุณาลองใหม่อีกครั้ง"
          : undefined
      }
    />
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>เข้าสู่ระบบ</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense>
              <LoginFormWithParams searchParams={searchParams} />
            </Suspense>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
