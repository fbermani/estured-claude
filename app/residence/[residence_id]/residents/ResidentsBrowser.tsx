"use client";

import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { Fragment, useMemo, useState, useEffect, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { ScrollTable } from "@/components/ui/ScrollTable";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IdentityNumberReveal } from "@/components/residences/IdentityNumberReveal";
import { StudentDocumentChecklist, type StudentDocumentItem } from "@/components/residences/StudentDocumentChecklist";
import { formatUsd } from "@/lib/mock/exchange";
import { InviteResidentsCard } from "@/app/residence/[residence_id]/residents/InviteResidentsCard";
import { PendingInviteBlock } from "@/app/residence/[residence_id]/residents/PendingInviteBlock";
import { HouseCodeCard, LinkRequestsCard, type LinkRequestItem, type UnlinkedStay } from "@/app/residence/[residence_id]/residents/LinkRequestsCard";
import { AddResidentForm } from "@/app/residence/[residence_id]/residents/AddResidentForm";
import { PermissionGate, PermissionNote } from "@/components/residences/PermissionGate";
import { StayChangeSection } from "@/app/residence/[residence_id]/residents/StayChangeSection";
import { StayChangeResponseSheet } from "@/app/residence/[residence_id]/residents/StayChangeResponseSheet";
import { EarlyExitForm } from "@/app/residence/[residence_id]/residents/EarlyExitForm";
import { RoomChangeBlock } from "@/app/residence/[residence_id]/residents/RoomChangeBlock";
import { RoomChangeAlertsCard } from "@/app/residence/[residence_id]/residents/RoomChangeAlertsCard";
import type { PlaceAlertItem, ResidenceRoomChangeItem } from "@/lib/roomChange/load";
import { describePreference, isOpenRoomChangeStatus, ROOM_CHANGE_GENDERS, ROOM_CHANGE_GENDER_LABEL } from "@/lib/roomChange/rules";
import type { ResidenceStayChangeItem } from "@/lib/stayChange/load";
import { dayBefore } from "@/lib/stayChange/ui";
import {
  updateStayDetailsAction,
  assignBedToStayAction,
  endResidentStayAction,
  addResidentNoteAction,
  type ResidentsActionState,
} from "@/app/residence/[residence_id]/residents/actions";

export type ResidentRow = {
  stayId: string;
  name: string;
  flag: string | null;
  email: string | null;
  pending: boolean;
  /** DR18 t4: cargado sin mail ni cuenta (nombre + teléfono opcional, 0063). */
  noEmail?: boolean;
  invitePhone?: string | null;
  /** DR19: estado de la última invitación personal (`none` si no hay) y su canal. Solo para estadías sin cuenta vinculada. */
  inviteState?: string;
  inviteChannel?: string | null;
  hiddenFromCommunity: boolean;
  typeName: string | null;
  roomLabel: string | null;
  bedLetter: string | null;
  startDate: string | null;
  expectedEndDate: string | null;
  rateUsd: number | null;
  baseRateUsd: number | null;
  /** Tarifa del snapshot aceptado en la reserva vinculada (`null` = estadía sin reserva de EstuRed). */
  agreedRateUsd: number | null;
  /** Renovación vía `resident_stays.reservation_id`; `null` = estadía sin reserva de EstuRed vinculada. */
  renewal: {
    reservationId: string;
    reservationConfirmed: boolean;
    hasActiveOffer: boolean;
    studentRequested: boolean;
    statusLabel: string | null;
    statusTone: "amber" | "sage" | "neutral" | "danger";
  } | null;
  studentProfileId: string | null;
  /** DR38: documentación que pide la residencia y su estado en este residente (solo estado, nunca el archivo). `null` = sin cuenta de estudiante vinculada. */
  /** DR38/DR48: `fileId` solo viene si quien mira puede abrir el archivo (casillero `residents.manage`). */
  documents: StudentDocumentItem[] | null;
  /** DR58 fase 2: solo viene si quien mira puede pedir el número de documento (casillero `residents.manage`). */
  canRevealIdentityNumber: boolean;
  /** Depósito de la reserva vinculada: define las opciones al registrar una salida anticipada. */
  depositMode: "had" | "none" | "unknown";
  /** Pedido de cambio de habitación dentro de la residencia (DR34): el abierto o, si no hay, el último cerrado. */
  roomChange: ResidenceRoomChangeItem | null;
  /** Aviso "Quiero cambiar" abierto o resuelto de este residente (DR3). */
  stayChange: {
    intentId: string;
    status: "open" | "resolved_new_reservation";
    createdAt: string;
    estimatedExitDate: string | null;
    resolvedNewStartDate: string | null;
    responded: boolean;
    seen: boolean;
  } | null;
};

export type ResidentNote = {
  id: string;
  category: "general" | "pagos";
  body: string;
  createdAt: string;
  authorLabel: string;
};

export type ResidentsData = {
  rows: ResidentRow[];
  freeBeds: { id: string; label: string }[];
  roomTypes: { id: string; name: string }[];
  kpis: { active: number; arrivals: number; departures: number; renewals: number; seekingChange: number };
  notesByStay: Record<string, ResidentNote[]>;
  stayChanges: ResidenceStayChangeItem[];
  /** DR34: plazas liberadas que coinciden con un pedido de cambio de habitación, por decidir. */
  placeAlerts: PlaceAlertItem[];
  /** DR19 */
  linkRequests: LinkRequestItem[];
  unlinkedStays: UnlinkedStay[];
  houseCode: string | null;
  /** DR38: falta la migración 0077, así que solo se muestran identidad y certificado de estudios. */
  stayDocumentsLimited: boolean;
};

const initialState: ResidentsActionState = { status: "idle" };

const formatDate = formatDateOnly;

function timeAgo(isoStr: string): string {
  const diffMs = Date.now() - new Date(isoStr).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `hace ${days} d`;
  return formatDate(isoStr.slice(0, 10));
}

const NOTE_CATEGORY_LABEL: Record<ResidentNote["category"], string> = { general: "General", pagos: "Pagos" };

type StatusKey = "activo" | "por_ingresar" | "por_salir" | "pendiente";
type FilterKey = StatusKey | "todos" | "busca_cambiar" | "cambio_habitacion";

function statusOf(row: ResidentRow, todayStr: string, in30Str: string): StatusKey {
  if (row.pending) return "pendiente";
  if (row.startDate && row.startDate > todayStr) return "por_ingresar";
  if (row.expectedEndDate && row.expectedEndDate >= todayStr && row.expectedEndDate <= in30Str) return "por_salir";
  return "activo";
}

const STATUS_META: Record<StatusKey, { label: string; tone: "sage" | "amber" | "neutral" }> = {
  activo: { label: "Activo", tone: "sage" },
  por_ingresar: { label: "Por ingresar", tone: "amber" },
  por_salir: { label: "Por salir", tone: "amber" },
  pendiente: { label: "Pendiente de activación", tone: "neutral" },
};

type SortKey = "name" | "room" | "status" | "end" | "rate";
type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Residente" },
  { key: "room", label: "Habitación / Cama" },
  { key: "status", label: "Estado" },
  { key: "end", label: "Contrato hasta" },
  { key: "rate", label: "Tarifa mensual" },
];

const STATUS_ORDER: Record<StatusKey, number> = { activo: 0, por_ingresar: 1, por_salir: 2, pendiente: 3 };

/** Los valores vacíos (sin habitación, sin fecha, sin tarifa) van siempre al final, en cualquier sentido. */
function compareRows(a: ResidentRow, b: ResidentRow, key: SortKey, dir: "asc" | "desc", todayStr: string, in30Str: string): number {
  const sign = dir === "asc" ? 1 : -1;
  const collator = (x: string, y: string) => x.localeCompare(y, "es", { numeric: true, sensitivity: "base" });
  const rate = (r: ResidentRow) => r.rateUsd ?? r.agreedRateUsd ?? r.baseRateUsd;
  switch (key) {
    case "name":
      return sign * collator(a.name, b.name);
    case "room": {
      if (!a.roomLabel || !b.roomLabel) return a.roomLabel ? -1 : b.roomLabel ? 1 : 0;
      return sign * (collator(a.roomLabel, b.roomLabel) || collator(a.bedLetter ?? "", b.bedLetter ?? ""));
    }
    case "status":
      return sign * (STATUS_ORDER[statusOf(a, todayStr, in30Str)] - STATUS_ORDER[statusOf(b, todayStr, in30Str)]);
    case "end": {
      if (!a.expectedEndDate || !b.expectedEndDate) return a.expectedEndDate ? -1 : b.expectedEndDate ? 1 : 0;
      return sign * a.expectedEndDate.localeCompare(b.expectedEndDate);
    }
    case "rate": {
      const ra = rate(a);
      const rb = rate(b);
      if (ra == null || rb == null) return ra != null ? -1 : rb != null ? 1 : 0;
      return sign * (ra - rb);
    }
  }
}

function NotesSection({
  residenceId,
  row,
  notes,
}: {
  residenceId: string;
  row: ResidentRow;
  notes: ResidentNote[];
}) {
  const noteAction = addResidentNoteAction.bind(null, residenceId, row.stayId);
  const [noteState, noteFormAction, notePending] = useActionState(noteAction, initialState);
  const [category, setCategory] = useState<ResidentNote["category"]>("general");

  return (
    <div className="rounded-field border border-line bg-paper p-4 sm:col-span-2 lg:col-span-1">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted">
        <Icon name="edit_note" className="text-sm" /> Notas internas
        <span className="ml-auto normal-case tracking-normal text-ink-faint">Solo visible para la residencia</span>
      </p>
      <form action={noteFormAction}>
        <textarea
          name="body"
          rows={3}
          placeholder="Escribí una nota sobre el residente…"
          required
          maxLength={2000}
          className="w-full resize-none rounded-field border-[1.5px] border-field-border bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-forest focus:outline-2 focus:outline-offset-1 focus:outline-forest"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex gap-3">
            {(["general", "pagos"] as const).map((c) => (
              <label key={c} className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft">
                <input
                  type="radio"
                  name="category"
                  value={c}
                  checked={category === c}
                  onChange={() => setCategory(c)}
                  className="h-3.5 w-3.5 accent-[var(--color-forest)]"
                />
                {NOTE_CATEGORY_LABEL[c]}
              </label>
            ))}
          </div>
          <button
            type="submit"
            disabled={notePending}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-full bg-forest px-4 py-1.5 text-xs font-bold text-white hover:bg-forest-600"
          >
            {notePending ? "…" : "Guardar nota"}
          </button>
        </div>
        {noteState.status === "error" && <p role="alert" className="mt-1.5 text-xs font-medium text-danger-fg">{noteState.message}</p>}
      </form>

      {notes.length > 0 && (
        <ul className="mt-4 max-h-64 space-y-3 overflow-y-auto border-t border-line pt-3">
          {notes.map((note) => (
            <li key={note.id} className="text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-ink">{note.authorLabel}</span>
                <span className="text-ink-faint">{timeAgo(note.createdAt)}</span>
              </div>
              <p className="mt-0.5 leading-relaxed text-ink-soft">{note.body}</p>
              <span className="mt-1 inline-block rounded-full bg-cream-2 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-ink-faint">
                {NOTE_CATEGORY_LABEL[note.category]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** DR38/DR48: documentación que pide la residencia y su estado en este residente; «Ver» abre el archivo si hay permiso. */
function StayDocumentsBlock({ residenceId, row, limited }: { residenceId: string; row: ResidentRow; limited: boolean }) {
  const docs = row.documents;
  const missing = docs ? docs.filter((d) => !d.delivered).length : 0;
  return (
    <div className="rounded-field border border-line bg-paper p-4 sm:col-span-2 lg:col-span-4">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted">
        <Icon name="folder_shared" className="text-sm" /> Documentación
        {docs && docs.length > 0 && (
          <span className="ml-1 font-semibold normal-case tracking-normal text-ink-faint">
            {missing === 0 ? "Completa" : `Faltan ${missing} de ${docs.length}`}
          </span>
        )}
      </p>
      {docs === null ? (
        <p className="text-sm text-ink-soft">Sin cuenta: no podemos ver su documentación.</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-ink-soft">Tu residencia no pide documentos. Podés elegirlos en Configuración, en «Documentos que pedís a tus residentes».</p>
      ) : (
        <StudentDocumentChecklist residenceId={residenceId} items={docs} />
      )}
      {row.canRevealIdentityNumber && row.studentProfileId && <IdentityNumberReveal residenceId={residenceId} studentProfileId={row.studentProfileId} />}
      {docs !== null && (
        <p className="mt-2 text-xs leading-relaxed text-ink-faint">
          {docs.some((d) => d.fileId)
            ? "Cada vez que abrís un documento queda registrado. El link dura 5 minutos."
            : docs.some((d) => d.delivered)
              ? "Solo ves si lo entregó: para abrir los documentos necesitás el permiso «Residentes»."
              : "Cuando lo entregue, vas a poder abrirlo desde acá."}
          {limited ? " Los documentos propios se van a poder ver cuando se actualice el sistema." : ""}
        </p>
      )}
    </div>
  );
}

function DetailPanel({
  residenceId,
  row,
  freeBeds,
  notes,
  exitRequest,
  canResidents,
  canBeds,
  roomTypes,
  documentsLimited,
}: {
  /** DR38: falta la migración 0077 (solo se ven identidad y estudios). */
  documentsLimited: boolean;
  /** Tipos de habitación de la residencia (para la preferencia del cambio de habitación, DR34). */
  roomTypes: { id: string; name: string }[];
  /** DR11: `residents.manage` (altas, estadías, salidas, notas). */
  canResidents: boolean;
  /** DR11: `operations.rooms_availability` (cambiar la cama de un residente). */
  canBeds: boolean;
  residenceId: string;
  residenceName: string;
  row: ResidentRow;
  freeBeds: { id: string; label: string }[];
  notes: ResidentNote[];
  /** Pedido de "Registrar salida" desde la sección de avisos: abre el formulario con la fecha sugerida. */
  exitRequest: { stayId: string; date: string | null; nonce: number } | null;
}) {
  const detailsAction = updateStayDetailsAction.bind(null, residenceId, row.stayId);
  const [detailsState, detailsFormAction, detailsPending] = useActionState(detailsAction, initialState);
  const bedAction = assignBedToStayAction.bind(null, residenceId, row.stayId);
  const [bedState, bedFormAction, bedPending] = useActionState(bedAction, initialState);
  const endAction = endResidentStayAction.bind(null, residenceId, row.stayId);
  const [endState, endFormAction, endPending] = useActionState(endAction, initialState);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [earlyExitOpen, setEarlyExitOpen] = useState(() => exitRequest?.stayId === row.stayId);
  const [lastNonce, setLastNonce] = useState(exitRequest?.nonce ?? 0);
  if (exitRequest && exitRequest.stayId === row.stayId && exitRequest.nonce !== lastNonce) {
    setLastNonce(exitRequest.nonce);
    setEarlyExitOpen(true);
  }
  const suggestedExitDate =
    exitRequest?.stayId === row.stayId
      ? exitRequest.date
      : row.stayChange?.resolvedNewStartDate
        ? dayBefore(row.stayChange.resolvedNewStartDate)
        : (row.stayChange?.estimatedExitDate ?? null);
  const [rateInput, setRateInput] = useState(row.rateUsd != null ? String(row.rateUsd) : "");
  const typedRate = rateInput.trim() === "" ? null : Number(rateInput);
  // Misma regla que el estudiante: una tarifa propia distinta de la acordada se le muestra (D5).
  const rateDiffersFromAgreed =
    typedRate !== null && !Number.isNaN(typedRate) && row.agreedRateUsd != null && typedRate !== row.agreedRateUsd;

  return (
    <div className="grid gap-5 border-t border-line bg-cream-2/60 p-5 sm:grid-cols-2 lg:grid-cols-4">
      {(!canResidents || !canBeds) && (
        <div className="sm:col-span-2 lg:col-span-4">
          <PermissionNote
            text={
              !canResidents && !canBeds
                ? "No tenés permiso para modificar residentes ni camas. Pedile estos permisos al dueño."
                : !canResidents
                  ? "No tenés permiso para modificar residentes. Pedile este permiso al dueño."
                  : "No tenés permiso para cambiar camas. Pedile este permiso al dueño."
            }
          />
        </div>
      )}
      {row.pending && !row.studentProfileId && canResidents && (
        <PendingInviteBlock
          residenceId={residenceId}
          stayId={row.stayId}
          email={row.email}
          inviteState={row.inviteState ?? "none"}
          inviteChannel={row.inviteChannel ?? null}
        />
      )}
      {earlyExitOpen && (
        <div className="sm:col-span-2 lg:col-span-4">
          <PermissionGate bare allowed={canResidents}>
            <EarlyExitForm
              residenceId={residenceId}
              stayId={row.stayId}
              residentName={row.name}
              depositMode={row.depositMode}
              suggestedDate={suggestedExitDate}
              onCancel={() => setEarlyExitOpen(false)}
            />
          </PermissionGate>
        </div>
      )}
      {/* Salida exacta + tarifa — ref modal perfil del residente */}
      <PermissionGate bare allowed={canResidents}>
      <form action={detailsFormAction} className="rounded-field border border-line bg-paper p-4">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted">
          <Icon name="event" className="text-sm" /> Estadía y tarifa
        </p>
        <label className="mb-1 block text-xs font-bold text-ink" htmlFor={`end-${row.stayId}`}>
          Salida exacta
        </label>
        <input
          id={`end-${row.stayId}`}
          type="date"
          name="expected_end_date"
          defaultValue={row.expectedEndDate ?? ""}
          className="w-full rounded-field border-[1.5px] border-field-border bg-cream px-3 py-2 text-sm text-ink focus:border-forest focus:outline-2 focus:outline-offset-1 focus:outline-forest"
        />
        <label className="mb-1 mt-3 block text-xs font-bold text-ink" htmlFor={`rate-${row.stayId}`}>
          Tarifa del residente (USD)
        </label>
        <input
          id={`rate-${row.stayId}`}
          type="number"
          min={0}
          name="monthly_rate_usd"
          value={rateInput}
          onChange={(e) => setRateInput(e.target.value)}
          placeholder={
            row.agreedRateUsd != null
              ? `${row.agreedRateUsd} (acordada en la reserva)`
              : row.baseRateUsd != null
                ? `${row.baseRateUsd} (tarifa del tipo)`
                : "Sin tarifa"
          }
          className="w-full rounded-field border-[1.5px] border-field-border bg-cream px-3 py-2 text-sm text-ink focus:border-forest focus:outline-2 focus:outline-offset-1 focus:outline-forest"
        />
        <p className="mt-1 text-xs text-ink-faint">
          {row.agreedRateUsd != null
            ? "Vacío = rige la tarifa acordada en la reserva."
            : "Vacío = rige la tarifa del tipo de habitación."}
        </p>
        {row.agreedRateUsd != null && (
          <p
            className={`mt-2 rounded-field px-2.5 py-1.5 text-xs ${
              rateDiffersFromAgreed ? "bg-warning-bg font-medium text-warning-fg" : "bg-cream-2 text-ink-soft"
            }`}
          >
            Tarifa acordada en la reserva: <span className="font-bold">{formatUsd(row.agreedRateUsd)}</span>.
            {rateDiffersFromAgreed
              ? " La tarifa que cargaste es distinta: el residente va a ver el cambio (antes y ahora) en su panel."
              : " El residente ve la tarifa vigente de su estadía."}
          </p>
        )}
        <button
          type="submit"
          disabled={detailsPending}
          className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-full bg-forest px-4 py-1.5 text-sm font-bold text-white hover:bg-forest-600"
        >
          {detailsPending ? "Guardando…" : "Guardar"}
        </button>
        {detailsState.status === "error" && (
          <p role="alert" className="mt-2 text-xs font-medium text-danger-fg">{detailsState.message}</p>
        )}
        {detailsState.status === "saved" && <p className="mt-2 text-xs font-medium text-success-fg">Guardado.</p>}
      </form>
      </PermissionGate>

      {/* Habitación y cama (+ cambio de habitación, DR34) */}
      <div className="rounded-field border border-line bg-paper p-4">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted">
          <Icon name="meeting_room" className="text-sm" /> Habitación y cama
        </p>
        <p className="text-sm font-semibold text-ink">
          {row.roomLabel ? `${row.roomLabel}${row.bedLetter ? ` · Cama ${row.bedLetter}` : ""}` : "Sin cama asignada"}
        </p>
        <PermissionGate bare allowed={canBeds}>
        <form action={bedFormAction} className="mt-3">
          <select
            name="bed_id"
            required
            defaultValue=""
            className="w-full rounded-field border-[1.5px] border-field-border bg-cream px-3 py-2 text-sm text-ink focus:border-forest focus:outline-2 focus:outline-offset-1 focus:outline-forest"
          >
            <option value="" disabled>
              {freeBeds.length > 0 ? "Cambiar a…" : "Sin camas libres"}
            </option>
            {freeBeds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={bedPending || freeBeds.length === 0}
            className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-full border-[1.5px] border-line px-4 py-1.5 text-sm font-bold text-ink-soft hover:border-forest hover:text-forest-700 disabled:opacity-50"
          >
            {bedPending ? "Asignando…" : "Cambiar ubicación"}
          </button>
        </form>
        {bedState.status === "error" && <p role="alert" className="mt-2 text-xs font-medium text-danger-fg">{bedState.message}</p>}
        {bedState.status === "saved" && <p className="mt-2 text-xs font-medium text-success-fg">Reubicado.</p>}
        </PermissionGate>
        <PermissionGate bare allowed={canResidents}>
          <RoomChangeBlock residenceId={residenceId} stayId={row.stayId} request={row.roomChange} roomTypes={roomTypes} />
        </PermissionGate>
      </div>

      {/* Renovación + zona de riesgo */}
      <div className="flex flex-col gap-4">
        <div className="rounded-field border border-line-2 bg-forest-tint/50 p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-forest-700">
            <Icon name="autorenew" className="text-sm" /> Renovación
          </p>
          {row.renewal ? (
            <>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {!row.renewal.reservationConfirmed ? null : row.renewal.statusLabel ? (
                  <Badge tone={row.renewal.statusTone}>{row.renewal.statusLabel}</Badge>
                ) : row.renewal.studentRequested ? (
                  <Badge tone="amber">Solicitó renovación</Badge>
                ) : (
                  <Badge tone="neutral">Sin oferta</Badge>
                )}
              </div>
              {row.renewal.reservationConfirmed ? (
                <>
                  <p className="mt-1.5 text-xs text-ink-soft">
                    {row.renewal.studentRequested && !row.renewal.hasActiveOffer
                      ? "El residente pidió renovar: armá la oferta con las condiciones nuevas."
                      : row.renewal.hasActiveOffer
                        ? "Hay una oferta en curso para esta estadía."
                        : "Ofrecé una renovación sobre la reserva de esta estadía."}
                  </p>
                  <Link
                    href={`/residence/${residenceId}/renewals/${row.renewal.reservationId}`}
                    className="mt-2 inline-block rounded-full bg-forest px-4 py-1.5 text-sm font-bold text-white hover:bg-forest-600"
                  >
                    {row.renewal.hasActiveOffer ? "Ver oferta de renovación" : "Iniciar renovación"}
                  </Link>
                </>
              ) : (
                <p className="mt-1.5 text-xs text-ink-soft">
                  La reserva vinculada ya no está confirmada, así que no se puede ofrecer una renovación.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="mt-1.5 text-xs text-ink-soft">
                Esta estadía no está vinculada a una reserva confirmada de EstuRed (alta manual o sin reserva única), por
                eso no se puede iniciar una renovación desde acá.
              </p>
              <Link
                href={`/residence/${residenceId}/renewals`}
                className="mt-2 inline-block text-sm font-bold text-forest-700 hover:underline"
              >
                Ir a renovaciones →
              </Link>
            </>
          )}
        </div>
        <PermissionGate bare allowed={canResidents}>
        <div className="rounded-field border border-danger-fg/30 bg-danger-bg/50 p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-danger-fg">
            <Icon name="warning" className="text-sm" /> Zona de riesgo
          </p>
          {row.stayChange && (
            <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-ink-soft">
              <Icon name="swap_horiz" className="mt-0.5 shrink-0 text-sm text-orange-700" />
              {row.stayChange.status === "open"
                ? "Este residente busca cambiar de residencia: cuando se vaya, registrá su salida anticipada."
                : `Confirmó un alojamiento nuevo${row.stayChange.resolvedNewStartDate ? ` desde el ${formatDate(row.stayChange.resolvedNewStartDate)}` : ""}: registrá su salida cuando se retire.`}
            </p>
          )}
          {!earlyExitOpen && !row.pending && (
            <button
              type="button"
              onClick={() => setEarlyExitOpen(true)}
              className="mt-2 mr-4 inline-block min-h-8 cursor-pointer text-sm font-bold text-danger-fg hover:underline"
            >
              Registrar salida anticipada…
            </button>
          )}
          {!confirmEnd && !earlyExitOpen ? (
            <button
              type="button"
              onClick={() => setConfirmEnd(true)}
              className="mt-2 inline-block min-h-8 cursor-pointer text-sm font-bold text-danger-fg hover:underline"
            >
              Finalizar estadía…
            </button>
          ) : earlyExitOpen ? null : (
            <form action={endFormAction} className="mt-2 flex items-center gap-2">
              <p className="text-xs text-danger-fg">¿Seguro? Sale de la comunidad visible.</p>
              <button
                type="submit"
                disabled={endPending}
                className="cursor-pointer rounded-full bg-danger-fg px-3 py-1 text-xs font-bold text-white"
              >
                {endPending ? "…" : "Confirmar"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmEnd(false)}
                className="cursor-pointer text-xs font-semibold text-ink-soft hover:underline"
              >
                Cancelar
              </button>
            </form>
          )}
          {endState.status === "error" && <p role="alert" className="mt-2 text-xs font-medium text-danger-fg">{endState.message}</p>}
        </div>
        </PermissionGate>
      </div>

      <PermissionGate bare allowed={canResidents}>
        <NotesSection residenceId={residenceId} row={row} notes={notes} />
      </PermissionGate>

      <StayDocumentsBlock residenceId={residenceId} row={row} limited={documentsLimited} />
    </div>
  );
}

export function ResidentsBrowser({
  residenceId,
  residenceName,
  data,
  canManageResidents,
  canManageBeds,
}: {
  residenceId: string;
  residenceName: string;
  data: ResidentsData;
  /** DR11: `residents.manage`. Solo presentación; el servidor valida cada acción. */
  canManageResidents: boolean;
  /** DR11: `operations.rooms_availability` (cambiar la cama). */
  canManageBeds: boolean;
}) {
  const searchParams = useSearchParams();
  // `?filtro=buscan-cambiar` (enlace del Panel): arranca filtrado por los residentes que buscan cambiar.
  const [filter, setFilter] = useState<FilterKey>(() => {
    const param = searchParams.get("filtro");
    return param === "buscan-cambiar" ? "busca_cambiar" : param === "cambio-habitacion" ? "cambio_habitacion" : "todos";
  });
  const [search, setSearch] = useState("");
  // Orden por columna: asc → desc → orden original.
  const [sort, setSort] = useState<SortState>(null);
  // Sub-filtros de «Piden otra habitación» (DR34): una preferencia vacía es «me da igual», así que también aparece cuando se filtra por un tipo o género.
  const [changeType, setChangeType] = useState("");
  const [changeGender, setChangeGender] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [exitRequest, setExitRequest] = useState<{ stayId: string; date: string | null; nonce: number } | null>(null);
  const respondingItem = data.stayChanges.find((c) => c.id === respondingId) ?? null;
  // Un solo layout montado (tarjetas < md, tabla >= md): evita DetailPanel e ids duplicados.
  const [isMd, setIsMd] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsMd(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const [openStayId, setOpenStayId] = useState<string | null>(() => searchParams.get("stay"));

  // Deep-link `?stay=<id>` (ej. desde "Próximos ingresos y salidas" del
  // Panel, Ciclo 41) — abre y hace scroll a la fila correspondiente.
  useEffect(() => {
    const target = searchParams.get("stay");
    if (!target) return;
    setOpenStayId(target);
    document.getElementById(`resident-${window.matchMedia("(min-width: 768px)").matches ? "row" : "card"}-${target}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [searchParams]);

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const in30Str = new Date(today.getTime() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.rows.filter((row) => {
      const st = statusOf(row, todayStr, in30Str);
      if (filter === "busca_cambiar") {
        if (row.stayChange?.status !== "open") return false;
      } else if (filter === "cambio_habitacion") {
        const rc = row.roomChange;
        if (!rc || !isOpenRoomChangeStatus(rc.status)) return false;
        if (changeType && rc.roomTypeId && rc.roomTypeId !== changeType) return false;
        if (changeGender && rc.gender && rc.gender !== changeGender) return false;
      } else if (filter !== "todos" && st !== filter) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        (row.email ?? "").toLowerCase().includes(q) ||
        (row.roomLabel ?? "").toLowerCase().includes(q) ||
        (row.roomChange?.note ?? "").toLowerCase().includes(q)
      );
    });
  }, [data.rows, filter, search, changeType, changeGender, todayStr, in30Str]);

  const shown = useMemo(() => {
    if (!sort) return filtered;
    return [...filtered].sort((a, b) => compareRows(a, b, sort.key, sort.dir, todayStr, in30Str));
  }, [filtered, sort, todayStr, in30Str]);

  function toggleSort(key: SortKey) {
    setSort((cur) => (cur?.key !== key ? { key, dir: "asc" } : cur.dir === "asc" ? { key, dir: "desc" } : null));
  }

  const openRoomChangeCount = useMemo(() => data.rows.filter((r) => r.roomChange && isOpenRoomChangeStatus(r.roomChange.status)).length, [data.rows]);
  // Residentes con un pedido pendiente, para mostrar a quién se le puede ofrecer cada plaza liberada.
  const alertResidents = useMemo(
    () =>
      data.rows
        .filter((r) => r.roomChange && isOpenRoomChangeStatus(r.roomChange.status))
        .map((r) => ({
          requestId: r.roomChange!.id,
          stayId: r.stayId,
          name: r.name,
          preference: describePreference({ typeName: r.roomChange!.roomTypeName, gender: r.roomChange!.gender, note: r.roomChange!.note }),
        })),
    [data.rows],
  );

  const { kpis } = data;
  // Avisos que piden una decisión: viven plegados en una sola barra para no empujar la lista.
  const openStayChanges = data.stayChanges.filter((c) => c.status === "open").length;
  const linkCount = canManageResidents ? data.linkRequests.length : 0;
  const pendingParts = [
    linkCount > 0 ? `${linkCount} ${linkCount === 1 ? "vínculo" : "vínculos"} por revisar` : null,
    data.placeAlerts.length > 0 ? `${data.placeAlerts.length} ${data.placeAlerts.length === 1 ? "plaza liberada" : "plazas liberadas"}` : null,
    data.stayChanges.length > 0
      ? openStayChanges > 0
        ? `${openStayChanges} ${openStayChanges === 1 ? "residente busca cambiar" : "residentes buscan cambiar"}`
        : "avisos de cambio cerrados"
      : null,
  ].filter((t): t is string => !!t);
  const pendingTotal = pendingParts.length;
  // Cada número es lo que muestra la lista al elegir ese filtro (mismo criterio que `filtered`).
  const tabCounts = useMemo(() => {
    const c = { todos: data.rows.length, activo: 0, por_ingresar: 0, por_salir: 0, pendiente: 0 };
    for (const r of data.rows) c[statusOf(r, todayStr, in30Str)]++;
    return c;
  }, [data.rows, todayStr, in30Str]);
  const STAT_TABS: { key: FilterKey; label: string; icon: string; count: number; attention?: boolean }[] = [
    { key: "todos", label: "Todos", icon: "groups", count: tabCounts.todos },
    { key: "activo", label: "Activos", icon: "check_circle", count: tabCounts.activo },
    { key: "por_ingresar", label: "Por ingresar", icon: "flight_land", count: tabCounts.por_ingresar },
    { key: "por_salir", label: "Por salir", icon: "flight_takeoff", count: tabCounts.por_salir },
    { key: "busca_cambiar", label: "Buscan cambiar", icon: "swap_horiz", count: kpis.seekingChange, attention: true },
    { key: "cambio_habitacion", label: "Piden otra habitación", icon: "meeting_room", count: openRoomChangeCount, attention: true },
    { key: "pendiente", label: "Pendientes", icon: "hourglass_top", count: tabCounts.pendiente },
  ];

  function registerExit(item: ResidenceStayChangeItem) {
    const row = data.rows.find((r) => r.studentProfileId === item.studentProfileId);
    if (!row) return;
    setFilter("todos");
    setSearch("");
    setOpenStayId(row.stayId);
    setExitRequest({
      stayId: row.stayId,
      date: item.resolvedNewStartDate ? dayBefore(item.resolvedNewStartDate) : item.estimatedExitDate,
      nonce: (exitRequest?.nonce ?? 0) + 1,
    });
    requestAnimationFrame(() => document.getElementById(`resident-${isMd ? "row" : "card"}-${row.stayId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  return (
    <div className="tone-residence mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="relative mb-5 overflow-hidden rounded-card bg-(--tone-soft) px-5 py-5 md:px-8 md:py-6">
        <span aria-hidden="true" className="pointer-events-none absolute -right-14 -top-[70px] size-[220px] rounded-full bg-(--tone) opacity-[0.12]" />
        <div className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="grid gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.09em] text-(--tone-700)">
              <Icon name="apartment" className="text-lg" />
              {residenceName}
            </span>
            <h1 className="font-display text-[1.75rem] font-bold leading-[1.08] text-(--tone-ink) md:text-4xl">Residentes</h1>
            <p className="max-w-[52ch] text-[15px] text-ink-soft">Ingresos, estadías y renovaciones en un solo lugar.</p>
            {data.linkRequests.length > 0 && canManageResidents && (
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge tone="amber">
                  <Icon name="link" className="text-sm" /> {data.linkRequests.length} {data.linkRequests.length === 1 ? "vínculo por revisar" : "vínculos por revisar"}
                </Badge>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 max-md:w-full">
            {canManageResidents && (
              <button
                type="button"
                aria-expanded={inviteOpen}
                onClick={() => setInviteOpen((v) => !v)}
                className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-(--tone)/40 bg-white/70 px-5 text-sm font-bold text-(--tone-700) hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--tone) max-md:flex-1 max-md:justify-center"
              >
                <Icon name="forum" className="text-lg" /> Invitar y código de casa
                <Icon name="expand_more" className={`text-xl transition-transform duration-300 ${inviteOpen ? "rotate-180" : ""}`} />
              </button>
            )}
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            disabled={!canManageResidents}
            title={canManageResidents ? undefined : "Pedile este permiso al dueño."}
            className="inline-flex min-h-[56px] cursor-pointer items-center justify-center gap-2 rounded-full bg-(--tone) px-8 text-base font-bold text-white shadow-[0_8px_20px_var(--tone-glow)] transition duration-200 ease-out-fresh motion-safe:active:scale-[0.97] hover:-translate-y-0.5 hover:bg-(--tone-600) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--tone) disabled:cursor-not-allowed disabled:opacity-50 max-md:w-full max-md:order-first"
          >
            <Icon name={showAdd ? "close" : "person_add"} className="text-2xl" />
            {showAdd ? "Cerrar" : "Agregar residente"}
          </button>
          </div>
        </div>
        {canManageResidents && inviteOpen && (
          <div className="relative mt-4 grid gap-3 lg:grid-cols-[1.9fr_1fr]">
            <InviteResidentsCard residenceName={residenceName} variant="panel" />
            <HouseCodeCard residenceId={residenceId} code={data.houseCode} variant="panel" />
          </div>
        )}
      </header>

      {showAdd && (
        <div className="mb-6">
          <AddResidentForm residenceId={residenceId} roomTypes={data.roomTypes} />
        </div>
      )}

      {pendingTotal > 0 && (
        <section aria-label="Pendientes de gestión" className="mt-5">
          <button
            type="button"
            aria-expanded={pendingOpen}
            onClick={() => setPendingOpen((v) => !v)}
            className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-card border-[1.5px] border-orange/40 bg-orange-tint px-4 text-left focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--tone)"
          >
            <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-2 font-bold text-ink">
                <Icon name="notifications_active" className="text-xl text-orange-700" /> Pendientes de gestión
              </span>
              {pendingParts.map((t) => (
                <span key={t} className="rounded-full bg-paper px-2.5 py-0.5 text-xs font-bold text-orange-700">{t}</span>
              ))}
            </span>
            <Icon name="expand_more" className={`shrink-0 text-2xl text-ink-soft transition-transform duration-300 ${pendingOpen ? "rotate-180" : ""}`} />
          </button>
          <div hidden={!pendingOpen}>
        {canManageResidents && <LinkRequestsCard residenceId={residenceId} requests={data.linkRequests} stays={data.unlinkedStays} />}

        <RoomChangeAlertsCard
        residenceId={residenceId}
        alerts={data.placeAlerts}
        residents={alertResidents}
        canDecide={canManageResidents}
        canPublish={canManageBeds}
        onMessage={setToast}
      />

        <StayChangeSection
        residenceId={residenceId}
        items={data.stayChanges}
        onRespond={(item) => setRespondingId(item.id)}
        onRegisterExit={registerExit}
        canAct={canManageResidents}
      />

          </div>
        </section>
      )}

      {toast && (
        <p role="status" className="mt-4 flex items-start gap-2 rounded-field bg-success-bg px-4 py-3 text-sm font-medium text-success-fg">
          <Icon name="check_circle" className="mt-0.5 shrink-0 text-lg" />
          {toast}
        </p>
      )}

      {/* Métricas = filtros: cada número es la lista que se ve al tocarlo */}
      <div className="mt-6 rounded-card border-[1.5px] border-line bg-paper p-3 shadow-card">
        <div role="group" aria-label="Filtrar por estado" className="flex gap-2 overflow-x-auto overscroll-x-contain pb-0.5">
          {STAT_TABS.map((t) => {
            const pressed = filter === t.key;
            const warm = !pressed && t.attention && t.count > 0;
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={pressed}
                onClick={() => setFilter(t.key)}
                className={`flex min-h-[64px] min-w-[112px] flex-1 cursor-pointer flex-col justify-between rounded-field border-[1.5px] px-3 py-2 text-left transition duration-200 ease-out-fresh motion-safe:active:scale-[0.98] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--tone) ${
                  pressed ? "border-(--tone) bg-(--tone) text-white" : warm ? "border-orange/50 bg-paper hover:bg-cream-2" : "border-line-2 bg-paper hover:bg-cream-2"
                }`}
              >
                <span className={`flex items-center gap-1 text-[11px] font-bold uppercase leading-tight tracking-[0.04em] ${pressed ? "text-white/90" : "text-ink-faint"}`}>
                  <Icon name={t.icon} className={`shrink-0 text-base ${pressed ? "text-white" : "text-(--tone)"}`} />
                  {t.label}
                </span>
                <span className={`font-display text-2xl font-bold leading-none tabular-nums ${pressed ? "text-white" : warm ? "text-orange-700" : "text-(--tone-ink)"}`}>{t.count}</span>
              </button>
            );
          })}
          <Link
            href={`/residence/${residenceId}/renewals`}
            className="flex min-h-[64px] min-w-[112px] flex-1 cursor-pointer flex-col justify-between rounded-field border-[1.5px] border-dashed border-line-2 bg-paper px-3 py-2 text-left hover:bg-cream-2 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--tone)"
          >
            <span className="flex items-center gap-1 text-[11px] font-bold uppercase leading-tight tracking-[0.04em] text-ink-faint">
              <Icon name="autorenew" className="shrink-0 text-base text-(--tone)" />
              Renovación
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl font-bold leading-none tabular-nums text-(--tone-ink)">{kpis.renewals}</span>
              <span className="text-xs text-ink-faint">{kpis.renewals === 1 ? "pedido u oferta" : "pedidos u ofertas"} →</span>
            </span>
          </Link>
        </div>
        <div className="relative mt-3">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-ink-faint" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o habitación…"
            aria-label="Buscar residentes"
            className="w-full rounded-field border-[1.5px] border-field-border bg-cream py-2 pl-10 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-forest focus:outline-2 focus:outline-offset-1 focus:outline-forest"
          />
        </div>
        {filter === "cambio_habitacion" && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-ink-soft">
              Tipo de habitación que buscan
              <select
                value={changeType}
                onChange={(e) => setChangeType(e.target.value)}
                className="mt-1 w-full rounded-field border-[1.5px] border-field-border bg-cream px-3 py-2 text-sm text-ink focus:border-forest focus:outline-2 focus:outline-offset-1 focus:outline-forest"
              >
                <option value="">Todos</option>
                {data.roomTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-ink-soft">
              Género de la habitación
              <select
                value={changeGender}
                onChange={(e) => setChangeGender(e.target.value)}
                className="mt-1 w-full rounded-field border-[1.5px] border-field-border bg-cream px-3 py-2 text-sm text-ink focus:border-forest focus:outline-2 focus:outline-offset-1 focus:outline-forest"
              >
                <option value="">Todos</option>
                {ROOM_CHANGE_GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {ROOM_CHANGE_GENDER_LABEL[g]}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-ink-faint sm:col-span-2">Incluye a quienes no pidieron un tipo o género puntual (les da igual). También podés buscar por piso o nota en el buscador.</p>
          </div>
        )}
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <div className="mt-6">
          {filter === "busca_cambiar" && !search.trim() ? (
            <EmptyState
              tone="residence"
              icon="swap_horiz"
              title="Nadie está buscando cambiar"
              description="Cuando un residente avise que busca otro lugar, lo vas a ver acá y te va a llegar una notificación con su fecha estimada de salida. Así te enterás con tiempo, no el día que se va."
            />
          ) : filter === "cambio_habitacion" && !search.trim() && !changeType && !changeGender ? (
            <EmptyState
              tone="residence"
              icon="swap_horiz"
              title="Nadie pidió otra habitación"
              description="Cuando un residente pida cambiar de habitación, o lo anotes vos desde su ficha en «Habitación y cama», lo vas a ver acá. Si se libera una plaza que coincide, te avisamos antes de publicarla."
            />
          ) : (
            <EmptyState
              tone="residence"
              icon="groups"
              title="Sin residentes para mostrar"
              description="Ajustá los filtros o cargá el primero con “Agregar residente”."
            />
          )}
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-card border-[1.5px] border-line bg-paper shadow-card">
          {!isMd && (
          <div className="flex items-center gap-2 border-b border-line bg-cream-2 px-4 py-2">
            <label htmlFor="residents-sort" className="text-xs font-bold uppercase tracking-wider text-muted">
              Ordenar
            </label>
            <select
              id="residents-sort"
              value={sort ? `${sort.key}:${sort.dir}` : ""}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(":");
                setSort(key ? { key: key as SortKey, dir: dir as "asc" | "desc" } : null);
              }}
              className="min-h-11 min-w-0 flex-1 rounded-field border-[1.5px] border-field-border bg-paper px-2 text-sm text-ink focus:border-forest focus:outline-2 focus:outline-offset-1 focus:outline-forest"
            >
              <option value="">Orden original</option>
              {SORT_COLUMNS.flatMap((c) => [
                <option key={`${c.key}:asc`} value={`${c.key}:asc`}>{c.label} ↑</option>,
                <option key={`${c.key}:desc`} value={`${c.key}:desc`}>{c.label} ↓</option>,
              ])}
            </select>
          </div>
          )}
          {!isMd && (
          <ul className="divide-y divide-line" aria-label="Residentes">
            {shown.map((row, i) => {
              const st = statusOf(row, todayStr, in30Str);
              const meta = STATUS_META[st];
              const open = openStayId === row.stayId;
              const effectiveRate = row.rateUsd ?? row.agreedRateUsd ?? row.baseRateUsd;
              return (
                <li key={row.stayId} id={`resident-card-${row.stayId}`} className={open ? "bg-cream-2/60" : undefined}>
                  <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-3 gap-y-2 p-4">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        ["bg-forest-tint text-forest-700", "bg-orange-tint text-orange-700", "bg-mint text-forest-700", "bg-sand-100 text-ink-soft"][i % 4]
                      }`}
                    >
                      {row.name[0]?.toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-bold text-ink">
                        <span className="truncate">{row.name}</span>
                        {row.flag && <span aria-hidden>{row.flag}</span>}
                        {row.hiddenFromCommunity && <Icon name="visibility_off" className="text-sm text-ink-faint" />}
                      </p>
                      <p className="text-sm text-ink-soft">
                        {row.roomLabel ? (
                          <>
                            {row.roomLabel}
                            {row.bedLetter && ` - ${row.bedLetter}`}
                          </>
                        ) : (
                          "Sin asignar"
                        )}
                        {row.typeName && ` · ${row.typeName}`}
                      </p>
                      {row.email && <p className="truncate text-xs text-ink-faint">{row.email}</p>}
                    </div>
                    <div className="col-start-2 flex flex-wrap gap-1">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      {row.stayChange?.status === "open" && (
                        <Badge tone="amber">
                          <Icon name="swap_horiz" className="text-sm" /> Busca cambiar
                        </Badge>
                      )}
                      {row.roomChange && isOpenRoomChangeStatus(row.roomChange.status) && (
                        <Badge tone="sage">
                          <Icon name="meeting_room" className="text-sm" /> Pide otra habitación
                        </Badge>
                      )}
                      {filter === "cambio_habitacion" && row.roomChange && (
                        <p className="basis-full text-xs text-ink-soft">
                          Busca: {describePreference({ typeName: row.roomChange.roomTypeName, gender: row.roomChange.gender, note: row.roomChange.note })}
                        </p>
                      )}
                    </div>
                    <div className="col-start-2 flex items-center justify-between gap-3">
                      <span className="text-sm text-ink-soft">
                        Hasta {formatDate(row.expectedEndDate)} · <b className="text-ink">{effectiveRate != null ? formatUsd(effectiveRate) : "—"}</b>
                      </span>
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-label={`${open ? "Cerrar" : "Gestionar"} ${row.name}`}
                        onClick={() => setOpenStayId(open ? null : row.stayId)}
                        className="min-h-11 shrink-0 cursor-pointer rounded-full border-[1.5px] border-line px-4 text-sm font-bold text-ink-soft hover:border-forest hover:text-forest-700"
                      >
                        {open ? "Cerrar" : "Gestionar"}
                      </button>
                    </div>
                  </div>
                  {open && (
                    <DetailPanel
                      residenceId={residenceId}
                      residenceName={residenceName}
                      row={row}
                      freeBeds={data.freeBeds}
                      notes={data.notesByStay[row.stayId] ?? []}
                      exitRequest={exitRequest}
                      canResidents={canManageResidents}
                      canBeds={canManageBeds}
                      roomTypes={data.roomTypes}
                      documentsLimited={data.stayDocumentsLimited}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          )}
          {isMd && (
          <div>
            <ScrollTable label="Residentes">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-cream-2">
                <tr>
                  {SORT_COLUMNS.map((c) => {
                    const active = sort?.key === c.key;
                    return (
                      <th key={c.key} scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className="px-4 py-1.5">
                        <button
                          type="button"
                          onClick={() => toggleSort(c.key)}
                          className={`-mx-2 inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-field px-2 text-xs font-bold uppercase tracking-wider hover:bg-line/50 hover:text-ink focus-visible:outline-2 focus-visible:outline-(--tone) ${active ? "text-(--tone-700)" : "text-muted"}`}
                        >
                          {c.label}
                          <Icon name={active ? (sort.dir === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"} className={`text-base ${active ? "" : "opacity-50"}`} />
                        </button>
                      </th>
                    );
                  })}
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row, i) => {
                  const st = statusOf(row, todayStr, in30Str);
                  const meta = STATUS_META[st];
                  const open = openStayId === row.stayId;
                  const effectiveRate = row.rateUsd ?? row.agreedRateUsd ?? row.baseRateUsd;
                  return (
                    <Fragment key={row.stayId}>
                      <tr
                        id={`resident-row-${row.stayId}`}
                        className={open ? "bg-cream-2/60" : undefined}
                        style={{ borderBottom: open ? undefined : "1px solid var(--color-line)" }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                ["bg-forest-tint text-forest-700", "bg-orange-tint text-orange-700", "bg-mint text-forest-700", "bg-sand-100 text-ink-soft"][i % 4]
                              }`}
                            >
                              {row.name[0]?.toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="flex items-center gap-1.5 font-bold text-ink">
                                <span className="truncate">{row.name}</span>
                                {row.flag && <span aria-hidden>{row.flag}</span>}
                                {row.hiddenFromCommunity && (
                                  <Icon name="visibility_off" className="text-sm text-ink-faint" />
                                )}
                              </p>
                              {row.email && <p className="truncate text-xs text-ink-faint">{row.email}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">
                          {row.roomLabel ? (
                            <>
                              {row.roomLabel}
                              {row.bedLetter && <span className="text-ink-soft"> - {row.bedLetter}</span>}
                            </>
                          ) : (
                            <span className="font-normal text-ink-faint">Sin asignar</span>
                          )}
                          {row.typeName && <span className="block text-xs font-normal text-ink-faint">{row.typeName}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                            {row.stayChange?.status === "open" && (
                              <Badge tone="amber">
                                <Icon name="swap_horiz" className="text-sm" /> Busca cambiar
                              </Badge>
                            )}
                            {row.roomChange && isOpenRoomChangeStatus(row.roomChange.status) && (
                              <Badge tone="sage">
                                <Icon name="meeting_room" className="text-sm" /> Pide otra habitación
                              </Badge>
                            )}
                            {filter === "cambio_habitacion" && row.roomChange && (
                              <p className="basis-full text-xs text-ink-soft">
                                Busca: {describePreference({ typeName: row.roomChange.roomTypeName, gender: row.roomChange.gender, note: row.roomChange.note })}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{formatDate(row.expectedEndDate)}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-bold text-ink">
                          {effectiveRate != null ? formatUsd(effectiveRate) : "—"}
                          {row.rateUsd != null && row.agreedRateUsd != null && row.rateUsd !== row.agreedRateUsd ? (
                            <span className="block text-xs font-normal text-orange-700">
                              difiere de lo acordado ({formatUsd(row.agreedRateUsd)})
                            </span>
                          ) : (
                            row.rateUsd != null &&
                            row.baseRateUsd != null &&
                            row.rateUsd !== row.baseRateUsd && (
                              <span className="block text-xs font-normal text-orange-700">personalizada</span>
                            )
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setOpenStayId(open ? null : row.stayId)}
                            className="cursor-pointer rounded-full border-[1.5px] border-line px-3.5 py-1.5 text-xs font-bold text-ink-soft hover:border-forest hover:text-forest-700"
                          >
                            {open ? "Cerrar" : "Gestionar"}
                          </button>
                        </td>
                      </tr>
                      {open && (
                        <tr style={{ borderBottom: "1px solid var(--color-line)" }}>
                          <td colSpan={6} className="p-0">
                            <DetailPanel
                              residenceId={residenceId}
                              residenceName={residenceName}
                              row={row}
                              freeBeds={data.freeBeds}
                              notes={data.notesByStay[row.stayId] ?? []}
                              exitRequest={exitRequest}
                              canResidents={canManageResidents}
                              canBeds={canManageBeds}
                              roomTypes={data.roomTypes}
                              documentsLimited={data.stayDocumentsLimited}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            </ScrollTable>
          </div>
          )}
        </div>
      )}

      {respondingItem && (
        <StayChangeResponseSheet
          residenceId={residenceId}
          residenceName={residenceName}
          item={respondingItem}
          onClose={() => setRespondingId(null)}
          onSaved={(message) => setToast(message)}
        />
      )}

      <p className="mt-4 text-xs text-ink-faint">
        Cada residente decide si aparece en la comunidad y qué datos muestra; la residencia no puede cambiarlo.
        Quien no activó su perfil se ve como «Plaza ocupada». Acá solo gestionás la operación de tu residencia.
      </p>
    </div>
  );
}
