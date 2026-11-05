/** Skeleton de /search: cabecera, columna de filtros y tarjetas. Sin pulso con `prefers-reduced-motion`. */
function Bar({ className = "" }: { className?: string }) {
  return <div className={`kit-skel rounded-full ${className}`} />;
}

export default function LoadingSearch() {
  return (
    <div className="mx-auto max-w-[80rem] px-4 py-6 sm:px-6 sm:py-8" role="status" aria-live="polite">
      <span className="sr-only">Cargando residencias…</span>
      <Bar className="h-3.5 w-40" />
      <Bar className="mt-3 h-9 w-3/4 max-w-lg" />
      <Bar className="mt-3 h-4 w-full max-w-xl" />
      <div className="mt-6 min-[900px]:grid min-[900px]:grid-cols-[18rem_minmax(0,1fr)] min-[900px]:gap-6">
        <div className="hidden space-y-3 rounded-card border-[1.5px] border-line bg-paper p-5 min-[900px]:block">
          {Array.from({ length: 10 }, (_, i) => (
            <Bar key={i} className={`h-4 ${i % 3 === 0 ? "w-1/2" : "w-5/6"}`} />
          ))}
        </div>
        <div>
          <Bar className="h-[42px] w-full min-[900px]:hidden" />
          <div className="mt-3 flex items-center justify-between gap-3">
            <Bar className="h-6 w-56" />
            <Bar className="hidden h-9 w-52 sm:block" />
          </div>
          <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="overflow-hidden rounded-card border-[1.5px] border-line bg-paper">
                <div className="kit-skel aspect-[16/10]" />
                <div className="space-y-3 p-4">
                  <Bar className="h-5 w-3/4" />
                  <Bar className="h-3.5 w-full" />
                  <Bar className="h-3.5 w-2/3" />
                  <Bar className="h-10 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
