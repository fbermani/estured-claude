import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { FounderMeter } from "@/components/preapertura/FounderMeter";
import { FOUNDER_CAPACITY, type FounderClosure, type FounderState } from "@/lib/preapertura/rules";

/** Beneficios de DR46: cortos en la tarjeta de adentro del popup, completos en la lateral (copy del mockup aprobado, DR67). */
const COMPACT_BENEFITS = [
  { icon: "verified", label: "Perfil verificado" },
  { icon: "workspace_premium", label: "Insignia fundadora" },
  { icon: "trending_up", label: "Más arriba al abrir" },
  { icon: "redeem", label: "Premium 1.er año" },
] as const;

const SIDE_BENEFITS = [
  { icon: "location_on", label: "Te visitamos y armamos tu perfil con vos" },
  { icon: "verified", label: "Perfil Verificado sin costo" },
  { icon: "workspace_premium", label: "Insignia «Residencia fundadora»" },
  { icon: "trending_up", label: "Aparecés más arriba al abrir" },
  { icon: "redeem", label: "Plan Premium bonificado el primer año" },
] as const;

/**
 * Frase del cupo de Residencias fundadoras (DR46). Todo sale de `founderState`: «Ya hay residencias registrándose» solo con la
 * primera residencia externa; con 0 no aparece. Si no se pudo consultar, texto fijo sin números inventados.
 */
function FounderLine({ state, closure, side }: { state: FounderState; closure: FounderClosure; side: boolean }) {
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
        lugares{side ? ". Gratis para tu residencia." : ""}
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
 * CTA de residencias de la entrada (DR46, DR67): el objetivo principal de captación. Pregunta, cupo real (medidor con 3+ residencias
 * reales), beneficios y un botón grande (la única acción primaria de la tarjeta). Nada de escasez fabricada: todo sale de
 * `founderState` / `FOUNDERS_CLOSE_AT`. Con la convocatoria cerrada no se listan beneficios de fundadora.
 *
 * `modal`: compacta, dentro del popup (celular y escritorio angosto). `float`: lateral, al costado del popup, desde 1100 px
 * (`PreaperturaDialog asideBeside`).
 *
 * IMPORTANTE: el contenedor del popup es `pointer-events-none` (para que el fondo no capture nada fuera de la caja); la tarjeta
 * lateral vive en ese contenedor, así que necesita `pointer-events-auto` o el clic atraviesa y «no funciona».
 */
export function FounderCta({ state, closure, variant }: { state: FounderState; closure: FounderClosure; variant: "modal" | "float" }) {
  const side = variant === "float";
  const closed = closure.kind === "closed";
  const meterTaken = closed ? null : state.kind === "counted" ? state.taken : state.kind === "full" ? FOUNDER_CAPACITY : null;
  const meter = meterTaken != null && <FounderMeter taken={meterTaken} compact={!side} />;
  const benefits = !closed && (
    <ul className={side ? "grid gap-2" : "pre-found-list grid grid-cols-[repeat(2,auto)] justify-between gap-x-2 gap-y-1.5"}>
      {(side ? SIDE_BENEFITS : COMPACT_BENEFITS).map((benefit) => (
        <li key={benefit.label} className={`flex gap-1.5 leading-snug ${side ? "items-start text-[15px]" : "items-center text-[13px]"}`}>
          <Icon name={benefit.icon} className={`shrink-0 text-gold ${side ? "text-xl" : "text-[15px]"}`} />
          {benefit.label}
        </li>
      ))}
    </ul>
  );
  return (
    <Link
      href="/fundadoras"
      className={`group rounded-card border-2 border-gold bg-forest-ink text-white shadow-float transition duration-200 ease-out-fresh focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink focus-visible:shadow-[0_0_0_2px_var(--color-paper)] motion-safe:hover:-translate-y-0.5 ${
        side
          ? "pre-halo pointer-events-auto relative hidden w-[340px] shrink-0 content-start gap-2.5 p-[22px] min-[1100px]:grid"
          : "pre-found grid gap-2 px-4 py-3.5 min-[1100px]:hidden"
      }`}
    >
      <span className={`flex items-center gap-2 font-bold text-gold ${side ? "text-[15px]" : "pre-found-tag text-[13px]"}`}>
        <Icon name="workspace_premium" className="text-lg" />
        {side ? "Residencias fundadoras" : "Residencias fundadoras · Gratis"}
      </span>
      <span className={`font-display font-bold leading-[1.05] tracking-tight ${side ? "text-3xl" : "pre-found-title text-[22px]"}`}>
        {side ? "¿Tenés una residencia en Buenos Aires?" : "¿Tenés una residencia?"}
      </span>
      <span className={`leading-snug text-white/90 ${side ? "text-base" : "pre-found-line text-sm"}`}>
        <FounderLine state={state} closure={closure} side={side} />
      </span>
      {!side && meter}
      {benefits}
      {side && meter}
      <span
        className={`flex items-center justify-center gap-2 rounded-full bg-gold px-5 font-bold whitespace-nowrap text-forest-ink transition duration-200 ease-out-fresh group-hover:bg-paper group-focus-visible:bg-paper motion-safe:group-active:translate-y-px ${
          side ? "min-h-[54px] text-[17px]" : "pre-found-button min-h-[46px] text-base"
        }`}
      >
        {closed ? "Sumar mi residencia" : "Quiero ser fundadora"}
        <Icon name="arrow_forward" className="text-xl" />
      </span>
    </Link>
  );
}
