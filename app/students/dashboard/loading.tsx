import { Skeleton } from "@/components/ui/Skeleton";

/** Esqueleto del dashboard del estudiante con la forma final: hero, franja de estadía y lista de «Tu espacio». */
export default function StudentDashboardLoading() {
  return (
    <div className="tone-student mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Skeleton shape="block" className="h-40 !rounded-[30px] md:h-44" />
      <Skeleton shape="block" className="mt-6 h-[88px]" />
      <Skeleton shape="block" className="mt-6 h-36" />
      <div className="kit-skel mt-8 h-6 w-32 rounded-md" />
      <Skeleton shape="block" className="mt-3 h-24" />
      <Skeleton shape="block" className="mt-3 h-72" />
    </div>
  );
}
