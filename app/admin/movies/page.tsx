import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AdminSection } from "@/components/admin/admin-section";
import { buttonVariants } from "@/components/ui/button";
import { MOVIE_STATUS_LABEL } from "@/lib/admin/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "จัดการหนัง" };

async function MovieList() {
  const supabase = await createClient();
  const { data: movies } = await supabase
    .from("movies")
    .select("id, title, duration_min, rating, poster_url, status")
    .order("created_at", { ascending: false });

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">หนัง</h1>
        <Link href="/admin/movies/new" className={buttonVariants()}>
          เพิ่มหนัง
        </Link>
      </div>
      {movies?.length ? (
        <ul className="mt-4 divide-y rounded-lg border">
          {movies.map((movie) => (
            <li key={movie.id}>
              <Link
                href={`/admin/movies/${movie.id}`}
                className="flex items-center gap-3 p-3 hover:bg-muted"
              >
                {movie.poster_url ? (
                  <Image
                    src={movie.poster_url}
                    alt=""
                    width={40}
                    height={56}
                    className="h-14 w-10 rounded object-cover"
                  />
                ) : (
                  <div className="h-14 w-10 rounded bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{movie.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {movie.duration_min} นาที
                    {movie.rating ? ` · ${movie.rating}` : ""}
                  </div>
                </div>
                <span className="text-sm">
                  {MOVIE_STATUS_LABEL[movie.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-muted-foreground">ยังไม่มีหนังในระบบ</p>
      )}
    </>
  );
}

export default function MoviesPage() {
  return (
    <AdminSection path="/admin/movies">
      <MovieList />
    </AdminSection>
  );
}
