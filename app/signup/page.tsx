import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";
import { SiteHeader } from "@/components/site-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "สมัครสมาชิก" };

export default function SignupPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>สมัครสมาชิก</CardTitle>
          </CardHeader>
          <CardContent>
            <SignupForm />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
