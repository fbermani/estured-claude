import { Button } from "@/components/ui/Button";
import { BrandMark } from "@/components/ui/BrandMark";

/**
 * Hoy solo la usa `not-found.tsx` — el resto de las rutas que en su
 * momento fueron placeholder (docs/11 §7) ya se construyeron en ciclos
 * posteriores. Por eso no lleva pill de "Próximamente": para un 404 no
 * aplica.
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
        <BrandMark variant="symbol" tile size={56} className="mx-auto mb-5 block" />
        <h1 className="text-3xl font-bold text-ink">{title}</h1>
        <p className="mt-3 text-ink-soft">{description}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button href="/">Volver al inicio</Button>
          <Button href="/search" variant="outline">
            Buscar residencias
          </Button>
        </div>
      </div>
    </div>
  );
}
