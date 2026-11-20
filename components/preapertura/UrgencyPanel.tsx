import { Icon } from "@/components/ui/Icon";
import { EarlyAccessPill } from "@/components/preapertura/EarlyAccessPill";
import { MiniCommunityRail } from "@/components/preapertura/MiniCommunityRail";
import { getCommunityRail } from "@/lib/preapertura/communityRailData";
import type { StudentCounter } from "@/lib/preapertura/rules";

/**
 * Panel izquierdo del paso 1 (SPEC pantalla 2): urgencia real. `position` = estudiantes registrados + 1 (DR43.5); sin dato real
 * (tabla sin migrar o error) no se muestra ningún número. Sin prioridad ni reserva: eso lo aclaran los Términos. En ancho angosto
 * queda solo la franja con la píldora y el número (los ticks y el carrusel aparecen desde 860 px del popup).
 */
export async function UrgencyPanel({ position, counter }: { position: number | null; counter: StudentCounter }) {
  const rail = await getCommunityRail();
  return (
    <aside
      aria-label="Tu lugar en la preapertura"
      className="grid grid-cols-[minmax(0,1fr)] content-start gap-3.5 overflow-hidden rounded-card bg-forest-ink p-5 text-white @min-[860px]:gap-5 @min-[860px]:p-9"
    >
      <div className="justify-self-start">
        <EarlyAccessPill>Acceso anticipado</EarlyAccessPill>
      </div>
      <h2 className="hidden font-display text-[clamp(22px,3.4vw,32px)] leading-[1.08] tracking-tight @min-[860px]:block">
        Mientras otros buscan a ciegas, <span className="text-orange-light">vos te enterás primero.</span>
      </h2>
      <div className="flex items-center gap-3.5">
        {position != null && (
          <b className="font-display text-[40px] leading-none tracking-tight tabular-nums @min-[860px]:text-[56px]">
            {position.toLocaleString("es-AR")}
          </b>
        )}
        <span className="text-sm leading-snug text-white/90">
          {position != null ? (
            <>
              persona en sumarse
              <br />
              si terminás ahora
            </>
          ) : (
            "Sumate entre los primeros"
          )}
        </span>
      </div>
      <ul className="hidden gap-2.5 @min-[860px]:grid">
        <Tick icon="bolt">Primero en saber qué residencias verificamos en persona.</Tick>
        <Tick icon="sell">Gratis. Sin tarjeta.</Tick>
        <Tick icon="groups">
          {counter.kind === "number" ? `${counter.count.toLocaleString("es-AR")} estudiantes ya están adentro.` : "Sé de los primeros en sumarte."}
        </Tick>
      </ul>
      <div className="hidden @min-[860px]:block">
        <p className="inline-flex items-center gap-1.5 text-xs font-bold text-butter">
          <Icon name="info" className="text-base" />
          {rail.hasExamples ? "Se están sumando, con ejemplos ilustrativos" : "Se están sumando"}
        </p>
        <div className="mt-1 text-ink">
          <MiniCommunityRail cards={rail.cards} hasExamples={rail.hasExamples} />
        </div>
      </div>
    </aside>
  );
}

function Tick({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[15px] font-semibold text-white/95">
      <Icon name={icon} className="text-[22px] text-gold" />
      {children}
    </li>
  );
}
