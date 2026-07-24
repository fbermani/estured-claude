/**
 * Skeleton del hub de Inicio (Ciclo 40) — Next.js App Router lo muestra
 * automáticamente mientras `page.tsx` resuelve sus queries en el
 * servidor, sin JS ni estado de carga manual. Aproximado a la forma
 * final (header + hero + grilla de 6 módulos) para minimizar el salto
 * de layout cuando llega el contenido real.
 */
export default function StudentDashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-10 sm:px-6 sm:py-14">
      <div className="h-8 w-64 rounded-field bg-cream-2" />
      <div className="mt-3 h-4 w-80 max-w-full rounded-field bg-cream-2" />

      <div className="mt-8 h-64 rounded-card bg-cream-2" />

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-card border-[1.5px] border-line bg-paper p-5">
            <div className="flex items-center gap-3">
              <div className="size-10 shrink-0 rounded-full bg-cream-2" />
              <div className="h-4 w-24 rounded-field bg-cream-2" />
            </div>
            <div className="h-3 w-full rounded-field bg-cream-2" />
            <div className="h-3 w-2/3 rounded-field bg-cream-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
