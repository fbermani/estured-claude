import { Skeleton } from "@/components/ui/Skeleton";

/** Esqueleto del dashboard del estudiante: hero, camino y módulos, del mismo tamaño que el contenido real. */
export default function StudentDashboardLoading() {
  return (
    <div className="tone-student mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Skeleton shape="block" className="h-40 !rounded-[30px] md:h-44" />
      <Skeleton shape="block" className="mt-6 h-44" />
      <Skeleton shape="card" rows={6} className="mt-8" />
    </div>
  );
}
