/**
 * Skeleton del hub de Inicio (Ciclo 40) — Next.js App Router lo muestra
 * automáticamente mientras `page.tsx` resuelve sus queries en el
 * servidor, sin JS ni estado de carga manual. Aproximado a la forma
 * final (saludo + «Tu próximo paso» con stepper + «Tu espacio» con grilla de 6 módulos) para minimizar el salto
 * de layout cuando llega el contenido real.
 */
export default function StudentDashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-10 sm:px-6 sm:py-14">
      <div className="h-28 rounded-[30px] bg-cream-2 md:h-36" />

      <div className="mt-6 rounded-card border-[1.5px] border-l-[6px] border-line border-l-cream-2 bg-paper p-5 md:p-7">
        <div className="h-3 w-24 rounded-field bg-cream-2" />
        <div className="mt-3 h-7 w-3/4 max-w-md rounded-field bg-cream-2" />
        <div className="mt-3 h-4 w-full max-w-xl rounded-field bg-cream-2" />
        <div className="mt-5 flex gap-2.5">
          <div className="h-12 w-44 rounded-full bg-cream-2" />
          <div className="h-12 w-36 rounded-full bg-cream-2" />
        </div>
        <div className="mt-6 flex justify-between">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="size-[30px] rounded-full bg-cream-2" />
              <div className="h-2.5 w-10 rounded-field bg-cream-2" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 h-5 w-28 rounded-field bg-cream-2" />
      <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
