import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { BrandMark } from "@/components/ui/BrandMark";
import { EarlyAccessPill } from "@/components/preapertura/EarlyAccessPill";
import { SignedInEntryCta } from "@/components/preapertura/SignedInEntryCta";
import { FreeBadge } from "@/components/preapertura/FreeBadge";
import { LiveCount } from "@/components/preapertura/LiveCount";
import { MiniCommunityRail } from "@/components/preapertura/MiniCommunityRail";
import { FounderCta } from "@/components/preapertura/FounderCta";
import { getCommunityRail } from "@/lib/preapertura/communityRailData";
import type { FounderClosure, FounderState, StudentCounter } from "@/lib/preapertura/rules";

/** Contenido del popup de la entrada `/` (SPEC pantalla 1, titular A recomendado, DR47.2). Copy exacto del diseño v4. */
export async function EntryContent({ counter, founders, closure }: { counter: StudentCounter; founders: FounderState; closure: FounderClosure }) {
  const rail = await getCommunityRail();
  return (
    <div className="px-5 pb-6 pt-5 sm:px-9 sm:pb-6 sm:pt-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <Link href="/" aria-label="EstuRed, inicio" className="inline-flex min-h-11 items-center rounded-field">
          <BrandMark size={32} />
        </Link>
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center rounded-field text-sm font-bold text-forest-700 underline underline-offset-4"
        >
          ¿Ya te sumaste? Ingresá
        </Link>
      </div>

      <div className="mt-2 sm:mt-1">
        <EarlyAccessPill />
      </div>

      <h1 id="pre-h1" className="mt-3 font-display text-[clamp(30px,8.4vw,40px)] leading-[1.04] tracking-[-0.035em] text-ink sm:mt-3 sm:text-[34px]">
        Encontrá tu residencia en Buenos Aires <span className="text-orange">sin ir a ciegas.</span>
      </h1>
      <p id="pre-sub" className="mt-3 text-[17px] text-ink-soft sm:mt-2 sm:text-base">
        Estamos visitando residencias una por una. Sumate y enterate primero cuáles quedaron verificadas.
      </p>

      <FreeBadge className="mt-5 sm:mt-4" />

      <div className="mt-5 grid gap-3 sm:mt-4 sm:gap-2.5">
        <SignedInEntryCta>
          <Button href="/preregistro" variant="secondary" size="lg" className="w-full shadow-orange sm:h-12 sm:text-lg">
            Sumarme gratis
            <Icon name="arrow_forward" className="text-xl" />
          </Button>
        </SignedInEntryCta>
        <LiveCount counter={counter} />
      </div>

      <section aria-labelledby="pre-rail-title" className="-mx-5 mt-5 border-y border-line bg-cream pb-0 pt-3 sm:-mx-9 sm:mt-4 sm:pt-2.5">
        <div className="flex items-center gap-2 px-5 sm:px-9">
          <span aria-hidden="true" className="pre-dot size-2 shrink-0 rounded-full bg-forest text-forest" />
          <h2 id="pre-rail-title" className="font-sans text-sm font-bold tracking-normal text-ink">
            Se están sumando
          </h2>
          {rail.hasExamples && (
            <span className="ml-auto shrink-0 rounded-field bg-butter px-2 py-1 text-xs font-bold whitespace-nowrap text-butter-fg">Ejemplos ilustrativos</span>
          )}
        </div>
        <MiniCommunityRail cards={rail.cards} hasExamples={rail.hasExamples} />
      </section>

      <div className="mt-4">
        <Button href="/preregistro/familiar" variant="outline-forest" size="md" className="w-full sm:text-base">
          <Icon name="family_restroom" className="text-xl" />
          Soy familiar de un estudiante
        </Button>
      </div>

      <div className="mt-4">
        <FounderCta state={founders} closure={closure} variant="modal" />
      </div>
    </div>
  );
}
