import { Skeleton } from "@/components/ui/Skeleton";

/** Esqueleto del dashboard admin (tono neutro): encabezado y grilla de métricas. */
export default function AdminDashboardLoading() {
  return (
    <div className="tone-admin p-8">
      <Skeleton shape="block" className="mb-6 h-36 !rounded-card" />
      <Skeleton shape="card" rows={6} />
    </div>
  );
}
