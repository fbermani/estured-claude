"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useActionState } from "react";
import { ResidenceHero } from "@/components/residences/ResidenceHero";
import { BackToProfileLink } from "@/components/residences/BackToProfileLink";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatArs, formatUsd, usdToArsRounded } from "@/lib/mock/exchange";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { PermissionNote } from "@/components/residences/PermissionGate";
import {
  renameRoomAction,
  setRoomGenderAction,
  setBedStatusAction,
  assignStayToBedAction,
  setRoomsGenderBulkAction,
  setRoomOutOfServiceAction,
  type RoomsActionState,
} from "@/app/residence/[residence_id]/rooms/actions";
import { ROOM_GENDER_LABEL, policyFromGender, type RoomGender } from "@/lib/residences/roomGender";
import { endResidentStayAction } from "@/app/residence/[residence_id]/residents/actions";
import { Input, Select } from "@/components/ui/Input";

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

export type RoomData = { id: string; label: string; gender: RoomGender; beds: BedData[] };

export type RoomsData = {
  groups: {
    id: string;
    name: string;
    genderPolicy: string | null;
    bathroomType: string | null;
    capacityPerRoom: number;
    priceUsd: number;
    rooms: RoomData[];
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

/**
 * Permisos de quien mira (DR11), resueltos en el servidor: `rooms` = habitaciones y camas (la disponibilidad se gestiona en su propia pantalla); `residents` = liberar plaza
 * (cerrar una estadía). Por defecto TODO apagado (falla cerrado). Solo presentación: el servidor valida cada acción por su cuenta.
 */
type RoomsPermissions = { rooms: boolean; residents: boolean };
const RoomsPermissionsContext = createContext<RoomsPermissions>({ rooms: false, residents: false });

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function formatUntil(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const [y, m] = dateStr.split("-").map(Number);
  if (!y || !m) return null;
  return `Hasta ${MONTHS[m - 1]} ${y}`;
}

function roomGenderChip(gender: RoomGender): { label: string; className: string } | null {
  return genderChip(policyFromGender(gender));
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
          className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-paper text-xs leading-none shadow-sm ring-1 ring-paper"
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
      <div className="flex gap-2">
        <Input
          label="Nombre / número"
          id={`room-label-${room.id}`}
          name="label"
          defaultValue={room.label}
          maxLength={40}
          required
          className="flex-1"
        />
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 cursor-pointer rounded-full border-[1.5px] border-line px-4 py-2 text-sm font-bold text-ink-soft hover:border-forest hover:text-forest-700"
        >
          {isPending ? "…" : "Guardar"}
        </button>
      </div>
      {state.status === "error" && <p role="alert" className="mt-1.5 text-xs font-medium text-danger-fg">{state.message}</p>}
      {state.status === "saved" && <p className="mt-1.5 text-xs font-medium text-success-fg">Nombre actualizado.</p>}
    </form>
  );
}

function GenderForm({ residenceId, room, shared }: { residenceId: string; room: RoomData; shared: boolean }) {
  const action = setRoomGenderAction.bind(null, residenceId, room.id);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const options: RoomGender[] = shared ? ["masculino", "femenino", "mixto"] : ["sin_especificar", "masculino", "femenino", "mixto"];
  return (
    <form action={formAction}>
      <div className="flex gap-2">
        <Select label="Género de la habitación" id={`room-gender-${room.id}`} name="gender" defaultValue={room.gender} className="flex-1">
          {options.map((o) => (
            <option key={o} value={o}>
              {ROOM_GENDER_LABEL[o]}
            </option>
          ))}
        </Select>
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 cursor-pointer rounded-full border-[1.5px] border-line px-4 py-2 text-sm font-bold text-ink-soft hover:border-forest hover:text-forest-700"
        >
          {isPending ? "…" : "Guardar"}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-ink-faint">
        {shared ? "Una habitación compartida es masculina, femenina o mixta." : "En las individuales podés dejarlo sin especificar."}
      </p>
      {state.status === "error" && <p role="alert" className="mt-1.5 text-xs font-medium text-danger-fg">{state.message}</p>}
      {state.status === "saved" && <p className="mt-1.5 text-xs font-medium text-success-fg">Género actualizado.</p>}
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
  const perms = useContext(RoomsPermissionsContext);
  const [mode, setMode] = useState<"idle" | "assign" | "oos">("idle");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const endFormRef = useRef<HTMLFormElement>(null);
  const endConfirmed = useRef(false);

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
            ref={endFormRef}
            action={endFormAction}
            onSubmit={(e) => {
              if (endConfirmed.current) {
                endConfirmed.current = false;
                return;
              }
              e.preventDefault();
              setConfirmEnd(true);
            }}
          >
            <button
              type="submit"
              disabled={endPending || !perms.residents}
              className="cursor-pointer rounded-full border-[1.5px] border-danger-fg/40 px-3 py-1.5 text-xs font-bold text-danger-fg hover:bg-danger-bg disabled:opacity-50"
            >
              {endPending ? "…" : "Liberar plaza"}
            </button>
          </form>
        </div>
        {endState.status === "error" && (
          <p role="alert" className="mt-1.5 text-xs font-medium text-danger-fg">{endState.message}</p>
        )}
        <ConfirmDialog
          open={confirmEnd}
          title={`¿Liberar la plaza de ${bed.occupant.name}?`}
          description="Esto cierra su estadía actual."
          confirmLabel="Liberar plaza"
          tone="danger"
          onCancel={() => setConfirmEnd(false)}
          onConfirm={() => {
            setConfirmEnd(false);
            endConfirmed.current = true;
            endFormRef.current?.requestSubmit();
          }}
        />
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
              disabled={reactPending || !perms.rooms}
              className="cursor-pointer rounded-full border border-orange/50 px-3 py-1.5 text-xs font-bold text-warning-fg hover:bg-orange-tint"
            >
              {reactPending ? "…" : "Reactivar"}
            </button>
          </form>
        </div>
        {reactState.status === "error" && (
          <p role="alert" className="mt-1.5 text-xs font-medium text-danger-fg">{reactState.message}</p>
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
            disabled={!perms.rooms}
            title="Asignar residente"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-forest text-white hover:bg-forest-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="person_add" className="text-base" />
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "oos" ? "idle" : "oos")}
            disabled={!perms.rooms}
            title="Marcar fuera de servicio"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-orange-tint text-orange-700 hover:bg-orange/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="block" className="text-base" />
          </button>
        </div>
      </div>

      {mode === "assign" && (
        <form action={assignFormAction} className="mt-3 flex gap-2 border-t border-success-fg/20 pt-3">
          <Select
            label={unassigned.length > 0 ? "Residente sin cama" : "No hay residentes sin cama"}
            name="resident_stay_id"
            required
            defaultValue=""
            className="flex-1"
          >
            <option value="" disabled>
              Elegí un residente sin cama…
            </option>
            {unassigned.map((u) => (
              <option key={u.stayId} value={u.stayId}>
                {u.name}
              </option>
            ))}
          </Select>
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
        <p role="alert" className="mt-1.5 text-xs font-medium text-danger-fg">{assignState.message}</p>
      )}

      {mode === "oos" && (
        <form action={oosFormAction} className="mt-3 flex gap-2 border-t border-success-fg/20 pt-3">
          <Input label="Razón" name="reason" placeholder="Ej: mantenimiento del aire acondicionado" className="flex-1" />
          <button
            type="submit"
            disabled={oosPending}
            className="shrink-0 cursor-pointer rounded-full bg-orange px-4 py-2 text-sm font-bold text-white hover:opacity-90"
          >
            {oosPending ? "…" : "Confirmar"}
          </button>
        </form>
      )}
      {oosState.status === "error" && <p role="alert" className="mt-1.5 text-xs font-medium text-danger-fg">{oosState.message}</p>}
    </div>
  );
}

/** Saca de servicio (o reactiva) la habitación entera: todas sus camas, con una razón. No toca la disponibilidad publicada. */
function RoomOutOfServiceForm({ residenceId, room }: { residenceId: string; room: RoomData }) {
  const allOut = room.beds.length > 0 && room.beds.every((b) => b.status === "out_of_service");
  const action = setRoomOutOfServiceAction.bind(null, residenceId, room.id, !allOut);
  const [state, formAction, isPending] = useActionState(action, initialState);
  if (room.beds.length === 0) return null;
  return (
    <form action={formAction}>
      <p className="text-sm font-bold text-ink">{allOut ? "Habitación fuera de servicio" : "Sacar de servicio"}</p>
      {allOut ? (
        <p className="mt-0.5 text-xs text-ink-faint">{room.beds.find((b) => b.reason)?.reason ?? "Todas sus camas están fuera de servicio."}</p>
      ) : (
        <>
          <p className="mt-0.5 text-xs text-ink-faint">Marca todas las camas como fuera de servicio (no cuentan como lugar libre).</p>
          <Input label="Razón de la baja" name="reason" maxLength={200} placeholder="Ej: mantenimiento" className="mt-2" />
        </>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="mt-2 cursor-pointer rounded-full border-[1.5px] border-line px-4 py-2 text-sm font-bold text-ink-soft hover:border-forest hover:text-forest-700"
      >
        {isPending ? "…" : allOut ? "Reactivar habitación" : "Sacar de servicio"}
      </button>
      {state.status === "error" && <p role="alert" className="mt-1.5 text-xs font-medium text-danger-fg">{state.message}</p>}
    </form>
  );
}

/** Barra de edición en lote: mismo género para las habitaciones elegidas. */
function BulkGenderBar({
  residenceId,
  selectedIds,
  anyShared,
  onDone,
  onCancel,
}: {
  residenceId: string;
  selectedIds: string[];
  anyShared: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const action = setRoomsGenderBulkAction.bind(null, residenceId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const options: RoomGender[] = anyShared ? ["masculino", "femenino", "mixto"] : ["masculino", "femenino", "mixto", "sin_especificar"];
  useEffect(() => {
    if (state.status === "saved") onDone();
    // `onDone` cambia en cada render del padre: solo importa el resultado de la acción.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form
      action={formAction}
      className="sticky bottom-3 z-30 mt-4 flex flex-wrap items-center gap-3 rounded-card border-[1.5px] border-forest bg-paper p-3 shadow-float"
    >
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="room_id" value={id} />
      ))}
      <p className="text-sm font-bold text-ink">
        {selectedIds.length} {selectedIds.length === 1 ? "habitación elegida" : "habitaciones elegidas"}
      </p>
      <Select label="Género" name="gender" defaultValue="mixto" className="w-44">
        {options.map((o) => (
          <option key={o} value={o}>
            {ROOM_GENDER_LABEL[o]}
          </option>
        ))}
      </Select>
      <button
        type="submit"
        disabled={isPending || selectedIds.length === 0}
        className="cursor-pointer rounded-full bg-forest px-5 py-2 text-sm font-bold text-white hover:bg-forest-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Aplicando…" : "Aplicar género"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="cursor-pointer rounded-full border-[1.5px] border-line px-4 py-2 text-sm font-bold text-ink-soft hover:border-forest hover:text-forest-700"
      >
        Cancelar
      </button>
      {state.status === "error" && (
        <p role="alert" className="basis-full text-xs font-medium text-danger-fg">
          {state.message}
        </p>
      )}
    </form>
  );
}

function RoomModal({
  residenceId,
  room,
  typeName,
  capacity,
  priceUsd,
  arsPerUsd,
  unassigned,
  onClose,
}: {
  residenceId: string;
  room: RoomData;
  typeName: string;
  capacity: number;
  priceUsd: number;
  arsPerUsd: number;
  unassigned: RoomsData["unassigned"];
  onClose: () => void;
}) {
  const perms = useContext(RoomsPermissionsContext);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-forest-ink/60" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-manage-title"
        className="animate-modal-in relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-card bg-paper shadow-float"
      >
        <div className="flex items-start justify-between border-b border-line px-6 py-4">
          <div>
            <h2 id="room-manage-title" className="flex items-center gap-2 text-xl font-bold text-ink">
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
          <fieldset disabled={!perms.rooms} className="m-0 min-w-0 space-y-5 border-0 p-0">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Configuración</p>
            {!perms.rooms && <PermissionNote text="No tenés permiso para editar habitaciones ni camas. Pedile este permiso al dueño." />}
            <RenameForm residenceId={residenceId} room={room} />
            <GenderForm residenceId={residenceId} room={room} shared={capacity > 1} />
            <div>
              <p className="text-sm font-bold text-ink">Tarifa mensual</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                <span className="tabular-nums">{formatUsd(priceUsd)}</span> <span className="text-xs text-ink-faint">
                  ≈ {formatArs(usdToArsRounded(priceUsd, arsPerUsd))}
                  <ExchangeRateNote />
                </span>
              </p>
              <Link
                href={`/residence/${residenceId}/profile#perfil-habitaciones`}
                className="mt-1 inline-block text-xs font-semibold text-forest-700 hover:underline"
              >
                Editar tarifa en la configuración →
              </Link>
            </div>
            <p className="rounded-field bg-cream-2 px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
              Una cama fuera de servicio no se cuenta como lugar libre.
            </p>
            <RoomOutOfServiceForm residenceId={residenceId} room={room} />
            <p className="text-xs leading-relaxed text-ink-faint">
              Lo que se ofrece a los estudiantes (cuántos lugares, desde cuándo, por género) se informa en{" "}
              <Link href={`/residence/${residenceId}/availability`} className="font-semibold text-forest-700 hover:underline">
                Disponibilidad
              </Link>
              .
            </p>
          </fieldset>

          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted">Plazas (camas)</p>
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
  canManageRooms,
  canManageResidents,
}: {
  residenceId: string;
  data: RoomsData;
  arsPerUsd: number;
  /** DR11: `operations.rooms_availability`. */
  canManageRooms: boolean;
  /** DR11: `residents.manage` (liberar una plaza cierra la estadía). */
  canManageResidents: boolean;
}) {
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [onlyVacant, setOnlyVacant] = useState(false);
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  // Tipos de habitación plegados (por comodidad; no se persiste).
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapsed = (id: string) =>
    setCollapsed((prev) => (prev.has(id) ? new Set([...prev].filter((x) => x !== id)) : new Set([...prev, id])));
  // Edición en lote del género: se eligen habitaciones con casillas y se aplica el mismo género a todas.
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelected = (ids: string[], on: boolean) =>
    setSelected((prev) => (on ? new Set([...prev, ...ids]) : new Set([...prev].filter((id) => !ids.includes(id)))));
  const stopBulk = () => {
    setBulkMode(false);
    setSelected(new Set());
  };

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
          chip:
            new Set(g.rooms.map((r) => r.gender)).size > 1
              ? { label: "VARIOS", className: "bg-sand-100 text-ink-soft" }
              : roomGenderChip(g.rooms[0]?.gender ?? "sin_especificar"),
          vacant: g.rooms.flatMap((r) => r.beds).filter((b) => b.status === "active" && !b.occupant).length,
        }))
        .filter((t) => t.vacant > 0),
    [groups],
  );

  return (
    <div className="tone-residence mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <BackToProfileLink residenceId={residenceId} className="mb-2" />
      <ResidenceHero icon="meeting_room" title="Habitaciones" subtitle="Tus habitaciones, camas y ocupación, en un pantallazo." />

      {/* Resumen compacto: habitaciones y plazas · ocupación · vacantes · movimientos */}
      <Card className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-ink-soft">Habitaciones y plazas</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-ink">
            {kpis.roomsCount} <span className="text-sm font-semibold text-ink-faint">{kpis.roomsCount === 1 ? "hab." : "habs."} · {kpis.bedsCount} {kpis.bedsCount === 1 ? "plaza" : "plazas"}</span>
          </p>
          {kpis.outOfServiceCount > 0 && (
            <p className="text-xs text-ink-faint">{operativeBeds} operativas · {kpis.outOfServiceCount} fuera de servicio</p>
          )}
        </div>
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-ink-soft">Ocupación</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-ink">{occupancyPercent}%</p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand-200" aria-hidden>
            <div className="h-full rounded-full bg-forest" style={{ width: `${occupancyPercent}%` }} />
          </div>
          <p className="mt-1 text-xs text-ink-faint">{kpis.occupiedCount} de {operativeBeds} plazas operativas</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-ink-soft">Vacantes actuales</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-ink">
            {kpis.vacantTotal} <span className="text-sm font-semibold text-ink-faint">{kpis.vacantTotal === 1 ? "vacante" : "vacantes"}</span>
          </p>
          {vacancyByType.length > 0 && (
            <p className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-ink-soft">
              {vacancyByType.map((t) => (
                <span key={t.id} className="whitespace-nowrap">
                  {t.name} <span className="font-bold text-ink">{t.vacant}</span>
                </span>
              ))}
            </p>
          )}
        </div>
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-ink-soft">Movimientos próximos</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span title="Ingresos" className="flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-sm font-bold text-success-fg">
              <Icon name="login" className="text-base" aria-hidden /> {kpis.upcomingArrivals}
            </span>
            <span title="Salidas (30 días)" className="flex items-center gap-1 rounded-full bg-danger-bg px-2 py-0.5 text-sm font-bold text-danger-fg">
              <Icon name="logout" className="text-base" aria-hidden /> {kpis.upcomingDepartures}
            </span>
            <span title="Renovaciones" className="flex items-center gap-1 rounded-full bg-info-bg px-2 py-0.5 text-sm font-bold text-info-fg">
              <Icon name="autorenew" className="text-base" aria-hidden /> {kpis.activeRenewals}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-faint">Ingresos · salidas (30 días) · renovaciones</p>
        </div>
      </Card>

      {unassigned.length > 0 && (
        <p className="mt-3 flex items-center gap-2 rounded-field border border-orange/40 bg-warning-bg px-3.5 py-2.5 text-sm text-warning-fg">
          <Icon name="info" className="text-lg" />
          {unassigned.length} residente{unassigned.length > 1 ? "s" : ""} sin cama asignada — abrí una habitación
          con lugar y usá &ldquo;Asignar&rdquo;.
        </p>
      )}

      {/* Búsqueda + filtros */}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-card border-[1.5px] border-line bg-paper p-3 shadow-card">
        <div className="relative min-w-56 flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-ink-faint" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar habitación o residente…"
            className="w-full rounded-field border-[1.5px] border-field-border bg-cream py-2 pl-10 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-forest focus:outline-2 focus:outline-offset-1 focus:outline-forest"
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
        {canManageRooms && (
          <button
            type="button"
            onClick={() => (bulkMode ? stopBulk() : setBulkMode(true))}
            aria-pressed={bulkMode}
            className={`flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-4 py-2 text-sm font-bold transition-colors ${
              bulkMode ? "border-forest bg-forest-tint text-forest-700" : "border-line text-ink-soft hover:border-forest hover:text-forest-700"
            }`}
          >
            <Icon name="checklist" className="text-base" />
            Cambiar género en lote
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTypeFilter(null)}
          className={`inline-flex min-h-10 cursor-pointer items-center rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${
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
            className={`inline-flex min-h-10 cursor-pointer items-center rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${
              typeFilter === g.id ? "bg-forest-ink text-white" : "border-[1.5px] border-line bg-paper text-ink-soft hover:border-line-2"
            }`}
          >
            {g.name} ({g.rooms.length})
          </button>
        ))}
        {filteredGroups.length > 1 && (
          <button
            type="button"
            onClick={() =>
              setCollapsed(collapsed.size >= filteredGroups.length ? new Set() : new Set(filteredGroups.map((x) => x.id)))
            }
            className="ml-auto inline-flex min-h-10 cursor-pointer items-center gap-1 rounded-full px-3 text-sm font-semibold text-forest-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            <Icon name={collapsed.size >= filteredGroups.length ? "unfold_more" : "unfold_less"} className="text-lg" aria-hidden />
            {collapsed.size >= filteredGroups.length ? "Desplegar todos" : "Plegar todos"}
          </button>
        )}
      </div>

      {/* Grupos por tipo */}
      {filteredGroups.length === 0 ? (
        <div className="mt-8">
          <EmptyState
          tone="residence"
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
          const isCollapsed = collapsed.has(g.id);
          return (
            <section key={g.id} className="mt-5">
              <Card className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleCollapsed(g.id)}
                  aria-expanded={!isCollapsed}
                  aria-controls={`tipo-${g.id}`}
                  className="flex min-h-10 min-w-0 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-field text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  <Icon
                    name="expand_more"
                    className={`text-2xl text-ink-soft transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`}
                    aria-hidden
                  />
                  <h2 className="text-lg font-bold text-ink">{g.name}</h2>
                  <span className="rounded-field bg-sand-100 px-2 py-0.5 text-xs font-semibold text-ink-soft">
                    {g.rooms.length} {g.rooms.length === 1 ? "habitación" : "habitaciones"}
                  </span>
                  {vacants > 0 && (
                    <span className="rounded-field bg-success-bg px-2 py-0.5 text-xs font-semibold text-success-fg">
                      {vacants} {vacants === 1 ? "vacante" : "vacantes"}
                    </span>
                  )}
                </button>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  {bulkMode && !isCollapsed && (
                    <button
                      type="button"
                      onClick={() => {
                        const ids = g.rooms.map((r) => r.id);
                        toggleSelected(ids, !ids.every((id) => selected.has(id)));
                      }}
                      className="cursor-pointer rounded-full border-[1.5px] border-line px-3 py-1.5 text-xs font-bold text-ink-soft hover:border-forest hover:text-forest-700"
                    >
                      {g.rooms.every((r) => selected.has(r.id)) ? "Quitar todas" : "Elegir todas"}
                    </button>
                  )}
                  <p className="text-sm text-ink-soft">
                    Tarifa base{" "}
                    <span className="font-bold tabular-nums text-ink">{formatUsd(g.priceUsd)}</span>
                    <span className="ml-1.5 text-xs text-ink-faint">
                      ≈ {formatArs(usdToArsRounded(g.priceUsd, arsPerUsd))}
                      <ExchangeRateNote />
                    </span>
                  </p>
                  <Link
                    href={`/residence/${residenceId}/profile#perfil-habitaciones`}
                    className="flex items-center gap-1 text-sm font-bold text-forest-700 hover:underline"
                  >
                    <Icon name="edit" className="text-base" /> Editar tarifa
                  </Link>
                </div>
              </Card>

              <div id={`tipo-${g.id}`} hidden={isCollapsed} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.rooms.map((room) => {
                  const activeBedCount = room.beds.filter((b) => b.status === "active").length;
                  const occupied = room.beds.filter((b) => b.occupant).length;
                  const free = room.beds.filter((b) => b.status === "active" && !b.occupant).length;
                  const inMaintenance = room.beds.length > 0 && activeBedCount === 0;
                  const gChip = roomGenderChip(room.gender);
                  const oosReason = room.beds.find((b) => b.reason)?.reason;

                  return (
                    <div
                      key={room.id}
                      className={`flex flex-col rounded-card border-[1.5px] p-4 shadow-card ${
                        inMaintenance ? "border-orange/40 bg-warning-bg/40" : "border-line bg-paper"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="flex min-w-0 items-center gap-2 font-bold text-ink">
                          {bulkMode && (
                            <input
                              type="checkbox"
                              checked={selected.has(room.id)}
                              onChange={(e) => toggleSelected([room.id], e.target.checked)}
                              aria-label={`Elegir ${room.label}`}
                              className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-forest)]"
                            />
                          )}
                          <span className="truncate">{room.label}</span>
                        </h3>
                        <div className="flex gap-1.5">
                          {inMaintenance ? (
                            <span className="rounded-full bg-orange-tint px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-orange-700">
                              Mantenimiento
                            </span>
                          ) : (
                            <>
                              {gChip && (
                                <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${gChip.className}`}>
                                  {gChip.label}
                                </span>
                              )}
                              {g.bathroomType && (
                                <span
                                  className="rounded-full bg-sand-100 px-2 py-0.5 text-xs font-bold uppercase text-ink-soft"
                                  title={`Baño ${g.bathroomType}`}
                                >
                                  {g.bathroomType === "privado" ? "BP" : "BC"}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand-200">
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
                        <div className="flex flex-1 flex-col items-center justify-center gap-1 py-3 text-center">
                          <Icon name="construction" className="text-2xl text-orange-700" />
                          <p className="text-sm text-warning-fg">{oosReason ?? "Habitación fuera de servicio."}</p>
                        </div>
                      ) : (
                        <div className="mt-2.5 flex-1 space-y-1.5">
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
                            <div className="flex items-center justify-center gap-1.5 rounded-field border border-dashed border-success-fg/40 bg-success-bg/40 px-3 py-1 text-sm font-bold text-success-fg">
                              <Icon name="add_circle" className="text-base" />
                              {free === 1 ? "Cama disponible" : `${free} camas disponibles`}
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setOpenRoomId(room.id)}
                        className={`mt-3 w-full cursor-pointer rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
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

      {bulkMode && (
        <BulkGenderBar
          residenceId={residenceId}
          selectedIds={[...selected]}
          anyShared={groups.some((g) => g.capacityPerRoom > 1 && g.rooms.some((r) => selected.has(r.id)))}
          onDone={stopBulk}
          onCancel={stopBulk}
        />
      )}

      {openRoom && (
        <RoomsPermissionsContext.Provider value={{ rooms: canManageRooms, residents: canManageResidents }}>
        <RoomModal
          residenceId={residenceId}
          room={openRoom.room}
          typeName={openRoom.group.name}
          capacity={openRoom.group.capacityPerRoom}
          priceUsd={openRoom.group.priceUsd}
          arsPerUsd={arsPerUsd}
          unassigned={unassigned}
          onClose={() => setOpenRoomId(null)}
        />
        </RoomsPermissionsContext.Provider>
      )}
    </div>
  );
}
