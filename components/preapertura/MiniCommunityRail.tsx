import { FlagAvatar } from "@/components/residences/FlagAvatar";
import { railTitle, type RailCard } from "@/lib/preapertura/communityRail";

/** Mínimo de tarjetas para que la tira se mueva sola; con menos queda quieta (un bucle con huecos se ve roto). */
const MIN_CARDS_TO_DRIFT = 4;

/**
 * Tarjeta del carrusel público (DR44, DR67 h): avatar con bandera, nombre de pila, edad, país, carrera y dos etiquetas; nunca
 * apellido ni residencia actual (el tipo `RailCard` no tiene esos campos). Las fichas ficticias no llevan rótulo propio: lo dice el
 * título de la sección.
 */
export function CommunityCard({ card, index = 0, hidden = false }: { card: RailCard; index?: number; hidden?: boolean }) {
  return (
    <div
      aria-hidden={hidden || undefined}
      className="pre-card grid w-[244px] shrink-0 content-start gap-2 rounded-card border-[1.5px] border-line bg-paper p-3.5 text-ink shadow-card"
    >
      <div className="flex items-center gap-3">
        <FlagAvatar initial={card.name[0]?.toUpperCase() ?? "?"} flag={card.flag} flagLabel={card.country} index={index} size="md" />
        <div className="min-w-0">
          <p className="truncate font-display text-[17px] font-bold leading-tight text-ink">{card.name}</p>
          <p className="text-[13px] text-ink-soft">
            {card.age} años{card.country ? `, de ${card.country}` : ""}
          </p>
        </div>
      </div>
      {card.career && <p className="text-sm font-bold text-ink-soft">{card.career}</p>}
      {card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {card.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-line bg-cream-2 px-2.5 py-1 text-xs font-bold whitespace-nowrap text-ink-soft">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Carrusel de comunidad (DR44). `cards` ya viene armado (reales + ficticios que faltan; ver `buildRail`). Se pausa con hover y foco;
 * con prefers-reduced-motion queda quieto y se desplaza a mano (`.pre-rail`). La segunda copia de la tira es decorativa
 * (`aria-hidden`) para cerrar el bucle y solo existe si la tira se mueve.
 */
export function MiniCommunityRail({ cards, hasExamples }: { cards: RailCard[]; hasExamples: boolean }) {
  const drift = cards.length >= MIN_CARDS_TO_DRIFT;
  return (
    <div className="pre-rail overflow-hidden" role="group" aria-label={railTitle(hasExamples)} tabIndex={0}>
      <div className="pre-track pt-2.5 pb-3" data-static={drift ? undefined : ""}>
        {cards.map((c, i) => (
          <CommunityCard key={`${c.kind}-${c.name}-${i}`} card={c} index={i} />
        ))}
        {drift && cards.map((c, i) => <CommunityCard key={`copy-${c.kind}-${c.name}-${i}`} card={c} index={i} hidden />)}
      </div>
    </div>
  );
}
