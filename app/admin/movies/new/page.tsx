import type { Metadata } from "next";
import { AdminSection } from "@/components/admin/admin-section";
import { MovieForm } from "@/components/admin/movie-form";

export const metadata: Metadata = { title: "เพิ่มหนัง" };

export default function NewMoviePage() {
  return (
    <AdminSection path="/admin/movies/new">
      <h1 className="mb-4 text-2xl font-semibold">เพิ่มหนัง</h1>
      <MovieForm />
    </AdminSection>
  );
}
