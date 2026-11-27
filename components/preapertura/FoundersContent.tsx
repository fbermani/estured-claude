import { BackNav } from "@/components/preapertura/BackNav";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { LegalLinks } from "@/components/preapertura/LegalLinks";
import { Countdown } from "@/components/preapertura/Countdown";
import { FounderMeter } from "@/components/preapertura/FounderMeter";
import { FOUNDER_CAPACITY, type FounderClosure, type FounderState, type StudentCounter } from "@/lib/preapertura/rules";

const BENEFITS = [
  { title: "Menos consultas repetidas", text: "tu ficha responde lo de siempre" },
  { title: "Renovaciones y lista de espera", text: "en un mismo lugar" },
  { title: "Reservas y pagos con registro", text: "todo por escrito" },
  { title: "Salidas con tiempo", text: "no el día que se van" },
] as const;

/** Solo con la convocatoria abierta (DR71 d: van en la lista, no como líneas sueltas antes del botón). */
const FOUNDER_BENEFITS = [
  { title: "Insignia «Residencia fundadora»", text: "y más arriba al abrir" },
  { title: "Plan Premium bonificado", text: "el primer año" },
] as const;

/** Línea de cupo del encabezado según el estado REAL (0, 1–2, 3 a 9 con medidor, 10 y cerrado). Nunca escasez fabricada. */
function Urgency({ state, closure }: { state: FounderState; closure: FounderClosure }) {
  if (closure.kind === "closed") {
    return <p className="font-bold text-white">La convocatoria de fundadoras cerró, pero podés sumarte igual.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      {state.kind === "counted" || state.kind === "full" ? (
        <FounderMeter
          taken={state.kind === "full" ? FOUNDER_CAPACITY : state.taken}
          caption={
            state.kind === "full" ? (
              <>Los {FOUNDER_CAPACITY} lugares están en proceso. Si una no avanza, se libera.</>
            ) : (
              <>
                {state.hasExternal ? "Ya hay residencias registrándose, quedan" : "Quedan"}{" "}
                <b className="tabular-nums text-gold">{state.remaining}</b> de {FOUNDER_CAPACITY} lugares
              </>
            )
          }
        />
      ) : state.kind === "some" ? (
        <p className="font-bold text-white">Ya hay residencias registrándose, {FOUNDER_CAPACITY} lugares de fundadora</p>
      ) : (
        <p className="font-bold text-white">{FOUNDER_CAPACITY} lugares de fundadora</p>
      )}
      {closure.kind === "open" && <Countdown closesAt={closure.closesAt} />}
    </div>
  );
}

/** Sello del perfil verificado, arriba a la derecha, con la etiqueta de que la verificación no tiene costo. */
function VerifiedSeal() {
  return (
    <div className="grid shrink-0 justify-items-center">
      <span className="grid size-24 rotate-[-6deg] content-center justify-items-center rounded-full border-[3px] border-gold bg-forest-ink text-center shadow-float outline-1 -outline-offset-8 outline-dashed outline-gold/70">
        <Icon name="verified" className="text-gold" />
        <span className="mt-0.5 font-display text-xs font-bold leading-tight text-white">
          Perfil
          <br />
          Verificado
        </span>
      </span>
      <span className="-mt-2 max-w-[8.5rem] rounded-field bg-butter px-3 py-1 text-center text-xs font-bold leading-tight text-butter-fg shadow-card sm:max-w-none sm:rounded-full">Sin costo de verificación</span>
    </div>
  );
}

/**
 * Contenido del popup de fundadoras (SPEC pantalla 6, vistazo). Todo real: cupo, cierre (solo si `FOUNDERS_CLOSE_AT` está definida)
 * y contador de estudiantes (solo desde 25). Sin planes, precios ni comisión; «gratis» es el perfil verificado de la residencia.
 */
export function FoundersContent({ state, closure, counter }: { state: FounderState; closure: FounderClosure; counter: StudentCounter }) {
  const closed = closure.kind === "closed";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] @min-[820px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-3 surface-forest bg-forest-ink px-5 pb-6 pt-4 text-white sm:px-9 sm:pb-7 sm:pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="grid justify-items-start gap-2">
            <BackNav href="/" tone="dark">
              Volver al inicio
            </BackNav>
            <span className="inline-flex items-center gap-2 rounded-full bg-gold py-1.5 pl-1.5 pr-3 text-[13px] font-bold whitespace-nowrap text-forest-ink sm:pr-4 sm:text-sm">
              <Icon name="workspace_premium" className="rounded-full bg-forest-ink p-1 text-base text-gold" />
              Residencias fundadoras
            </span>
          </div>
          <VerifiedSeal />
        </div>
        <h1 id="pre-fund-title" className="font-display text-[clamp(28px,7vw,40px)] leading-[1.05] tracking-[-0.03em]">
          Menos mensajes repetidos, mejor gestión. <span className="mt-1 block text-gold">Sin costo para tu residencia.</span>
        </h1>
        <p id="pre-fund-text" className="max-w-[52ch] text-white/90">
          Estamos sumando las primeras residencias de Buenos Aires antes de abrir. Te visitamos y armamos tu perfil con vos.
        </p>
        <Urgency state={state} closure={closure} />
      </div>

      <div className="grid content-center gap-3.5 px-5 pb-6 pt-5 sm:px-8 sm:py-5">
        <div className="grid gap-2">
          <Button href="/register/residence" variant="secondary" size="lg" className="w-full text-base shadow-orange">
            Quiero que me contacten
            <Icon name="arrow_forward" className="text-xl" />
          </Button>
          <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-ink-soft">
            <span className="inline-flex items-center gap-1">
              <Icon name="forum" className="text-base" />
              Te escribimos
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="home_pin" className="text-base" />
              Te visitamos
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="key" className="text-base" />
              Recibís tu cuenta
            </span>
          </p>
        </div>

        <p className="flex items-center gap-2.5 rounded-field border-[1.5px] border-forest/25 bg-forest-tint px-3.5 py-2.5 text-[15px] font-bold text-forest-700">
          <Icon name="support_agent" className="text-2xl" />
          Te ayudamos a configurar tu cuenta
        </p>

        <ul className="border-t border-line">
          {[...BENEFITS, ...(closed ? [] : FOUNDER_BENEFITS)].map((b) => (
            <li key={b.title} className="flex flex-wrap items-baseline gap-x-2 border-b border-line py-2 text-[15px]">
              <span aria-hidden="true" className="mr-0.5 inline-block h-0.5 w-3.5 self-center bg-gold" />
              <b className="font-bold text-ink">{b.title}</b>
              <span className="text-sm text-ink-soft">{b.text}</span>
            </li>
          ))}
        </ul>

        {counter.kind === "number" && (
          <p className="flex items-center gap-3 rounded-field bg-forest-tint px-4 py-3 text-sm text-forest-700">
            <Icon name="groups" className="text-2xl" />
            <span>
              <b className="font-display text-xl tabular-nums text-forest-ink">{counter.count.toLocaleString("es-AR")}</b> estudiantes ya se sumaron al
              acceso anticipado.
            </span>
          </p>
        )}

        <LegalLinks className="-mb-3" />
      </div>
    </div>
  );
}
