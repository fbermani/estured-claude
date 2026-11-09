import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Countdown } from "@/components/preapertura/Countdown";
import { FounderMeter } from "@/components/preapertura/FounderMeter";
import { FOUNDER_CAPACITY, type FounderClosure, type FounderState, type StudentCounter } from "@/lib/preapertura/rules";

const BENEFITS = [
  { title: "Menos consultas repetidas", text: "tu ficha responde lo de siempre" },
  { title: "Renovaciones y lista de espera", text: "en un mismo lugar" },
  { title: "Reservas y pagos con registro", text: "todo por escrito" },
  { title: "Salidas con tiempo", text: "no el día que se van" },
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

/**
 * Contenido del popup de fundadoras (SPEC pantalla 6, vistazo). Todo real: cupo, cierre (solo si `FOUNDERS_CLOSE_AT` está definida)
 * y contador de estudiantes (solo desde 25). Sin planes, precios ni comisión; «gratis» es el perfil verificado de la residencia.
 */
export function FoundersContent({ state, closure, counter }: { state: FounderState; closure: FounderClosure; counter: StudentCounter }) {
  const closed = closure.kind === "closed";
  return (
    <div>
      <div className="grid gap-3 bg-forest-ink px-5 pb-6 pt-7 text-white sm:px-9 sm:pb-7 sm:pt-9">
        <span className="inline-flex items-center gap-2 justify-self-start rounded-full bg-gold py-1.5 pl-1.5 pr-4 text-sm font-bold text-forest-ink">
          <Icon name="workspace_premium" className="rounded-full bg-forest-ink p-1 text-base text-gold" />
          Residencias fundadoras
        </span>
        <h1 id="pre-fund-title" className="font-display text-[clamp(28px,7vw,40px)] leading-[1.05] tracking-[-0.03em]">
          Menos mensajes, más residencia. <span className="text-gold">Y gratis.</span>
        </h1>
        <p id="pre-fund-text" className="max-w-[52ch] text-white/90">
          Estamos sumando las primeras residencias de Buenos Aires antes de abrir. Te visitamos y armamos tu perfil con vos.
        </p>
        <Urgency state={state} closure={closure} />
      </div>

      <div className="grid gap-4 px-5 pb-6 pt-5 sm:px-9 sm:pb-8 sm:pt-6">
        <p className="flex items-center gap-2 justify-self-start rounded-field border-[1.5px] border-forest/25 bg-forest-tint px-3 py-2.5 text-sm font-bold text-forest-700">
          <Icon name="sell" className="text-xl" />
          <span>
            Gratis para tu residencia<span className="font-semibold opacity-90">, Perfil Verificado sin costo</span>
          </span>
        </p>

        <ul className="border-t border-line">
          {BENEFITS.map((b) => (
            <li key={b.title} className="flex flex-wrap items-baseline gap-x-2 border-b border-line py-2.5 text-[15px]">
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

        {!closed && (
          <div className="grid gap-1.5 text-center text-sm text-ink-soft">
            <p className="flex items-center justify-center gap-1.5">
              <Icon name="workspace_premium" className="text-lg text-butter-fg" />
              Las fundadoras llevan la insignia «Residencia fundadora» y aparecen más arriba al abrir.
            </p>
            <p className="flex items-center justify-center gap-1.5">
              <Icon name="redeem" className="text-lg text-forest-700" />
              Y tienen el Plan Premium bonificado.
            </p>
          </div>
        )}

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
        <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-field text-sm font-bold text-ink-soft hover:text-ink hover:underline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
