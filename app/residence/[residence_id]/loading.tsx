/** Esqueleto de carga con la forma final del panel: título, «Para hacer hoy», cuatro tarjetas y listas. */
export default function Loading() {
  return (
    <div role="status" aria-label="Cargando" className="tone-residence mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="kit-skel h-14 w-2/3 max-w-sm rounded-card" />
      <div className="kit-skel mt-8 h-36 rounded-card" />
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="kit-skel h-44 rounded-card" />
        ))}
      </div>
      <div className="kit-skel mt-8 h-56 rounded-card" />
    </div>
  );
}
