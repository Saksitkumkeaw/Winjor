"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createShowtime, type FormState } from "@/lib/admin/actions";
import type { Tables } from "@/lib/supabase/database.types";
import { controlClass, Field, FormMessage } from "./form-parts";

const initialState: FormState = {};

export function ShowtimeForm({
  movies,
  theaters,
  date,
  movieId,
}: {
  movies: Pick<Tables<"movies">, "id" | "title">[];
  theaters: Pick<Tables<"theaters">, "id" | "name">[];
  date: string;
  movieId?: string;
}) {
  const [state, formAction, pending] = useActionState(
    createShowtime,
    initialState,
  );

  return (
    <form
      id="new-showtime"
      action={formAction}
      className="flex scroll-mt-4 flex-col gap-3 rounded-lg border p-3"
    >
      <h2 className="font-medium">เพิ่มรอบฉาย</h2>
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
        <Field label="หนัง" htmlFor="movie_id">
          <select
            key={movieId}
            id="movie_id"
            name="movie_id"
            className={controlClass}
            defaultValue={movieId ?? ""}
            required
          >
            <option value="">เลือกหนัง</option>
            {movies.map((movie) => (
              <option key={movie.id} value={movie.id}>
                {movie.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="โรง" htmlFor="theater_id">
          <select
            id="theater_id"
            name="theater_id"
            className={controlClass}
            required
          >
            <option value="">เลือกโรง</option>
            {theaters.map((theater) => (
              <option key={theater.id} value={theater.id}>
                {theater.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="วันที่" htmlFor="date">
          <Input
            key={date}
            id="date"
            name="date"
            type="date"
            defaultValue={date}
            required
          />
        </Field>
        <Field label="เวลา" htmlFor="time">
          <Input id="time" name="time" type="time" required />
        </Field>
        <Field label="ราคาพื้นฐาน" htmlFor="base_price">
          <Input
            id="base_price"
            name="base_price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={180}
            required
          />
        </Field>
        <Button type="submit" disabled={pending}>
          เพิ่มรอบ
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
