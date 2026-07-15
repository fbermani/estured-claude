import { redirect } from "next/navigation";

/**
 * Este catálogo plano quedó absorbido por `/search` (Ciclo 34undevicies)
 * — `/search` ahora lee de `lib/residences/catalog.ts` (datos reales) en
 * vez del mock del ciclo 0, y ya tenía los filtros que acá faltaban.
 * Se deja el redirect en vez de borrar la ruta porque hay links
 * existentes a `/residencias` (ver `app/students/applications/page.tsx`).
 */
export default function RealResidencesPage() {
  redirect("/search");
}
