/** Skeleton de /search: columna de filtros + grilla de tarjetas. Sin pulso con `prefers-reduced-motion`. */
function Bar({ className = "" }: { className?: string }) {
  return <div className={`rounded-full bg-line motion-safe:animate-pulse ${className}`} />;
}

export default function LoadingSearch() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14" role="status" aria-live="polite">
      <span className="sr-only">Cargando residencias…</span>
      <Bar className="h-9 w-3/4 max-w-lg" />
      <Bar className="mt-3 h-4 w-full max-w-xl" />
      <div className="mt-8 lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-8">
        <div className="hidden space-y-3 rounded-card border-[1.5px] border-line p-5 lg:block">
          {Array.from({ length: 9 }, (_, i) => (
            <Bar key={i} className={`h-4 ${i % 3 === 0 ? "w-1/2" : "w-5/6"}`} />
          ))}
        </div>
        <div>
          <Bar className="h-6 w-56" />
          <div className="mt-5 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-80 rounded-card bg-line motion-safe:animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
