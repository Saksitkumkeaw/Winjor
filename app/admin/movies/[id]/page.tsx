import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminSection } from "@/components/admin/admin-section";
import { MovieForm } from "@/components/admin/movie-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "แก้ไขหนัง" };

async function EditMovie({ params }: Pick<PageProps<"/admin/movies/[id]">, "params">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: movie } = await supabase
    .from("movies")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!movie) notFound();

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">แก้ไขหนัง</h1>
      <MovieForm key={movie.id} movie={movie} />
    </>
  );
}

export default function EditMoviePage({ params }: PageProps<"/admin/movies/[id]">) {
  return (
    <AdminSection path="/admin/movies">
      <EditMovie params={params} />
    </AdminSection>
  );
}
