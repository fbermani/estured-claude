import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { FounderMeter } from "@/components/preapertura/FounderMeter";
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
        lugares de Residencia fundadora. <strong className="text-gold">Gratis.</strong>
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
 * CTA de residencias de la entrada (DR46 / SPEC pantalla 1): el objetivo principal de captación, con jerarquía clara: titular grande,
 * cupo real (medidor de 10 con 3+ residencias reales), un beneficio en una línea y un botón grande (la única acción primaria de la
 * tarjeta). Nada de escasez fabricada: todo sale de `founderState` / `FOUNDERS_CLOSE_AT`.
 *
 * `modal`: al final del popup (móvil y desktop angosto). `float`: tarjeta fija abajo a la derecha, FUERA del popup, solo desde 1280 px
 * (más angosto se solaparía con el popup centrado de 540 px; ahí se usa `modal`).
 *
 * IMPORTANTE: el contenedor del popup es `pointer-events-none` (para que el fondo no capture nada fuera de la caja); la tarjeta
 * flotante vive en ese contenedor, así que necesita `pointer-events-auto` o el clic atraviesa y «no funciona».
 */
export function FounderCta({ state, closure, variant }: { state: FounderState; closure: FounderClosure; variant: "modal" | "float" }) {
  const float = variant === "float";
  const closed = closure.kind === "closed";
  const meterTaken = state.kind === "counted" ? state.taken : state.kind === "full" ? FOUNDER_CAPACITY : null;
  return (
    <Link
      href="/fundadoras"
      className={`group grid gap-3 rounded-card border-[1.5px] border-gold/60 bg-forest-ink p-5 text-white shadow-float transition duration-200 ease-out-fresh focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink focus-visible:shadow-[0_0_0_2px_var(--color-paper)] motion-safe:hover:-translate-y-0.5 ${
        float ? "pointer-events-auto fixed bottom-6 right-6 z-10 hidden w-[320px] min-[1280px]:grid" : "min-[1280px]:hidden"
      }`}
    >
      <span className="flex items-center gap-2.5">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-gold text-forest-ink">
          <Icon name="workspace_premium" className="text-2xl" />
        </span>
        <span className="text-sm font-bold text-gold">Residencias fundadoras</span>
      </span>
      <span className="font-display text-2xl font-bold leading-[1.1] tracking-tight">¿Tenés una residencia en Buenos Aires?</span>
      <span className="text-base leading-snug text-white/90">
        <FounderLine state={state} closure={closure} />
      </span>
      {meterTaken != null && !closed && <FounderMeter taken={meterTaken} />}
      <span className="flex items-center gap-2 text-sm text-white/90">
        <Icon name="check_circle" className="text-lg text-gold" />
        Perfil Verificado sin costo e insignia de fundadora.
      </span>
      <span className="mt-1 flex min-h-14 items-center justify-center gap-2 rounded-full bg-gold px-6 text-base font-bold whitespace-nowrap text-forest-ink transition duration-200 ease-out-fresh group-hover:bg-paper group-focus-visible:bg-paper motion-safe:group-hover:-translate-y-0.5 motion-safe:group-active:translate-y-px">
        {closed ? "Sumar mi residencia" : "Quiero ser fundadora"}
        <Icon name="arrow_forward" className="text-xl" />
      </span>
    </Link>
  );
}
