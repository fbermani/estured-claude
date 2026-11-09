import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { FOUNDER_CAPACITY, type FounderClosure, type FounderState } from "@/lib/preapertura/rules";

/**
 * Frase del cupo de Residencias fundadoras (DR46). Todo sale de `founderState`: «Ya hay residencias registrándose» solo con la
 * primera residencia externa; con 0 no aparece. Si no se pudo consultar, texto fijo sin números inventados.
 */
function FounderLine({ state, closure }: { state: FounderState; closure: FounderClosure }) {
  if (closure.kind === "closed") return <>La convocatoria de Residencia fundadora cerró. Igual podés sumar tu residencia, gratis.</>;
  if (state.kind === "some") {
    return (
      <>
        Ya hay residencias registrándose. {FOUNDER_CAPACITY} lugares de fundadora, <strong className="text-gold">gratis.</strong>
      </>
    );
  }
  if (state.kind === "counted") {
    return (
      <>
        Quedan{" "}
        <strong className="text-gold tabular-nums">
          {state.remaining} de {FOUNDER_CAPACITY}
        </strong>{" "}
        lugares de Residencia fundadora. Gratis.
      </>
    );
  }
  if (state.kind === "full") {
    return <>Los {FOUNDER_CAPACITY} lugares de Residencia fundadora están en proceso. Si una no avanza, se libera.</>;
  }
  return (
    <>
      Solo {FOUNDER_CAPACITY} lugares de Residencia fundadora. <strong className="text-gold">Gratis.</strong>
    </>
  );
}

/**
 * CTA de residencias de la entrada (DR46 / SPEC pantalla 1). `modal`: al final del popup (móvil y desktop angosto).
 * `float`: tarjeta fija abajo a la derecha, fuera del popup, solo desde 1100 px (ahí el `modal` se oculta).
 */
export function FounderCta({ state, closure, variant }: { state: FounderState; closure: FounderClosure; variant: "modal" | "float" }) {
  const float = variant === "float";
  const closed = closure.kind === "closed";
  return (
    <Link
      href="/fundadoras"
      className={`group grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 rounded-card bg-forest-ink p-4 text-white shadow-float transition duration-200 ease-out-fresh focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink focus-visible:shadow-[0_0_0_2px_var(--color-paper)] motion-safe:hover:-translate-y-0.5 ${
        float ? "fixed bottom-6 right-6 z-10 hidden w-[330px] min-[1100px]:grid" : "min-[1100px]:hidden sm:grid-cols-[auto_1fr_auto]"
      }`}
    >
      <span aria-hidden="true" className="row-span-2 grid size-11 place-items-center rounded-full bg-gold text-forest-ink">
        <Icon name="workspace_premium" className="text-2xl" />
      </span>
      <span className="font-display text-base font-bold leading-tight">
        {float ? "¿Tenés una residencia en Buenos Aires?" : "¿Tenés una residencia?"}
      </span>
      <span className="text-sm text-white/85">
        <FounderLine state={state} closure={closure} />
      </span>
      <span
        className={`col-span-full mt-2 flex min-h-[46px] items-center justify-center gap-1.5 rounded-full bg-gold px-5 text-sm font-bold whitespace-nowrap text-forest-ink ${
          float ? "" : "sm:col-span-1 sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:mt-0"
        }`}
      >
        {closed ? "Sumar mi residencia" : "Quiero ser fundadora"}
        <Icon name="arrow_forward" className="text-xl" />
      </span>
    </Link>
  );
}
