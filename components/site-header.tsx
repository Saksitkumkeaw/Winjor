import Link from "next/link";
import { Suspense } from "react";
import { UserMenu } from "@/components/user-menu";

export function SiteHeader({ section }: { section?: string }) {
  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b px-4">
      <div className="flex items-baseline gap-2">
        <Link href="/" className="font-semibold">
          Winjor Cinema
        </Link>
        {section ? (
          <span className="text-sm text-muted-foreground">{section}</span>
        ) : null}
      </div>
      <Suspense fallback={<div className="h-8 w-24" />}>
        <UserMenu />
      </Suspense>
    </header>
  );
}
