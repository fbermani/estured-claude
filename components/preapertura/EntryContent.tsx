import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { BrandMark } from "@/components/ui/BrandMark";
import { LiveBand } from "@/components/preapertura/LiveBand";
import { BenefitList } from "@/components/preapertura/BenefitList";
import { SignedInEntryCta } from "@/components/preapertura/SignedInEntryCta";
import { LiveCount } from "@/components/preapertura/LiveCount";
import { MiniCommunityRail } from "@/components/preapertura/MiniCommunityRail";
import { FounderCta } from "@/components/preapertura/FounderCta";
import { LegalLinks } from "@/components/preapertura/LegalLinks";
import { getCommunityRail } from "@/lib/preapertura/communityRailData";
import { railTitle } from "@/lib/preapertura/communityRail";
import type { FounderClosure, FounderState, StudentCounter } from "@/lib/preapertura/rules";

/**
 * Contenido del popup de la entrada `/` (DR67 e, h, i). Copy exacto del mockup aprobado el 2026-11-26. Orden pensado para celular:
 * el botón principal y la tarjeta de fundadoras se ven sin desplazar; el carrusel va debajo.
 */
export async function EntryContent({ counter, founders, closure }: { counter: StudentCounter; founders: FounderState; closure: FounderClosure }) {
  const rail = await getCommunityRail();
  return (
    <div className="pre-entry">
      <LiveBand>Acceso anticipado abierto</LiveBand>

      <div className="px-4 sm:px-8">
        <p className="pre-brand flex justify-center">
          <BrandMark size={28} />
          <span className="sr-only">EstuRed</span>
        </p>

        <h1 id="pre-h1" className="pre-title text-center font-display font-bold text-balance text-ink">
          <span className="pre-soon block font-sans font-bold tracking-normal text-orange-700">Muy pronto:</span> Encontrá y reservá tu
          residencia en Buenos Aires, <span className="text-orange">con la seguridad de elegir bien.</span>
        </h1>
        <p id="pre-sub" className="pre-sub mx-auto max-w-[46ch] text-center text-ink-soft">
          <span className="pre-sub-long">Estamos visitando residencias una por una. </span>Sumate y{" "}
          <mark className="pre-mark">enterate primero</mark> cuáles quedaron verificadas.
        </p>

        <BenefitList variant="tiles" />

        <div className="pre-cta-block">
          <SignedInEntryCta>
            <Button href="/preregistro" variant="secondary" size="lg" className="pre-cta w-full shadow-orange">
              Quiero enterarme primero
              <Icon name="arrow_forward" className="text-xl" />
            </Button>
          </SignedInEntryCta>
        </div>
        <p className="pre-micro text-center text-ink-soft">Gratis. Sin tarjeta.</p>
        <LiveCount counter={counter} />

        <div className="pre-found-block">
          <FounderCta state={founders} closure={closure} variant="modal" />
        </div>
      </div>

      <section aria-labelledby="pre-rail-title" className="pre-rail-block border-t border-line bg-cream">
        <div className="flex items-center gap-2 px-5 sm:px-8">
          {/* Punto «en vivo» solo cuando todas las fichas son reales (DR67 h). */}
          {!rail.hasExamples && <span aria-hidden="true" className="pre-dot size-2 shrink-0 rounded-full bg-forest text-forest" />}
          <h2 id="pre-rail-title" className="font-sans text-[15px] font-bold tracking-normal text-ink">
            {railTitle(rail.hasExamples)}
          </h2>
        </div>
        <MiniCommunityRail cards={rail.cards} hasExamples={rail.hasExamples} />
      </section>

      <LegalLinks className="bg-cream" />
    </div>
  );
}
