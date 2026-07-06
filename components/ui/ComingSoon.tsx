import { Button } from "@/components/ui/Button";

/**
 * Placeholder para rutas cuya funcionalidad llega en próximos ciclos
 * (auth, dashboards). Mantiene la arquitectura de rutas oficial
 * (docs/11 §7) sin construir los módulos todavía.
 */
export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="mb-4 inline-flex rounded-full bg-amber-soft-100 px-3 py-1 text-sm font-semibold text-amber-soft-700">
          Próximamente
        </p>
        <h1 className="text-3xl font-bold text-petrol-800">{title}</h1>
        <p className="mt-3 text-ink-soft">{description}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button href="/">Volver al inicio</Button>
          <Button href="/waitlist" variant="outline">
            Lista de espera
          </Button>
        </div>
      </div>
    </div>
  );
}
