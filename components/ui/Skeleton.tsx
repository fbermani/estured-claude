/**
 * Esqueleto de carga del kit (para `loading.tsx` de cada ruta). Mismo tamaño que el contenido real para evitar saltos.
 * Con prefers-reduced-motion el shimmer se detiene. Server Component.
 */
export function Skeleton({
  rows = 3,
  shape = "row",
  className = "",
}: {
  rows?: number;
  shape?: "row" | "card" | "block";
  className?: string;
}) {
  const items = Array.from({ length: rows });
  if (shape === "card") {
    return (
      <div role="status" aria-label="Cargando" className={`grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
        {items.map((_, i) => (
          <div key={i} className="kit-skel h-36 rounded-card" />
        ))}
      </div>
    );
  }
  if (shape === "block") {
    return <div role="status" aria-label="Cargando" className={`kit-skel h-32 rounded-card ${className}`} />;
  }
  return (
    <div role="status" aria-label="Cargando" className={`rounded-card border border-line bg-paper p-1.5 ${className}`}>
      {items.map((_, i) => (
        <div key={i} className="grid grid-cols-[42px_1fr_90px] items-center gap-3 p-3">
          <span className="kit-skel size-[42px] rounded-full" />
          <span className="grid gap-1.5">
            <i className="kit-skel block h-3.5 w-3/5 rounded-md" />
            <i className="kit-skel block h-3 w-2/5 rounded-md" />
          </span>
          <i className="kit-skel block h-7 rounded-full" />
        </div>
      ))}
    </div>
  );
}
