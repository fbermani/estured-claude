/**
 * Skeleton de la ficha (SPEC §6): hero, título, chips y bloque de tarifas a la izquierda; card de precio a la
 * derecha. Respeta `prefers-reduced-motion` (sin pulso).
 */
function Bar({ className = "" }: { className?: string }) {
  return <div className={`kit-skel rounded-full ${className}`} />;
}

export default function LoadingResidence() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6 sm:pb-14" role="status" aria-live="polite">
      <span className="sr-only">Cargando la residencia…</span>
      <Bar className="mb-4 h-4 w-56" />
      <div className="kit-skel h-[150px] rounded-card sm:h-[200px]" />
      <div className="mt-6 space-y-3">
        <Bar className="h-9 w-3/4 max-w-md" />
        <Bar className="h-4 w-64" />
        <div className="flex gap-2 pt-1">
          <Bar className="h-9 w-40" />
          <Bar className="h-9 w-48" />
          <Bar className="hidden h-9 w-36 sm:block" />
        </div>
      </div>
      <div className="mt-8 grid gap-y-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-x-10">
        <div className="space-y-4">
          <Bar className="h-7 w-56" />
          <div className="kit-skel h-64 rounded-card" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="kit-skel h-24 rounded-sm" />
            ))}
          </div>
        </div>
        <div className="kit-skel h-[460px] rounded-card" />
      </div>
    </div>
  );
}
