"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormMessage } from "@/components/admin/form-parts";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/admin/actions";
import { clockIn, clockOut } from "@/lib/member/actions";

export function AttendanceButtons({ working }: { working: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<FormState>({});
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<FormState>) {
    startTransition(async () => {
      const result = await action();
      setState(result);
      if (!result.error) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        size="lg"
        disabled={pending}
        variant={working ? "outline" : "default"}
        onClick={() => run(working ? clockOut : clockIn)}
      >
        {working ? "ลงเวลาออกงาน" : "ลงเวลาเข้างาน"}
      </Button>
      <FormMessage state={state} />
    </div>
  );
}
