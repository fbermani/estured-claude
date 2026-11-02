"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useReservationSelection } from "@/components/residences/reservationSelection";
import { StatusTag } from "@/components/ui/StatusTag";
import { FilterChips } from "@/components/ui/FilterChips";
import { MetricCard } from "@/components/ui/MetricCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { canOfferBedSelection, typeAvailabilityMode } from "@/lib/availability/typeAvailability";
import type { CommunityProfileCard, CommunityRoomTypeSummary, CommunitySummary } from "@/lib/residents/communityVisibility";

/**
 * Explorador de comunidad — barra de ocupación con desglose por tipo,
 * secciones por tipo de habitación en grilla tipo masonry (columnas
 * CSS: cada card ocupa solo la altura de su propio contenido, sin
 * panel lateral fijo) y el perfil del residente (Sobre mí / Intereses
 * / Hábitos) como card flotante al pasar el mouse sobre cada
 * estudiante. Elegir una plaza libre completa el tipo de habitación
 * en "Tu solicitud de reserva" en tiempo real (sin recargar la
 * página) vía `useReservationSelection` — pedido del dueño en Ciclo
 * 35octodevicies. Se omiten a propósito: "señales de convivencia" con
 * estado positivo/negativo (feature futura) y la selección de cama
 * puntual a nivel de base de datos (Gestión Operativa, no wireada) —
 * la plaza elegida solo se resalta visualmente, la reserva real sigue
 * siendo a nivel de tipo de habitación.
 *
 * D3/H03 (Ciclo 55): la disponibilidad la manda el TIPO de habitación
 * (`availabilityState`, helper `lib/availability/typeAvailability.ts`). Las
 * camas libres de las habitaciones son solo información: el slot libre
 * ofrece "Elegí este lugar" únicamente si el tipo está disponible y la
 * pantalla permite elegir (`allowSelection`; "Mi residencia" no).
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
          className={`absolute -bottom-1 -right-1 flex items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-paper ${
            size === "lg" ? "h-9 w-9 text-xl" : "h-6 w-6 text-base"
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

function ResidentCell({ card, index, isGuest }: { card: CommunityProfileCard; index: number; isGuest: boolean }) {
  const [open, setOpen] = useState(false);

  if (card.kind === "placeholder") {
    return (
      <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-cream-2 p-2.5">
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

  const interests = items(card.interests);
  const habits = items(card.habits);

  return (
    <div className="relative" onKeyDown={(e) => e.key === "Escape" && setOpen(false)} onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)} onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onFocus={(e) => e.currentTarget.matches(":focus-visible") && setOpen(true)}
        onBlur={() => setOpen(false)}
        className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-2xl border border-line bg-paper p-2.5 text-left transition-all duration-300 ease-bounce hover:-translate-y-px hover:border-(--tone) hover:shadow-card focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--tone)"
        aria-expanded={open}
      >
        <Avatar card={card} index={index} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{card.firstName}</p>
          {subtitle(card) && <p className="truncate text-xs text-ink-soft">{subtitle(card)}</p>}
        </div>
        <Icon name="expand_more" className="shrink-0 text-base text-ink-faint" />
      </button>

      {/* Perfil completo flotante al hover/click — reemplaza el panel
          lateral fijo (pedido del dueño: no ocupar una columna con un
          solo perfil, mostrarlo como card flotante por estudiante). */}
      {open && (
        <div
          role="dialog"
          className="benefit-fade-in relative z-30 mt-2 w-full rounded-card sm:absolute sm:left-1/2 sm:top-full sm:w-72 sm:-translate-x-1/2 rounded-card border-[1.5px] border-line bg-paper p-5 text-left shadow-float"
        >
          <div className="flex items-center gap-3">
            <Avatar card={card} index={index} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-ink">{card.firstName}</p>
              {subtitle(card) && <p className="truncate text-xs font-medium text-ink-soft">{subtitle(card)}</p>}
              {card.originCity && <p className="truncate text-xs text-ink-faint">De {card.originCity}</p>}
            </div>
          </div>

          {isGuest ? (
            <p className="mt-4 text-xs leading-relaxed text-ink-soft">
              <Link href="/login" className="font-semibold text-forest-700 hover:underline">
                Iniciá sesión
              </Link>{" "}
              para ver la edad, carrera, intereses y hábitos que este residente eligió compartir.
            </p>
          ) : (
            <>
              {card.bio && (
                <div className="mt-4">
                  <h4 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-muted">
                    <Icon name="person" className="text-xs" /> Sobre mí
                  </h4>
                  <p className="text-xs leading-relaxed text-ink-soft">{card.bio}</p>
                </div>
              )}
              {interests.length > 0 && (
                <div className="mt-4">
                  <h4 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-muted">
                    <Icon name="favorite" className="text-xs" /> Intereses
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {interests.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-line bg-cream-2 px-2.5 py-1 text-[11px] font-medium text-ink-soft"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {habits.length > 0 && (
                <div className="mt-4">
                  <h4 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-muted">
                    <Icon name="schedule" className="text-xs" /> Hábitos
                  </h4>
                  <ul className="space-y-1.5">
                    {habits.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-xs font-medium text-ink-soft">
                        <Icon name="check_circle" className="text-sm text-forest-700" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!card.bio && interests.length === 0 && habits.length === 0 && (
                <p className="mt-4 text-xs italic text-ink-faint">
                  Este residente todavía no completó su perfil de convivencia.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Plaza libre informativa: sin acción. El estado manda el tipo de habitación (D3). */
function InfoFreeSlot({ typeAvailable }: { typeAvailable: boolean }) {
  return (
    <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-dashed border-line-2 bg-paper p-2.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand-100 text-ink-faint">
        <Icon name="bed" className="text-xl" />
      </div>
      <div>
        <p className="text-sm font-semibold text-ink-soft">Plaza libre</p>
        {!typeAvailable && <p className="text-xs text-ink-faint">Sin disponibilidad informada</p>}
      </div>
    </div>
  );
}

function FreeBedSlot({ slug, roomTypeId, slotKey }: { slug: string; roomTypeId: string | null; slotKey: string }) {
  const router = useRouter();
  const { slotKey: selectedSlotKey, select } = useReservationSelection();
  const isSelected = selectedSlotKey === slotKey;

  // Solo la ficha de residencia tiene el panel "Tu solicitud de
  // reserva" (#solicitud) en la misma página — desde acá (por ejemplo
  // /residencias/[slug]/comunidad, sin ese panel) seleccionar navega a
  // la ficha real en vez de solo actualizar estado que nadie mostraría.
  const handleSelect = () => {
    if (!roomTypeId) return;
    if (document.getElementById("solicitud")) {
      select(roomTypeId, slotKey);
    } else {
      router.push(`/residencias/${slug}?room=${roomTypeId}#solicitud`);
    }
  };

  // Sin tipo de habitación resuelto (no debería pasar con datos reales)
  // — se mantiene el fallback de navegación directa al formulario.
  if (!roomTypeId) {
    return (
      <Link
        href={`/residencias/${slug}#solicitud`}
        className="group flex items-center gap-3 rounded-2xl border-2 border-dashed border-success-fg/40 bg-success-bg/40 p-2.5 transition-colors duration-300 hover:bg-success-bg"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-bg text-success-fg transition-transform duration-300 group-hover:scale-110">
          <Icon name="bed" className="text-xl" />
        </div>
        <div>
          <p className="text-sm font-bold text-success-fg">Cama disponible</p>
          <p className="text-xs text-success-fg/80">Enviar solicitud para este lugar</p>
        </div>
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSelect}
      aria-pressed={isSelected}
      className={`group flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 p-2.5 text-left transition-all duration-300 ${
        isSelected
          ? "border-solid border-forest bg-forest-tint shadow-card"
          : "border-dashed border-success-fg/40 bg-success-bg/40 hover:border-success-fg hover:bg-success-bg"
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
          isSelected ? "animate-select-pop bg-forest text-white" : "bg-success-bg text-success-fg group-hover:scale-110"
        }`}
      >
        <Icon name={isSelected ? "check" : "bed"} className="text-xl" />
      </div>
      <div>
        <p className={`text-sm font-bold ${isSelected ? "text-forest-700" : "text-success-fg"}`}>
          {isSelected ? "Plaza seleccionada" : "Cama disponible"}
        </p>
        <p className={`text-xs ${isSelected ? "text-forest-700/80" : "text-success-fg/80"}`}>
          {isSelected ? "Completá tu solicitud a la derecha" : "Elegí este lugar para tu solicitud"}
        </p>
      </div>
    </button>
  );
}

function RoomTypeSection({
  roomType,
  cards,
  slug,
  isGuest,
  startIndex,
  allowSelection,
  defaultOpen,
}: {
  roomType: CommunityRoomTypeSummary;
  cards: CommunityProfileCard[];
  slug: string;
  isGuest: boolean;
  startIndex: number;
  allowSelection: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const title = roomType.genderPolicyLabel ? `${roomType.roomTypeName} ${roomType.genderPolicyLabel}` : roomType.roomTypeName;

  const hasRooms = roomType.rooms.length > 0;
  const unassigned = cards.filter((c) => !c.roomId || !roomType.rooms.some((r) => r.roomId === c.roomId));
  const indexOf = (card: CommunityProfileCard) => startIndex + cards.indexOf(card);

  // El estado que se muestra es el del TIPO (StatusTag, copy oficial); las camas
  // libres por habitación quedan como información en cada card (D3/H03).
  const typeState = roomType.availabilityState;
  const offerSelection = allowSelection && canOfferBedSelection(typeState);
  const renderFreeSlot = (key: string, slotKey: string) =>
    offerSelection ? (
      <FreeBedSlot key={key} slotKey={slotKey} slug={slug} roomTypeId={roomType.roomTypeId} />
    ) : (
      <InfoFreeSlot key={key} typeAvailable={typeState === "available"} />
    );

  return (
    <section className="overflow-hidden rounded-card border-[1.5px] border-line border-l-[5px] border-l-(--tone) bg-paper shadow-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-16 w-full cursor-pointer items-center justify-between gap-3 px-5 py-3 text-left focus-visible:outline-[3px] focus-visible:outline-offset-[-3px] focus-visible:outline-(--tone)"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block font-display text-[17px] font-bold leading-tight text-ink">{title}</span>
          <span className="block text-[13px] text-ink-faint">
            {roomType.occupiedCount} {roomType.occupiedCount === 1 ? "residente" : "residentes"}
            {(roomType.availableCount ?? 0) > 0 && ` · ${roomType.availableCount} ${roomType.availableCount === 1 ? "cama libre" : "camas libres"}`}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {typeState && <StatusTag mode={typeAvailabilityMode(typeState)} roomTypeName={roomType.roomTypeName} />}
          <Icon
            name="expand_more"
            className={`text-2xl text-(--tone-700) transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {/* Animación de altura vía grid-rows 0fr→1fr (contenido siempre
          montado, sin saltos bruscos al expandir/colapsar). */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-[var(--ease-fresh)] ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-line px-4 pb-4 pt-4 sm:px-5">
            {hasRooms ? (
              <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {/* Desglose por habitación física — quién vive en cada una
                    y qué camas quedan libres, en grilla tipo masonry
                    (columnas CSS) para que cada card ocupe solo la altura
                    de su propio contenido, sin huecos grandes al lado de
                    una habitación expandida (Ciclo 35octodevicies). */}
                {roomType.rooms.map((room) => (
                  <div
                    key={room.roomId}
                    className="h-full rounded-[18px] border border-line bg-cream/70 p-3 transition-shadow duration-300 hover:shadow-card"
                  >
                    <div className="mb-2.5 flex items-center justify-between gap-3 px-1">
                      <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
                        <Icon name="meeting_room" className="text-base text-(--tone-700)" />
                        {room.label}
                      </p>
                      <span
                        className={`text-xs font-semibold ${room.freeBeds > 0 ? "text-success-fg" : "text-ink-faint"}`}
                      >
                        {room.occupiedCount}/{room.capacityPerRoom}{" "}
                        {room.capacityPerRoom === 1 ? "cama" : "camas"}
                        {room.freeBeds > 0 && ` · ${room.freeBeds} libre${room.freeBeds > 1 ? "s" : ""}`}
                      </span>
                    </div>
                    <div className="grid gap-2.5">
                      {cards
                        .filter((c) => c.roomId === room.roomId)
                        .map((card) => (
                          <ResidentCell key={card.residentStayId} card={card} index={indexOf(card)} isGuest={isGuest} />
                        ))}
                      {Array.from({ length: room.freeBeds }, (_, i) =>
                        renderFreeSlot(`slot-${room.roomId}-${i}`, `${roomType.roomTypeId}-slot-${room.roomId}-${i}`),
                      )}
                    </div>
                  </div>
                ))}
                {unassigned.length > 0 && (
                  <div className="rounded-[18px] border border-line bg-cream/70 p-3">
                    <p className="mb-2.5 px-1 text-sm font-bold text-ink-soft">Sin habitación asignada</p>
                    <div className="grid gap-2.5">
                      {unassigned.map((card) => (
                        <ResidentCell key={card.residentStayId} card={card} index={indexOf(card)} isGuest={isGuest} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Fallback: la residencia no cargó habitaciones físicas todavía */
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {cards.map((card) => (
                  <ResidentCell key={card.residentStayId} card={card} index={indexOf(card)} isGuest={isGuest} />
                ))}
                {Array.from({ length: roomType.availableCount ?? 0 }, (_, i) =>
                  renderFreeSlot(`slot-${i}`, `${roomType.roomTypeId}-slot-${i}`),
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function CommunityBrowser({
  summary,
  slug,
  isGuest,
  allowSelection = true,
}: {
  summary: CommunitySummary;
  slug: string;
  isGuest: boolean;
  /** `false` donde no se está buscando lugar (p. ej. "Mi residencia"): sin "Elegí este lugar" ni "Enviar solicitud". */
  allowSelection?: boolean;
}) {
  const cardsByRoomType = useMemo(() => {
    const map = new Map<string | null, CommunityProfileCard[]>();
    for (const card of summary.cards) {
      const list = map.get(card.roomTypeId) ?? [];
      list.push(card);
      map.set(card.roomTypeId, list);
    }
    return map;
  }, [summary.cards]);

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

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const typeKey = (rt: CommunityRoomTypeSummary) => rt.roomTypeId ?? "sin-tipo";
  const shownSections = sections.filter((rt) => typeFilter === "all" || typeKey(rt) === typeFilter);

  return (
    <div className="min-w-0 space-y-5">
      {/* Resumen: agregados de la casa (sin datos individuales) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-3.5 lg:grid-cols-3">
        <MetricCard
          icon="groups"
          label="Residentes"
          value={summary.totalResidents}
          unit="actuales"
          hint="Cada uno decide qué mostrar."
        />
        {summary.totalAvailable > 0 && (
          <MetricCard
            icon="bed"
            label="Camas libres"
            value={summary.totalAvailable}
            hint="Informadas por la residencia."
            progress={{
              label: `${summary.totalResidents} ocupadas de ${totalPlaces}`,
              parts: [
                { pct: (summary.totalResidents / totalPlaces) * 100, kind: "main" },
                { pct: (summary.totalAvailable / totalPlaces) * 100, kind: "rest" },
              ],
            }}
          />
        )}
        <MetricCard
          className="col-span-2 lg:col-span-1"
          icon="category"
          label="Tipos de habitación"
          value={sections.length}
          hint={sections.map((rt) => rt.roomTypeName).slice(0, 3).join(" · ")}
        />
      </div>

      {sections.length > 1 && (
        <FilterChips
          label="Filtrar por tipo de habitación"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: "all", label: "Todos", count: summary.totalResidents },
            ...sections.map((rt) => ({
              value: typeKey(rt),
              label: rt.genderPolicyLabel ? `${rt.roomTypeName} ${rt.genderPolicyLabel}` : rt.roomTypeName,
              count: rt.occupiedCount,
            })),
          ]}
        />
      )}

      {sections.length === 0 ? (
        <EmptyState icon="groups" title="Todavía no hay comunidad para mostrar" description="Cuando haya residentes con perfil visible, los vas a ver acá." />
      ) : (
        <div className="grid gap-4">
          {shownSections.map((rt) => {
            const i = sections.indexOf(rt);
            return (
              <RoomTypeSection
                key={typeKey(rt)}
                roomType={rt}
                cards={cardsByRoomType.get(rt.roomTypeId) ?? []}
                slug={slug}
                isGuest={isGuest}
                startIndex={sectionStartIndex[i]}
                allowSelection={allowSelection}
                defaultOpen={i === 0 || typeFilter !== "all" || sections.length <= 2}
              />
            );
          })}
        </div>
      )}

      {/* Footer CTA — ref: "Podés seleccionar un lugar disponible..." */}
      {allowSelection && summary.totalAvailable > 0 && (
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
  );
}
