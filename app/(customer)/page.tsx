import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

type Movie = Pick<
  Tables<"movies">,
  "id" | "title" | "duration_min" | "rating" | "poster_url" | "status"
>;

function MovieGrid({ title, movies }: { title: string; movies: Movie[] }) {
  if (!movies.length) return null;

  return (
    <section className="mt-6">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {movies.map((movie) => (
          <li key={movie.id}>
            <Link href={`/movies/${movie.id}`} className="group block">
              {movie.poster_url ? (
                <Image
                  src={movie.poster_url}
                  alt=""
                  width={300}
                  height={420}
                  loading="eager"
                  className="aspect-[5/7] w-full rounded-lg object-cover"
                />
              ) : (
                <div className="flex aspect-[5/7] items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
                  ไม่มีโปสเตอร์
                </div>
              )}
              <div className="mt-2 font-medium group-hover:underline">
                {movie.title}
              </div>
              <div className="text-sm text-muted-foreground">
                {movie.duration_min} นาที
                {movie.rating ? ` · ${movie.rating}` : ""}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function MovieResults({
  searchParams,
}: Pick<PageProps<"/">, "searchParams">) {
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.trim() : "";

  const supabase = await createClient();
  let query = supabase
    .from("movies")
    .select("id, title, duration_min, rating, poster_url, status")
    .neq("status", "ended")
    .order("title");
  if (search) query = query.ilike("title", `%${search}%`);

  const { data: movies } = await query;

  return (
    <>
      <form className="mt-4 flex max-w-md gap-2">
        <Input
          key={search}
          type="search"
          name="q"
          aria-label="ค้นหาหนัง"
          placeholder="ค้นหาหนัง"
          defaultValue={search}
        />
        <Button type="submit" variant="outline">
          ค้นหา
        </Button>
      </form>

      {movies?.length ? (
        <>
          <MovieGrid
            title="กำลังฉาย"
            movies={movies.filter((movie) => movie.status === "now_showing")}
          />
          <MovieGrid
            title="เร็ว ๆ นี้"
            movies={movies.filter((movie) => movie.status === "coming_soon")}
          />
        </>
      ) : (
        <p className="mt-6 text-muted-foreground">ไม่พบหนังที่ค้นหา</p>
      )}
    </>
  );
}

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">
        <h1 className="text-2xl font-semibold">ภาพยนตร์</h1>
        <Suspense
          fallback={<p className="mt-4 text-muted-foreground">กำลังโหลด…</p>}
        >
          <MovieResults searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}
