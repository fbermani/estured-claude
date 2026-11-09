import { Button } from "@/components/ui/Button";
import { BrandMark } from "@/components/ui/BrandMark";
import { PreaperturaStage } from "@/components/preapertura/PreaperturaStage";
import { HomeBackdrop } from "@/components/preapertura/HomeBackdrop";

/**
 * Pantalla provisoria de la Fase 1: la ruta existe y se navega, pero el paso real (formularios, «Mi lugar») lo implementa la
 * Fase 2. Mismo patrón que la entrada: landing blureada + popup permanente, con salida al inicio.
 */
export function StubDialog({ title, text }: { title: string; text: string }) {
  return (
    <PreaperturaStage preview={<HomeBackdrop />} labelledBy="pre-stub-title" describedBy="pre-stub-text">
      <div className="px-5 pb-6 pt-5 sm:px-9 sm:pb-8 sm:pt-8">
        <BrandMark size={32} />
        <h1 id="pre-stub-title" className="mt-5 font-display text-3xl leading-tight tracking-tight text-ink">
          {title}
        </h1>
        <p id="pre-stub-text" className="mt-3 text-ink-soft">
          {text}
        </p>
        <div className="mt-6">
          <Button href="/" variant="outline" size="lg" className="w-full">
            Volver al inicio
          </Button>
        </div>
      </div>
    </PreaperturaStage>
  );
}
