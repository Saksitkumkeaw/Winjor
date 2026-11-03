"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/admin/form-parts";
import { Button } from "@/components/ui/button";
import { endMovieRun, type FormState } from "@/lib/admin/actions";

const initialState: FormState = {};

export function EndMovieButton({
  movieId,
  title,
  upcoming,
}: {
  movieId: string;
  title: string;
  // จำนวนรอบที่ยังไม่ฉาย ถ้าไม่รู้ให้เป็น null
  upcoming: number | null;
}) {
  const [state, formAction, pending] = useActionState(endMovieRun, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const message = `ให้ "${title}" ออกโรง?\n\nหน้าเว็บลูกค้าจะไม่แสดงเรื่องนี้ และรอบที่ยังไม่มีคนจอง${
          upcoming ? ` (จาก ${upcoming} รอบที่จะถึง)` : ""
        }จะถูกยกเลิก ส่วนรอบที่มีคนจองแล้วยังฉายตามเดิม`;
        if (!window.confirm(message)) event.preventDefault();
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="movie_id" value={movieId} />
      {state.notice ? null : (
        <Button type="submit" variant="destructive" size="sm" disabled={pending}>
          ให้ออกโรง
        </Button>
      )}
      <FormMessage state={state} />
    </form>
  );
}
