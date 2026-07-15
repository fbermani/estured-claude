"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { CommunityProfileCard, CommunityRoomTypeSummary, CommunitySummary } from "@/lib/residents/communityVisibility";

/**
 * Explorador de comunidad — réplica fiel de la referencia
 * `estured_comunidad_actual_modal_full_view` (decisión del dueño
 * 2026-07-15: alta fidelidad): barra de ocupación con desglose por
 * tipo, secciones colapsables por tipo de habitación con mini-cards de
 * residentes + lugares disponibles, y panel lateral con el perfil del
 * residente seleccionado (Sobre mí / Intereses / Hábitos). Se omiten a
 * propósito: "señales de convivencia" con estado positivo/negativo
 * (feature futura, decisión del dueño en este mismo ciclo) y la
 * selección de cama puntual (Gestión Operativa, no wireada) — el CTA
 * de lugar disponible lleva al formulario real de solicitud.
 */

const AVATAR_STYLES = [
  "bg-forest-tint text-forest-700",
  "bg-orange-tint text-orange-700",
  "bg-mint text-forest-700",
  "bg-sand-100 text-ink-soft",
];

function items(value: Record<string, unknown> | null | undefined): string[] {
  const list = value?.items;
  return Array.isArray(list) ? list.filter((i): i is string => typeof i === "string") : [];
}

function Avatar({ card, index, size = "sm" }: { card: CommunityProfileCard; index: number; size?: "sm" | "lg" }) {
  const initial = card.firstName?.[0]?.toUpperCase() ?? "?";
  const style = AVATAR_STYLES[index % AVATAR_STYLES.length];
  const sizing = size === "lg" ? "h-24 w-24 text-3xl" : "h-10 w-10 text-sm";
  return (
    <div className="relative shrink-0">
      <div className={`flex items-center justify-center rounded-full font-bold ${style} ${sizing}`}>{initial}</div>
      {card.countryFlag && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-line ${
            size === "lg" ? "h-8 w-8 text-lg" : "h-4.5 w-4.5 px-0.5 text-[11px]"
          }`}
          aria-label={card.nationality ?? undefined}
        >
          {card.countryFlag}
        </span>
      )}
    </div>
  );
}

function subtitle(card: CommunityProfileCard): string {
  const parts = [card.age != null ? `${card.age}` : null, card.career ?? null].filter(Boolean);
  return parts.join(" · ");
}

function RoomTypeSection({
  roomType,
  cards,
  slug,
  selectedId,
  onSelect,
  defaultOpen,
  startIndex,
}: {
  roomType: CommunityRoomTypeSummary;
  cards: CommunityProfileCard[];
  slug: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  defaultOpen: boolean;
  startIndex: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const totalPlaces = roomType.availableCount != null ? roomType.occupiedCount + roomType.availableCount : null;
  const occupancyLabel =
    totalPlaces != null ? `${roomType.occupiedCount}/${totalPlaces} ocupadas` : `${roomType.occupiedCount} residentes`;
  const hasAvailable = (roomType.availableCount ?? 0) > 0;
  const title = roomType.genderPolicyLabel ? `${roomType.roomTypeName} ${roomType.genderPolicyLabel}` : roomType.roomTypeName;

  return (
    <div className="overflow-hidden rounded-card border-[1.5px] border-line bg-paper shadow-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-3">
          <span className="h-5 w-1 rounded-full bg-forest" aria-hidden />
          <span className="font-bold text-ink">{title}</span>
        </span>
        <span className="flex items-center gap-3">
          <span
            className={`rounded-field px-2 py-1 text-xs font-semibold ${
              hasAvailable ? "bg-success-bg text-success-fg" : "bg-sand-100 text-ink-soft"
            }`}
          >
            {occupancyLabel}
          </span>
          <Icon name={open ? "expand_less" : "expand_more"} className="text-xl text-forest-700" />
        </span>
      </button>

      {open && (
        <div className="grid gap-3 border-t border-line px-4 pb-4 pt-4 sm:grid-cols-2">
          {cards.map((card, i) => {
            const selected = card.residentStayId === selectedId;
            if (card.kind === "placeholder") {
              return (
                <div
                  key={card.residentStayId}
                  className="flex items-center gap-3 rounded-field border border-line bg-cream-2 p-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand-100 text-ink-faint">
                    <Icon name="person" className="text-xl" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink-faint">Plaza ocupada</p>
                    <p className="text-xs text-ink-faint">Residente pendiente de activar cuenta</p>
                  </div>
                </div>
              );
            }
            return (
              <button
                key={card.residentStayId}
                type="button"
                onClick={() => onSelect(card.residentStayId)}
                className={`flex cursor-pointer items-center gap-3 rounded-field border p-3 text-left transition-colors ${
                  selected
                    ? "border-[1.5px] border-forest bg-forest-tint/60 shadow-card"
                    : "border-line bg-paper hover:border-line-2 hover:bg-cream-2"
                }`}
                aria-pressed={selected}
              >
                <Avatar card={card} index={startIndex + i} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-bold ${selected ? "text-forest-700" : "text-ink"}`}>
                    {card.firstName}
                  </p>
                  {subtitle(card) && <p className="truncate text-xs text-ink-soft">{subtitle(card)}</p>}
                </div>
                {selected && <Icon name="check_circle" className="shrink-0 text-lg text-forest-700" />}
              </button>
            );
          })}

          {Array.from({ length: roomType.availableCount ?? 0 }, (_, i) => (
            <Link
              key={`slot-${i}`}
              href={`/residencias/${slug}?room=${roomType.roomTypeId}#solicitud`}
              className="group flex items-center gap-3 rounded-field border-2 border-dashed border-success-fg/40 bg-success-bg/40 p-3 transition-colors hover:bg-success-bg"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-bg text-success-fg transition-transform group-hover:scale-110">
                <Icon name="bed" className="text-xl" />
              </div>
              <div>
                <p className="text-sm font-bold text-success-fg">Lugar disponible</p>
                <p className="text-xs text-success-fg/80">Enviar solicitud para este tipo</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function CommunityBrowser({
  summary,
  slug,
  isGuest,
}: {
  summary: CommunitySummary;
  slug: string;
  isGuest: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const cardsByRoomType = useMemo(() => {
    const map = new Map<string | null, CommunityProfileCard[]>();
    for (const card of summary.cards) {
      const list = map.get(card.roomTypeId) ?? [];
      list.push(card);
      map.set(card.roomTypeId, list);
    }
    return map;
  }, [summary.cards]);

  const selected = summary.cards.find((c) => c.residentStayId === selectedId) ?? null;
  const selectedIndex = selected ? summary.cards.indexOf(selected) : 0;
  const totalPlaces = summary.totalResidents + summary.totalAvailable;
  const sections = summary.byRoomType.filter(
    (rt) => rt.occupiedCount > 0 || (rt.availableCount ?? 0) > 0,
  );

  // Índice de arranque por sección para variar los colores de avatar.
  let runningIndex = 0;
  const sectionStartIndex = sections.map((rt) => {
    const start = runningIndex;
    runningIndex += (cardsByRoomType.get(rt.roomTypeId) ?? []).length;
    return start;
  });

  const interests = items(selected?.interests);
  const habits = items(selected?.habits);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-4">
        {/* Barra de ocupación — ref: TOTAL / DESGLOSE POR TIPO / OCUPACIÓN */}
        <div className="flex flex-col gap-5 rounded-card border-[1.5px] border-line bg-paper p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div className="shrink-0">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted">Residentes</p>
            <p className="mt-1 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-ink">{summary.totalResidents}</span>
              <span className="text-sm text-ink-soft">actuales</span>
            </p>
          </div>
          <div className="hidden h-12 w-px bg-line sm:block" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-muted">Desglose por tipo</p>
            <div className="flex flex-wrap gap-2">
              {sections.map((rt) => (
                <span
                  key={rt.roomTypeId ?? "sin-tipo"}
                  className="inline-flex items-center rounded-field border border-line bg-cream-2 px-2.5 py-1 text-xs font-medium text-ink-soft"
                >
                  {rt.genderPolicyLabel ? `${rt.roomTypeName} ${rt.genderPolicyLabel}` : rt.roomTypeName}
                  <span className="ml-1.5 font-bold text-ink">{rt.occupiedCount}</span>
                </span>
              ))}
            </div>
          </div>
          {summary.totalAvailable > 0 && (
            <>
              <div className="hidden h-12 w-px bg-line sm:block" aria-hidden />
              <div className="shrink-0 sm:text-right">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted">Ocupación</p>
                <p className="mt-1 flex items-center gap-2 sm:justify-end">
                  <span className="rounded-full bg-success-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success-fg">
                    Con lugar
                  </span>
                  <span className="text-xl font-extrabold text-ink">
                    {summary.totalResidents}/{totalPlaces}
                  </span>
                </p>
              </div>
            </>
          )}
        </div>

        {/* Secciones colapsables por tipo */}
        {sections.map((rt, i) => (
          <RoomTypeSection
            key={rt.roomTypeId ?? "sin-tipo"}
            roomType={rt}
            cards={cardsByRoomType.get(rt.roomTypeId) ?? []}
            slug={slug}
            selectedId={selectedId}
            onSelect={setSelectedId}
            defaultOpen={i === 0}
            startIndex={sectionStartIndex[i]}
          />
        ))}

        {/* Footer CTA — ref: "Podés seleccionar un lugar disponible..." */}
        {summary.totalAvailable > 0 && (
          <div className="flex flex-col items-center justify-between gap-4 rounded-card border border-line bg-cream-2 p-4 sm:flex-row">
            <p className="flex items-center gap-3 text-sm font-medium text-ink-soft">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest-tint text-forest-700">
                <Icon name="info" className="text-base" />
              </span>
              Hay lugares informados como libres. Toda solicitud está sujeta a confirmación de la residencia.
            </p>
            <Link
              href={`/residencias/${slug}#solicitud`}
              className="w-full shrink-0 rounded-full bg-forest px-6 py-2.5 text-center text-sm font-bold text-white shadow-card transition-colors hover:bg-forest-600 sm:w-auto"
            >
              Enviar solicitud
            </Link>
          </div>
        )}
      </div>

      {/* Panel lateral — perfil del residente seleccionado */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-card border-[1.5px] border-line bg-paper p-6 shadow-card">
          {!selected ? (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cream-2 text-ink-faint">
                <Icon name="person_search" className="text-3xl" />
              </div>
              <p className="font-semibold text-ink">Elegí un residente</p>
              <p className="mt-1 text-sm text-ink-soft">
                Tocá una tarjeta para conocer el perfil que esa persona eligió mostrar.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <Avatar card={selected} index={selectedIndex} size="lg" />
              <h2 className="mt-4 text-2xl font-bold text-ink">{selected.firstName}</h2>
              {subtitle(selected) && <p className="mt-0.5 text-sm font-medium text-ink-soft">{subtitle(selected)}</p>}
              {selected.originCity && <p className="mt-0.5 text-xs text-ink-faint">De {selected.originCity}</p>}

              <p className="mt-5 w-full rounded-field border border-line-2 bg-forest-tint/50 px-4 py-3 text-xs italic leading-relaxed text-forest-700">
                &ldquo;La convivencia es dinámica: los perfiles pueden cambiar con el tiempo.&rdquo;
              </p>

              {isGuest ? (
                <p className="mt-6 w-full text-left text-sm text-ink-soft">
                  <Link href="/login" className="font-semibold text-forest-700 hover:underline">
                    Iniciá sesión
                  </Link>{" "}
                  para ver la edad, carrera, intereses y hábitos que este residente eligió compartir.
                </p>
              ) : (
                <>
                  {selected.bio && (
                    <div className="mt-6 w-full text-left">
                      <h3 className="mb-2 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest text-muted">
                        <Icon name="person" className="text-sm" /> Sobre mí
                      </h3>
                      <p className="text-sm leading-relaxed text-ink-soft">{selected.bio}</p>
                    </div>
                  )}
                  {interests.length > 0 && (
                    <div className="mt-6 w-full text-left">
                      <h3 className="mb-2 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest text-muted">
                        <Icon name="favorite" className="text-sm" /> Intereses
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {interests.map((item) => (
                          <span
                            key={item}
                            className="rounded-full border border-line bg-cream-2 px-3 py-1.5 text-xs font-medium text-ink-soft"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {habits.length > 0 && (
                    <div className="mt-6 w-full text-left">
                      <h3 className="mb-2 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest text-muted">
                        <Icon name="schedule" className="text-sm" /> Hábitos
                      </h3>
                      <ul className="space-y-2">
                        {habits.map((item) => (
                          <li key={item} className="flex items-center gap-2.5 text-sm font-medium text-ink-soft">
                            <Icon name="check_circle" className="text-lg text-forest-700" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
