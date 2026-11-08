import { Skeleton } from "@/components/ui/Skeleton";

/** Esqueleto de carga del kit logueado: mismo ritmo que la pantalla (encabezado + contenido) para evitar saltos. */
export default function Loading() {
  return (
    <div className="tone-student mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Skeleton shape="block" className="h-36 !rounded-card md:h-40" />
      <Skeleton shape="card" rows={3} className="mt-6" />
    </div>
  );
}
