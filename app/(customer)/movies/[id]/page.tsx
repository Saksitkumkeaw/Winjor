import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatTime } from "@/lib/admin/format";
import { createClient } from "@/lib/supabase/server";

async function MovieDetail({
  params,
}: Pick<PageProps<"/movies/[id]">, "params">) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: movie }, { data: showtimes }] = await Promise.all([
    supabase.from("movies").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("showtimes")
      .select("id, starts_at, theaters(name)")
      .eq("movie_id", id)
      .eq("status", "scheduled")
      .gt("starts_at", new Date().toISOString())
      .order("starts_at"),
  ]);

  if (!movie) notFound();

  const byDate = new Map<string, NonNullable<typeof showtimes>>();
  for (const showtime of showtimes ?? []) {
    const date = formatDate(showtime.starts_at);
    byDate.set(date, [...(byDate.get(date) ?? []), showtime]);
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row">
        {movie.poster_url ? (
          <Image
            src={movie.poster_url}
            alt=""
            width={200}
            height={280}
            className="h-auto w-40 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-56 w-40 shrink-0 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
            ไม่มีโปสเตอร์
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold">{movie.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {movie.duration_min} นาที
            {movie.rating ? ` · ${movie.rating}` : ""}
          </p>
          <p className="mt-3">{movie.synopsis}</p>
        </div>
      </div>

      <h2 className="mt-8 mb-3 text-lg font-semibold">รอบฉาย</h2>
      {byDate.size ? (
        <div className="flex flex-col gap-4">
          {[...byDate.entries()].map(([date, dayShowtimes]) => (
            <section key={date}>
              <h3 className="mb-2 font-medium">{date}</h3>
              <ul className="flex flex-wrap gap-2">
                {dayShowtimes.map((showtime) => (
                  <li key={showtime.id}>
                    <Link
                      href={`/showtimes/${showtime.id}`}
                      className={buttonVariants({ variant: "outline" })}
                    >
                      {formatTime(showtime.starts_at)}
                      <span className="text-muted-foreground">
                        {showtime.theaters.name}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">ยังไม่มีรอบฉาย</p>
      )}
    </>
  );
}

export default function MoviePage({ params }: PageProps<"/movies/[id]">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">
        <Suspense fallback={<p className="text-muted-foreground">กำลังโหลด…</p>}>
          <MovieDetail params={params} />
        </Suspense>
      </main>
    </>
  );
}
