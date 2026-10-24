"use client";

import { useEffect, useMemo, useState, useActionState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatArs, formatUsd, usdToArsRounded } from "@/lib/mock/exchange";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import {
  renameRoomAction,
  setBedStatusAction,
  assignStayToBedAction,
  type RoomsActionState,
} from "@/app/residence/[residence_id]/rooms/actions";
import { endResidentStayAction } from "@/app/residence/[residence_id]/residents/actions";
import { AvailabilityForm } from "@/app/residence/[residence_id]/availability/AvailabilityForm";

export type BedData = {
  id: string;
  letter: string;
  status: "active" | "out_of_service";
  reason: string | null;
  occupant: {
    stayId: string;
    name: string;
    pending: boolean;
    until: string | null;
    flag: string | null;
    nationality: string | null;
  } | null;
};

export type RoomData = { id: string; label: string; beds: BedData[] };

export type AvailabilityData = {
  status: string;
  availableCount: number | null;
  availableFrom: string | null;
  notesPublic: string | null;
};

export type RoomsData = {
  groups: {
    id: string;
    name: string;
    genderPolicy: string | null;
    bathroomType: string | null;
    capacityPerRoom: number;
    priceUsd: number;
    rooms: RoomData[];
    availability: AvailabilityData | null;
  }[];
  unassigned: { stayId: string; name: string; pending: boolean; roomTypeId: string | null }[];
  kpis: {
    roomsCount: number;
    bedsCount: number;
    occupiedCount: number;
    outOfServiceCount: number;
    vacantTotal: number;
    upcomingArrivals: number;
    upcomingDepartures: number;
    activeRenewals: number;
  };
};

const initialState: RoomsActionState = { status: "idle" };

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function formatUntil(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const [y, m] = dateStr.split("-").map(Number);
  if (!y || !m) return null;
  return `Hasta ${MONTHS[m - 1]} ${y}`;
}

function genderChip(policy: string | null): { label: string; className: string } | null {
  if (policy === "solo_mujeres") return { label: "FEM", className: "bg-orange-tint text-orange-700" };
  if (policy === "solo_hombres") return { label: "MASC", className: "bg-info-bg text-info-fg" };
  if (policy === "mixto") return { label: "MIX", className: "bg-sand-100 text-ink-soft" };
  return null;
}

function AvatarInitial({ name, index, flag }: { name: string; index: number; flag?: string | null }) {
  const styles = ["bg-forest-tint text-forest-700", "bg-orange-tint text-orange-700", "bg-mint text-forest-700", "bg-sand-100 text-ink-soft"];
  return (
    <span className="relative shrink-0">
      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${styles[index % styles.length]}`}>
        {name[0]?.toUpperCase() ?? "?"}
      </span>
      {flag && (
        <span
          className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-paper text-[9px] leading-none shadow-sm ring-1 ring-paper"
          aria-hidden
        >
          {flag}
        </span>
      )}
    </span>
  );
}

/* ==================== Modal de gestión de habitación ==================== */

function RenameForm({ residenceId, room }: { residenceId: string; room: RoomData }) {
  const action = renameRoomAction.bind(null, residenceId, room.id);
  const [state, formAction, isPending] = useActionState(action, initialState);
  return (
    <form action={formAction}>
      <label htmlFor={`room-label-${room.id}`} className="mb-1.5 block text-sm font-bold text-ink">
        Nombre / número
      </label>
      <div className="flex gap-2">
        <input
          id={`room-label-${room.id}`}
          name="label"
          defaultValue={room.label}
          maxLength={40}
          required
          className="w-full rounded-field border-[1.5px] border-field-border bg-cream px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 cursor-pointer rounded-full border-[1.5px] border-line px-4 py-2 text-sm font-bold text-ink-soft hover:border-forest hover:text-forest-700"
        >
          {isPending ? "…" : "Guardar"}
        </button>
      </div>
      {state.status === "error" && <p className="mt-1.5 text-xs font-medium text-danger-fg">{state.message}</p>}
      {state.status === "saved" && <p className="mt-1.5 text-xs font-medium text-success-fg">Nombre actualizado.</p>}
    </form>
  );
}

function BedRow({
  residenceId,
  bed,
  unassigned,
}: {
  residenceId: string;
  bed: BedData;
  unassigned: RoomsData["unassigned"];
}) {
  const [mode, setMode] = useState<"idle" | "assign" | "oos">("idle");

  const oosAction = setBedStatusAction.bind(null, residenceId, bed.id, "out_of_service");
  const [oosState, oosFormAction, oosPending] = useActionState(oosAction, initialState);
  const reactivateAction = setBedStatusAction.bind(null, residenceId, bed.id, "active");
  const [reactState, reactFormAction, reactPending] = useActionState(reactivateAction, initialState);
  const assignAction = assignStayToBedAction.bind(null, residenceId, bed.id);
  const [assignState, assignFormAction, assignPending] = useActionState(assignAction, initialState);
  const endStayAction = bed.occupant
    ? endResidentStayAction.bind(null, residenceId, bed.occupant.stayId)
    : endResidentStayAction.bind(null, residenceId, "");
  const [endState, endFormAction, endPending] = useActionState(endStayAction, initialState);

  if (bed.occupant) {
    return (
      <div className="rounded-field border border-line bg-paper p-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-field bg-forest-tint text-sm font-bold text-forest-700">
            {bed.letter}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{bed.occupant.name}</p>
            <p className="text-xs text-ink-soft">
              {bed.occupant.pending
                ? "Pendiente de activar cuenta"
                : (formatUntil(bed.occupant.until) ?? "Sin fecha de salida cargada")}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
          <Link
            href={`/residence/${residenceId}/residents?stay=${bed.occupant.stayId}`}
            className="inline-flex cursor-pointer items-center gap-1 rounded-full border-[1.5px] border-line px-3 py-1.5 text-xs font-bold text-ink-soft hover:border-forest hover:text-forest-700"
          >
            Gestionar residente
            <Icon name="arrow_forward" className="text-sm" />
          </Link>
          <form
            action={endFormAction}
            onSubmit={(e) => {
              if (!confirm(`¿Liberar la plaza de ${bed.occupant!.name}? Esto cierra su estadía actual.`)) {
                e.preventDefault();
              }
            }}
          >
            <button
              type="submit"
              disabled={endPending}
              className="cursor-pointer rounded-full border-[1.5px] border-danger-fg/40 px-3 py-1.5 text-xs font-bold text-danger-fg hover:bg-danger-bg disabled:opacity-50"
            >
              {endPending ? "…" : "Liberar plaza"}
            </button>
          </form>
        </div>
        {endState.status === "error" && (
          <p className="mt-1.5 text-xs font-medium text-danger-fg">{endState.message}</p>
        )}
      </div>
    );
  }

  if (bed.status === "out_of_service") {
    return (
      <div className="rounded-field border border-orange/40 bg-warning-bg p-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-field bg-orange-tint text-sm font-bold text-orange-700">
            {bed.letter}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-warning-fg">Fuera de servicio</p>
            {bed.reason && <p className="truncate text-xs text-warning-fg/80">Razón: {bed.reason}</p>}
          </div>
          <form action={reactFormAction}>
            <button
              type="submit"
              disabled={reactPending}
              className="cursor-pointer rounded-full border border-orange/50 px-3 py-1.5 text-xs font-bold text-warning-fg hover:bg-orange-tint"
            >
              {reactPending ? "…" : "Reactivar"}
            </button>
          </form>
        </div>
        {reactState.status === "error" && (
          <p className="mt-1.5 text-xs font-medium text-danger-fg">{reactState.message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-field border-2 border-dashed border-success-fg/40 bg-success-bg/40 p-3">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-field bg-success-bg text-sm font-bold text-success-fg">
          {bed.letter}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-success-fg">Disponible</p>
          <p className="text-xs text-success-fg/80">Se cuenta como lugar libre</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => setMode(mode === "assign" ? "idle" : "assign")}
            title="Asignar residente"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-forest text-white hover:bg-forest-600"
          >
            <Icon name="person_add" className="text-base" />
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "oos" ? "idle" : "oos")}
            title="Marcar fuera de servicio"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-orange-tint text-orange-700 hover:bg-orange/30"
          >
            <Icon name="block" className="text-base" />
          </button>
        </div>
      </div>

      {mode === "assign" && (
        <form action={assignFormAction} className="mt-3 flex gap-2 border-t border-success-fg/20 pt-3">
          <select
            name="resident_stay_id"
            required
            defaultValue=""
            className="w-full rounded-field border-[1.5px] border-field-border bg-paper px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none"
          >
            <option value="" disabled>
              Elegí un residente sin cama…
            </option>
            {unassigned.map((u) => (
              <option key={u.stayId} value={u.stayId}>
                {u.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={assignPending || unassigned.length === 0}
            className="shrink-0 cursor-pointer rounded-full bg-forest px-4 py-2 text-sm font-bold text-white hover:bg-forest-600 disabled:opacity-50"
          >
            {assignPending ? "…" : "Asignar"}
          </button>
        </form>
      )}
      {mode === "assign" && unassigned.length === 0 && (
        <p className="mt-1.5 text-xs text-ink-soft">No hay residentes sin cama. Cargalos desde Residentes.</p>
      )}
      {assignState.status === "error" && (
        <p className="mt-1.5 text-xs font-medium text-danger-fg">{assignState.message}</p>
      )}

      {mode === "oos" && (
        <form action={oosFormAction} className="mt-3 flex gap-2 border-t border-success-fg/20 pt-3">
          <input
            name="reason"
            placeholder="Razón (ej: mantenimiento aire acondicionado)"
            className="w-full rounded-field border-[1.5px] border-field-border bg-paper px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none"
          />
          <button
            type="submit"
            disabled={oosPending}
            className="shrink-0 cursor-pointer rounded-full bg-orange px-4 py-2 text-sm font-bold text-white hover:opacity-90"
          >
            {oosPending ? "…" : "Confirmar"}
          </button>
        </form>
      )}
      {oosState.status === "error" && <p className="mt-1.5 text-xs font-medium text-danger-fg">{oosState.message}</p>}
    </div>
  );
}

function RoomModal({
  residenceId,
  room,
  roomTypeId,
  typeName,
  capacity,
  priceUsd,
  arsPerUsd,
  availability,
  unassigned,
  onClose,
}: {
  residenceId: string;
  room: RoomData;
  roomTypeId: string;
  typeName: string;
  capacity: number;
  priceUsd: number;
  arsPerUsd: number;
  availability: AvailabilityData | null;
  unassigned: RoomsData["unassigned"];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-forest-ink/60" onClick={onClose} aria-hidden />
      <div className="animate-modal-in relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-card bg-paper shadow-float">
        <div className="flex items-start justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-ink">
              <Icon name="meeting_room" className="text-2xl text-forest-700" />
              Gestión de {room.label}
            </h2>
            <p className="mt-0.5 text-sm text-ink-soft">
              {typeName} · {capacity} {capacity === 1 ? "plaza" : "plazas"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="cursor-pointer rounded-full p-1.5 text-ink-soft hover:bg-cream-2"
          >
            <Icon name="close" className="text-2xl" />
          </button>
        </div>

        <div className="grid flex-1 gap-6 overflow-y-auto p-6 sm:grid-cols-[260px_1fr]">
          <div className="space-y-5">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted">Configuración</p>
            <RenameForm residenceId={residenceId} room={room} />
            <div>
              <p className="text-sm font-bold text-ink">Tarifa mensual</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                {formatUsd(priceUsd)} <span className="text-xs text-ink-faint">
                  ≈ {formatArs(usdToArsRounded(priceUsd, arsPerUsd))}
                  <ExchangeRateNote />
                </span>
              </p>
              <Link
                href={`/residence/${residenceId}/profile`}
                className="mt-1 inline-block text-xs font-semibold text-forest-700 hover:underline"
              >
                Editar tarifa en la configuración →
              </Link>
            </div>
            <p className="rounded-field bg-cream-2 px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
              Una cama fuera de servicio no se cuenta como lugar libre.
            </p>
            <div>
              <p className="text-sm font-bold text-ink">Disponibilidad publicada</p>
              <p className="mt-0.5 text-xs text-ink-faint">Se aplica a todo el tipo &ldquo;{typeName}&rdquo;, no solo a esta habitación.</p>
              {availability ? (
                <AvailabilityForm
                  residenceId={residenceId}
                  roomTypeId={roomTypeId}
                  currentStatus={availability.status}
                  currentAvailableCount={availability.availableCount}
                  currentAvailableFrom={availability.availableFrom}
                  currentNotesPublic={availability.notesPublic}
                />
              ) : (
                <p className="mt-2 text-xs text-ink-faint">Todavía no se cargó disponibilidad para este tipo.</p>
              )}
            </div>
          </div>

          <div>
            <p className="mb-3 text-[10px] font-extrabold uppercase tracking-widest text-muted">Plazas (camas)</p>
            <div className="space-y-2.5">
              {room.beds.map((bed) => (
                <BedRow key={bed.id} residenceId={residenceId} bed={bed} unassigned={unassigned} />
              ))}
              {room.beds.length === 0 && (
                <p className="text-sm text-ink-soft">
                  Esta habitación no tiene camas cargadas — guardá la configuración para regenerarlas.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-line px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full bg-forest px-5 py-2 text-sm font-bold text-white hover:bg-forest-600"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==================== Página ==================== */

export function RoomsBrowser({
  residenceId,
  data,
  arsPerUsd,
}: {
  residenceId: string;
  data: RoomsData;
  arsPerUsd: number;
}) {
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [onlyVacant, setOnlyVacant] = useState(false);
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);

  // Accesibilidad: el modal de gestión debe poder cerrarse con teclado, no solo clickeando afuera.
  useEffect(() => {
    if (!openRoomId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenRoomId(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openRoomId]);

  const { groups, unassigned, kpis } = data;

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups
      .filter((g) => !typeFilter || g.id === typeFilter)
      .map((g) => ({
        ...g,
        rooms: g.rooms.filter((room) => {
          if (onlyVacant && !room.beds.some((b) => b.status === "active" && !b.occupant)) return false;
          if (!q) return true;
          return (
            room.label.toLowerCase().includes(q) ||
            room.beds.some((b) => b.occupant?.name.toLowerCase().includes(q))
          );
        }),
      }))
      .filter((g) => g.rooms.length > 0);
  }, [groups, typeFilter, search, onlyVacant]);

  const openRoom = groups.flatMap((g) => g.rooms.map((room) => ({ room, group: g }))).find((r) => r.room.id === openRoomId);
  const operativeBeds = kpis.bedsCount - kpis.outOfServiceCount;
  const occupancyPercent = operativeBeds > 0 ? Math.min(100, Math.round((kpis.occupiedCount / operativeBeds) * 100)) : 0;

  // Desglose de vacantes por tipo de habitación (Ciclo 41) — dentro de
  // cada tipo, por género según su gender_policy. El total agregado
  // FEM/MASC de arriba mezclaba todos los tipos; esto muestra "dónde"
  // hay lugar realmente.
  const vacancyByType = useMemo(
    () =>
      groups
        .map((g) => ({
          id: g.id,
          name: g.name,
          chip: genderChip(g.genderPolicy),
          vacant: g.rooms.flatMap((r) => r.beds).filter((b) => b.status === "active" && !b.occupant).length,
        }))
        .filter((t) => t.vacant > 0),
    [groups],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-ink">Habitaciones</h1>
        <p className="mt-1 text-ink-soft">Disponibilidad y tarifas, en un pantallazo.</p>
      </div>

      {/* KPIs — ref: Habitaciones/Plazas · Ocupación · Vacantes · Movimientos */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="flex items-center justify-between text-sm font-semibold text-ink-soft">
            Habitaciones y plazas <Icon name="meeting_room" className="text-xl text-muted" />
          </p>
          <p className="mt-2 text-3xl font-extrabold text-ink">
            {kpis.roomsCount} <span className="text-lg font-bold text-ink-faint">{kpis.roomsCount === 1 ? "habitación" : "habitaciones"} · {kpis.bedsCount} {kpis.bedsCount === 1 ? "plaza" : "plazas"}</span>
          </p>
          {kpis.outOfServiceCount > 0 && (
            <p className="mt-1 text-xs text-ink-faint">
              {operativeBeds} operativas ({kpis.outOfServiceCount} fuera de servicio)
            </p>
          )}
        </Card>
        <Card className="p-5">
          <p className="flex items-center justify-between text-sm font-semibold text-ink-soft">
            Ocupación <Icon name="data_usage" className="text-xl text-muted" />
          </p>
          <p className="mt-2 flex items-center gap-2">
            <span className="text-3xl font-extrabold text-ink">{occupancyPercent}%</span>
            {kpis.outOfServiceCount > 0 && (
              <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-bold text-warning-fg">
                Fuera de servicio: {kpis.outOfServiceCount}
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            {kpis.occupiedCount} de {operativeBeds} plazas operativas ocupadas
          </p>
        </Card>
        <Card className="p-5">
          <p className="flex items-center justify-between text-sm font-semibold text-ink-soft">
            Vacantes actuales <Icon name="bed" className="text-xl text-muted" />
          </p>
          <p className="mt-2 text-3xl font-extrabold text-ink">
            {kpis.vacantTotal} {kpis.vacantTotal === 1 ? "vacante" : "vacantes"}
          </p>
          {vacancyByType.length > 0 && (
            <ul className="mt-2 space-y-1">
              {vacancyByType.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 truncate text-ink-soft">
                    {t.name}
                    {t.chip && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${t.chip.className}`}>
                        {t.chip.label}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-bold text-ink">{t.vacant}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <p className="flex items-center justify-between text-sm font-semibold text-ink-soft">
            Movimientos próximos <Icon name="sync_alt" className="text-xl text-muted" />
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="flex items-center gap-1 rounded-full bg-success-bg px-2.5 py-1 text-sm font-bold text-success-fg">
              <Icon name="login" className="text-base" /> {kpis.upcomingArrivals}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-danger-bg px-2.5 py-1 text-sm font-bold text-danger-fg">
              <Icon name="logout" className="text-base" /> {kpis.upcomingDepartures}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-info-bg px-2.5 py-1 text-sm font-bold text-info-fg">
              <Icon name="autorenew" className="text-base" /> {kpis.activeRenewals}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-faint">Ingresos · salidas (30 días) · renovaciones</p>
        </Card>
      </div>

      {unassigned.length > 0 && (
        <p className="mt-4 flex items-center gap-2 rounded-field border border-orange/40 bg-warning-bg px-3.5 py-2.5 text-sm text-warning-fg">
          <Icon name="info" className="text-lg" />
          {unassigned.length} residente{unassigned.length > 1 ? "s" : ""} sin cama asignada — abrí una habitación
          con lugar y usá &ldquo;Asignar&rdquo;.
        </p>
      )}

      {/* Búsqueda + filtros */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-card border-[1.5px] border-line bg-paper p-4 shadow-card">
        <div className="relative min-w-56 flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-ink-faint" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar habitación o residente…"
            className="w-full rounded-field border-[1.5px] border-field-border bg-cream py-2 pl-10 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-forest focus:outline-none"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink-soft">
          <input
            type="checkbox"
            checked={onlyVacant}
            onChange={(e) => setOnlyVacant(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-forest)]"
          />
          Solo vacantes
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTypeFilter(null)}
          className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${
            typeFilter === null ? "bg-forest-ink text-white" : "border-[1.5px] border-line bg-paper text-ink-soft hover:border-line-2"
          }`}
        >
          Todos
        </button>
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setTypeFilter(typeFilter === g.id ? null : g.id)}
            className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${
              typeFilter === g.id ? "bg-forest-ink text-white" : "border-[1.5px] border-line bg-paper text-ink-soft hover:border-line-2"
            }`}
          >
            {g.name} ({g.rooms.length})
          </button>
        ))}
      </div>

      {/* Grupos por tipo */}
      {filteredGroups.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon="meeting_room"
            title="Sin habitaciones para mostrar"
            description="Ajustá los filtros, o definí la cantidad de habitaciones por tipo en la configuración."
          />
        </div>
      ) : (
        filteredGroups.map((g) => {
          const vacants = g.rooms.reduce(
            (sum, room) => sum + room.beds.filter((b) => b.status === "active" && !b.occupant).length,
            0,
          );
          return (
            <section key={g.id} className="mt-8">
              <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-bold text-ink">{g.name}</h2>
                  <span className="rounded-field bg-sand-100 px-2 py-1 text-xs font-semibold text-ink-soft">
                    {g.rooms.length} {g.rooms.length === 1 ? "habitación" : "habitaciones"}
                  </span>
                  {vacants > 0 && (
                    <span className="rounded-field bg-success-bg px-2 py-1 text-xs font-semibold text-success-fg">
                      {vacants} {vacants === 1 ? "vacante" : "vacantes"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted">Tarifa base</p>
                    <p className="font-bold text-ink">
                      {formatUsd(g.priceUsd)}
                      <span className="ml-1.5 text-xs font-normal text-ink-faint">
                        ≈ {formatArs(usdToArsRounded(g.priceUsd, arsPerUsd))}
                        <ExchangeRateNote />
                      </span>
                    </p>
                  </div>
                  <Link
                    href={`/residence/${residenceId}/profile`}
                    className="flex items-center gap-1 text-sm font-bold text-forest-700 hover:underline"
                  >
                    <Icon name="edit" className="text-base" /> Editar tarifa
                  </Link>
                </div>
              </Card>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.rooms.map((room) => {
                  const activeBedCount = room.beds.filter((b) => b.status === "active").length;
                  const occupied = room.beds.filter((b) => b.occupant).length;
                  const free = room.beds.filter((b) => b.status === "active" && !b.occupant).length;
                  const inMaintenance = room.beds.length > 0 && activeBedCount === 0;
                  const gChip = genderChip(g.genderPolicy);
                  const oosReason = room.beds.find((b) => b.reason)?.reason;

                  return (
                    <div
                      key={room.id}
                      className={`flex flex-col rounded-card border-[1.5px] p-5 shadow-card ${
                        inMaintenance ? "border-orange/40 bg-warning-bg/40" : "border-line bg-paper"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-ink">{room.label}</h3>
                        <div className="flex gap-1.5">
                          {inMaintenance ? (
                            <span className="rounded-full bg-orange-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-700">
                              Mantenimiento
                            </span>
                          ) : (
                            <>
                              {gChip && (
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${gChip.className}`}>
                                  {gChip.label}
                                </span>
                              )}
                              {g.bathroomType && (
                                <span
                                  className="rounded-full bg-sand-100 px-2 py-0.5 text-[10px] font-bold uppercase text-ink-soft"
                                  title={`Baño ${g.bathroomType}`}
                                >
                                  {g.bathroomType === "privado" ? "BP" : "BC"}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand-200">
                          <div
                            className={`h-full rounded-full ${occupied === activeBedCount && activeBedCount > 0 ? "bg-forest" : "bg-success-fg"}`}
                            style={{ width: activeBedCount > 0 ? `${(occupied / activeBedCount) * 100}%` : "0%" }}
                          />
                        </div>
                        <span className="text-xs font-bold text-ink-soft">
                          {inMaintenance ? "—" : `${occupied}/${activeBedCount}`}
                        </span>
                      </div>

                      {inMaintenance ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
                          <Icon name="construction" className="text-3xl text-orange-700" />
                          <p className="text-sm text-warning-fg">{oosReason ?? "Habitación fuera de servicio."}</p>
                        </div>
                      ) : (
                        <div className="mt-3 flex-1 space-y-2">
                          {room.beds
                            .filter((b) => b.occupant)
                            .map((b, i) => (
                              <div key={b.id} className="flex items-center gap-2.5">
                                <AvatarInitial name={b.occupant!.name} index={i} flag={b.occupant!.flag} />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-ink">
                                    {b.occupant!.name}
                                    {b.occupant!.nationality && (
                                      <span className="font-normal text-ink-faint"> · {b.occupant!.nationality}</span>
                                    )}
                                  </p>
                                  <p className="text-xs text-ink-faint">
                                    {b.occupant!.pending
                                      ? "Pendiente de activación"
                                      : (formatUntil(b.occupant!.until) ?? "Sin fecha de salida")}
                                  </p>
                                </div>
                              </div>
                            ))}
                          {free > 0 && (
                            <div className="flex items-center justify-center gap-1.5 rounded-field border-2 border-dashed border-success-fg/40 bg-success-bg/40 px-3 py-2 text-sm font-bold text-success-fg">
                              <Icon name="add_circle" className="text-base" />
                              {free === 1 ? "Cama disponible" : `${free} camas disponibles`}
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setOpenRoomId(room.id)}
                        className={`mt-4 w-full cursor-pointer rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                          free > 0 && !inMaintenance
                            ? "bg-forest text-white hover:bg-forest-600"
                            : "border-[1.5px] border-line text-ink-soft hover:border-forest hover:text-forest-700"
                        }`}
                      >
                        {inMaintenance ? "Ver estado" : "Gestionar"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      {openRoom && (
        <RoomModal
          residenceId={residenceId}
          room={openRoom.room}
          typeName={openRoom.group.name}
          roomTypeId={openRoom.group.id}
          capacity={openRoom.group.capacityPerRoom}
          priceUsd={openRoom.group.priceUsd}
          arsPerUsd={arsPerUsd}
          unassigned={unassigned}
          availability={openRoom.group.availability}
          onClose={() => setOpenRoomId(null)}
        />
      )}
    </div>
  );
}
