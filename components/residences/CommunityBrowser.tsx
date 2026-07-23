"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useReservationSelection } from "@/components/residences/reservationSelection";
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
      <div className="flex items-center gap-3 rounded-field border border-line bg-cream-2 p-3">
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
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="flex w-full cursor-pointer items-center gap-3 rounded-field border border-line bg-paper p-3 text-left transition-colors hover:border-line-2 hover:bg-cream-2"
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
          className="benefit-fade-in absolute left-1/2 top-full z-30 mt-2 w-72 -translate-x-1/2 rounded-card border-[1.5px] border-line bg-paper p-5 text-left shadow-float"
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
        className="group flex items-center gap-3 rounded-field border-2 border-dashed border-success-fg/40 bg-success-bg/40 p-3 transition-colors duration-300 hover:bg-success-bg"
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
      className={`group flex w-full items-center gap-3 rounded-field border-2 p-3 text-left transition-all duration-300 ${
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
}: {
  roomType: CommunityRoomTypeSummary;
  cards: CommunityProfileCard[];
  slug: string;
  isGuest: boolean;
  startIndex: number;
}) {
  const [open, setOpen] = useState(true);
  const title = roomType.genderPolicyLabel ? `${roomType.roomTypeName} ${roomType.genderPolicyLabel}` : roomType.roomTypeName;

  const hasRooms = roomType.rooms.length > 0;
  const unassigned = cards.filter((c) => !c.roomId || !roomType.rooms.some((r) => r.roomId === c.roomId));
  const indexOf = (card: CommunityProfileCard) => startIndex + cards.indexOf(card);

  // Disponibilidad de un vistazo en vez de "N habitaciones / X/Y
  // ocupadas" — esa info ya está en el desglose por tipo de arriba
  // (pedido del dueño en Ciclo 35octodevicies).
  const freeBeds = hasRooms
    ? roomType.rooms.reduce((sum, r) => sum + r.freeBeds, 0)
    : (roomType.availableCount ?? 0);
  const availability =
    freeBeds === 0
      ? { dot: "bg-danger-fg", classes: "bg-danger-bg text-danger-fg", label: "Sin disponibilidad" }
      : freeBeds === 1
        ? { dot: "bg-warning-fg", classes: "bg-warning-bg text-warning-fg", label: "1 cama libre" }
        : { dot: "bg-success-fg", classes: "bg-success-bg text-success-fg", label: `${freeBeds} camas libres` };

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
          <span className={`inline-flex items-center gap-1.5 rounded-field px-2.5 py-1 text-xs font-semibold ${availability.classes}`}>
            <span className={`h-2 w-2 shrink-0 rounded-full ${availability.dot}`} aria-hidden />
            {availability.label}
          </span>
          <Icon
            name="expand_more"
            className={`text-xl text-forest-700 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
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
          <div className="border-t border-line px-4 pb-4 pt-4">
            {hasRooms ? (
              <div className="columns-1 gap-3 xl:columns-2">
                {/* Desglose por habitación física — quién vive en cada una
                    y qué camas quedan libres, en grilla tipo masonry
                    (columnas CSS) para que cada card ocupe solo la altura
                    de su propio contenido, sin huecos grandes al lado de
                    una habitación expandida (Ciclo 35octodevicies). */}
                {roomType.rooms.map((room) => (
                  <div
                    key={room.roomId}
                    className="mb-3 break-inside-avoid rounded-field border border-line bg-cream-2/60 p-3 transition-shadow duration-300 hover:shadow-card"
                  >
                    <div className="mb-2.5 flex items-center justify-between gap-3 px-1">
                      <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
                        <Icon name="meeting_room" className="text-base text-forest-700" />
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
                      {Array.from({ length: room.freeBeds }, (_, i) => (
                        <FreeBedSlot
                          key={`slot-${room.roomId}-${i}`}
                          slotKey={`${roomType.roomTypeId}-slot-${room.roomId}-${i}`}
                          slug={slug}
                          roomTypeId={roomType.roomTypeId}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                {unassigned.length > 0 && (
                  <div className="mb-3 break-inside-avoid rounded-field border border-line bg-cream-2/60 p-3">
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
              <div className="grid gap-3 sm:grid-cols-2">
                {cards.map((card) => (
                  <ResidentCell key={card.residentStayId} card={card} index={indexOf(card)} isGuest={isGuest} />
                ))}
                {Array.from({ length: roomType.availableCount ?? 0 }, (_, i) => (
                  <FreeBedSlot
                    key={`slot-${i}`}
                    slotKey={`${roomType.roomTypeId}-slot-${i}`}
                    slug={slug}
                    roomTypeId={roomType.roomTypeId}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
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

  return (
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

      {/* Secciones por tipo de habitación — grilla tipo masonry (columnas
          CSS): cada card ocupa solo su propia altura, sin huecos grandes
          al lado de una categoría expandida (Ciclo 35octodevicies). */}
      <div className="columns-1 gap-4 lg:columns-2">
        {sections.map((rt, i) => (
          <div key={rt.roomTypeId ?? "sin-tipo"} className="mb-4 break-inside-avoid">
            <RoomTypeSection
              roomType={rt}
              cards={cardsByRoomType.get(rt.roomTypeId) ?? []}
              slug={slug}
              isGuest={isGuest}
              startIndex={sectionStartIndex[i]}
            />
          </div>
        ))}
      </div>

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
  );
}
