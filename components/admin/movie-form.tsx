"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveMovie, type FormState } from "@/lib/admin/actions";
import { MOVIE_STATUS_LABEL } from "@/lib/admin/format";
import { posterExtension } from "@/lib/admin/validation";
import type { Tables } from "@/lib/supabase/database.types";
import { controlClass, Field, FormMessage } from "./form-parts";

const initialState: FormState = {};

export function MovieForm({ movie }: { movie?: Tables<"movies"> }) {
  const [state, formAction, pending] = useActionState(saveMovie, initialState);
  const [posterError, setPosterError] = useState<string>();

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      {movie ? <input type="hidden" name="id" value={movie.id} /> : null}
      <Field label="ชื่อหนัง" htmlFor="title">
        <Input id="title" name="title" defaultValue={movie?.title} required />
      </Field>
      <Field label="เรื่องย่อ" htmlFor="synopsis">
        <textarea
          id="synopsis"
          name="synopsis"
          rows={4}
          defaultValue={movie?.synopsis}
          className={`${controlClass} h-auto py-2`}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ความยาว (นาที)" htmlFor="duration_min">
          <Input
            id="duration_min"
            name="duration_min"
            type="number"
            min={1}
            defaultValue={movie?.duration_min}
            required
          />
        </Field>
        <Field label="เรตติ้ง" htmlFor="rating">
          <Input
            id="rating"
            name="rating"
            placeholder="เช่น น 15+"
            defaultValue={movie?.rating}
          />
        </Field>
        <Field label="วันที่เข้าฉาย" htmlFor="release_date">
          <Input
            id="release_date"
            name="release_date"
            type="date"
            defaultValue={movie?.release_date ?? ""}
          />
        </Field>
        <Field label="สถานะ" htmlFor="status">
          <select
            id="status"
            name="status"
            defaultValue={movie?.status ?? "coming_soon"}
            className={controlClass}
          >
            {Object.entries(MOVIE_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="โปสเตอร์ (JPG, PNG, WebP ไม่เกิน 900 KB)" htmlFor="poster">
        <Input
          id="poster"
          name="poster"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            const result = file ? posterExtension(file) : null;
            if (result && !result.ok) {
              setPosterError(result.error);
              event.target.value = "";
            } else {
              setPosterError(undefined);
            }
          }}
        />
      </Field>
      <FormMessage state={posterError ? { error: posterError } : state} />
      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </div>
    </form>
  );
}
