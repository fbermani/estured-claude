import { FlagAvatar } from "@/components/residences/FlagAvatar";
import type { RailCard } from "@/lib/preapertura/communityRail";

/** Mínimo de tarjetas para que la tira se mueva sola; con menos queda quieta (un bucle con huecos se ve roto). */
const MIN_CARDS_TO_DRIFT = 4;

/**
 * Tarjeta del carrusel público (DR44). Real: nombre de pila, edad, país, carrera, hábitos e intereses; nunca apellido ni residencia
 * actual (el tipo `RailCard` no tiene esos campos). Ejemplo: borde punteado y cinta «Ejemplo» (ficticia, DR44.3).
 */
export function CommunityCard({ card, index = 0, hidden = false }: { card: RailCard; index?: number; hidden?: boolean }) {
  const example = card.kind === "example";
  return (
    <div
      aria-hidden={hidden || undefined}
      className={`relative grid w-[212px] shrink-0 content-start gap-2 rounded-card bg-paper p-3 text-ink shadow-card ${
        example ? "border-[1.5px] border-dashed border-line-2" : "border-[1.5px] border-line"
      }`}
    >
      {example && (
        <span className="absolute -top-2.5 right-3.5 rotate-2 rounded-field bg-butter px-2 py-1 text-xs font-bold text-butter-fg shadow-sm">
          Ejemplo
        </span>
      )}
      <div className="flex items-center gap-3">
        <FlagAvatar initial={card.name[0]?.toUpperCase() ?? "?"} flag={card.flag} flagLabel={card.country} index={index} />
        <div className="min-w-0">
          <p className="truncate font-display text-[15px] font-bold leading-tight text-ink">{card.name}</p>
          <p className="text-xs text-ink-soft">
            {card.age} años{card.country ? `, de ${card.country}` : ""}
          </p>
        </div>
      </div>
      {card.career && <p className="text-sm font-semibold text-ink-soft">{card.career}</p>}
      {card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {card.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-line bg-cream-2 px-2 py-1 text-xs font-semibold text-ink-soft">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Carrusel «Se están sumando» (DR44). `cards` ya viene armado (reales + ejemplos que faltan; ver `buildRail`). Se pausa con hover y
 * foco; con prefers-reduced-motion queda quieto y se desplaza a mano (`.pre-rail`). La segunda copia de la tira es decorativa
 * (`aria-hidden`) para cerrar el bucle y solo existe si la tira se mueve.
 */
export function MiniCommunityRail({ cards, hasExamples }: { cards: RailCard[]; hasExamples: boolean }) {
  const drift = cards.length >= MIN_CARDS_TO_DRIFT;
  return (
    <div
      className="pre-rail overflow-hidden"
      role="group"
      aria-label={hasExamples ? "Estudiantes que se están sumando (incluye ejemplos ilustrativos)" : "Estudiantes que se están sumando"}
      tabIndex={0}
    >
      <div className="pre-track py-4" data-static={drift ? undefined : ""}>
        {cards.map((c, i) => (
          <CommunityCard key={`${c.kind}-${c.name}-${i}`} card={c} index={i} />
        ))}
        {drift && cards.map((c, i) => <CommunityCard key={`copy-${c.kind}-${c.name}-${i}`} card={c} index={i} hidden />)}
      </div>
    </div>
  );
}
