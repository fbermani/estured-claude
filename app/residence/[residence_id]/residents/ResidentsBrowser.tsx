"use client";

import { Fragment, useMemo, useState, useEffect, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatUsd } from "@/lib/mock/exchange";
import { AddResidentForm } from "@/app/residence/[residence_id]/residents/AddResidentForm";
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
  hiddenFromCommunity: boolean;
  typeName: string | null;
  roomLabel: string | null;
  bedLetter: string | null;
  startDate: string | null;
  expectedEndDate: string | null;
  rateUsd: number | null;
  baseRateUsd: number | null;
  /** Renovación vía `resident_stays.reservation_id`; `null` = estadía sin reserva de EstuRed vinculada. */
  renewal: {
    reservationId: string;
    reservationConfirmed: boolean;
    hasActiveOffer: boolean;
    studentRequested: boolean;
    statusLabel: string | null;
    statusTone: "amber" | "sage" | "neutral" | "danger";
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
  kpis: { active: number; arrivals: number; departures: number; renewals: number };
  notesByStay: Record<string, ResidentNote[]>;
};

const initialState: ResidentsActionState = { status: "idle" };

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return "—";
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

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

const FILTER_PILLS: { key: StatusKey | "todos"; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "activo", label: "Activos" },
  { key: "por_ingresar", label: "Por ingresar" },
  { key: "por_salir", label: "Por salir" },
  { key: "pendiente", label: "Pendientes" },
];

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
      <p className="mb-3 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-muted">
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
          className="w-full resize-none rounded-field border-[1.5px] border-line bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-forest focus:outline-none"
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
            className="shrink-0 cursor-pointer rounded-full bg-forest px-4 py-1.5 text-xs font-bold text-white hover:bg-forest-600"
          >
            {notePending ? "…" : "Guardar nota"}
          </button>
        </div>
        {noteState.status === "error" && <p className="mt-1.5 text-xs font-medium text-danger-fg">{noteState.message}</p>}
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
              <span className="mt-1 inline-block rounded-full bg-cream-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                {NOTE_CATEGORY_LABEL[note.category]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DetailPanel({
  residenceId,
  row,
  freeBeds,
  notes,
}: {
  residenceId: string;
  row: ResidentRow;
  freeBeds: { id: string; label: string }[];
  notes: ResidentNote[];
}) {
  const detailsAction = updateStayDetailsAction.bind(null, residenceId, row.stayId);
  const [detailsState, detailsFormAction, detailsPending] = useActionState(detailsAction, initialState);
  const bedAction = assignBedToStayAction.bind(null, residenceId, row.stayId);
  const [bedState, bedFormAction, bedPending] = useActionState(bedAction, initialState);
  const endAction = endResidentStayAction.bind(null, residenceId, row.stayId);
  const [endState, endFormAction, endPending] = useActionState(endAction, initialState);
  const [confirmEnd, setConfirmEnd] = useState(false);

  return (
    <div className="grid gap-5 border-t border-line bg-cream-2/60 p-5 sm:grid-cols-2 lg:grid-cols-4">
      {/* Salida exacta + tarifa — ref modal perfil del residente */}
      <form action={detailsFormAction} className="rounded-field border border-line bg-paper p-4">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-muted">
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
          className="w-full rounded-field border-[1.5px] border-line bg-cream px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none"
        />
        <label className="mb-1 mt-3 block text-xs font-bold text-ink" htmlFor={`rate-${row.stayId}`}>
          Tarifa del residente (USD)
        </label>
        <input
          id={`rate-${row.stayId}`}
          type="number"
          min={0}
          name="monthly_rate_usd"
          defaultValue={row.rateUsd ?? ""}
          placeholder={row.baseRateUsd != null ? `${row.baseRateUsd} (tarifa del tipo)` : "Sin tarifa"}
          className="w-full rounded-field border-[1.5px] border-line bg-cream px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none"
        />
        <p className="mt-1 text-[11px] text-ink-faint">Vacío = rige la tarifa del tipo de habitación.</p>
        <button
          type="submit"
          disabled={detailsPending}
          className="mt-3 cursor-pointer rounded-full bg-forest px-4 py-1.5 text-sm font-bold text-white hover:bg-forest-600"
        >
          {detailsPending ? "Guardando…" : "Guardar"}
        </button>
        {detailsState.status === "error" && (
          <p className="mt-2 text-xs font-medium text-danger-fg">{detailsState.message}</p>
        )}
        {detailsState.status === "saved" && <p className="mt-2 text-xs font-medium text-success-fg">Guardado.</p>}
      </form>

      {/* Habitación y cama */}
      <div className="rounded-field border border-line bg-paper p-4">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-muted">
          <Icon name="meeting_room" className="text-sm" /> Habitación y cama
        </p>
        <p className="text-sm font-semibold text-ink">
          {row.roomLabel ? `${row.roomLabel}${row.bedLetter ? ` · Cama ${row.bedLetter}` : ""}` : "Sin cama asignada"}
        </p>
        <form action={bedFormAction} className="mt-3">
          <select
            name="bed_id"
            required
            defaultValue=""
            className="w-full rounded-field border-[1.5px] border-line bg-cream px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none"
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
            className="mt-3 cursor-pointer rounded-full border-[1.5px] border-line px-4 py-1.5 text-sm font-bold text-ink-soft hover:border-forest hover:text-forest-700 disabled:opacity-50"
          >
            {bedPending ? "Asignando…" : "Cambiar ubicación"}
          </button>
        </form>
        {bedState.status === "error" && <p className="mt-2 text-xs font-medium text-danger-fg">{bedState.message}</p>}
        {bedState.status === "saved" && <p className="mt-2 text-xs font-medium text-success-fg">Reubicado.</p>}
      </div>

      {/* Renovación + zona de riesgo */}
      <div className="flex flex-col gap-4">
        <div className="rounded-field border border-line-2 bg-forest-tint/50 p-4">
          <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-forest-700">
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
        <div className="rounded-field border border-danger-fg/30 bg-danger-bg/50 p-4">
          <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-danger-fg">
            <Icon name="warning" className="text-sm" /> Zona de riesgo
          </p>
          {!confirmEnd ? (
            <button
              type="button"
              onClick={() => setConfirmEnd(true)}
              className="mt-2 cursor-pointer text-sm font-bold text-danger-fg hover:underline"
            >
              Finalizar estadía…
            </button>
          ) : (
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
          {endState.status === "error" && <p className="mt-2 text-xs font-medium text-danger-fg">{endState.message}</p>}
        </div>
      </div>

      <NotesSection residenceId={residenceId} row={row} notes={notes} />
    </div>
  );
}

export function ResidentsBrowser({
  residenceId,
  data,
}: {
  residenceId: string;
  data: ResidentsData;
}) {
  const [filter, setFilter] = useState<StatusKey | "todos">("todos");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const searchParams = useSearchParams();
  const [openStayId, setOpenStayId] = useState<string | null>(() => searchParams.get("stay"));

  // Deep-link `?stay=<id>` (ej. desde "Próximos ingresos y salidas" del
  // Panel, Ciclo 41) — abre y hace scroll a la fila correspondiente.
  useEffect(() => {
    const target = searchParams.get("stay");
    if (!target) return;
    setOpenStayId(target);
    document.getElementById(`resident-row-${target}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [searchParams]);

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const in30Str = new Date(today.getTime() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.rows.filter((row) => {
      const st = statusOf(row, todayStr, in30Str);
      if (filter !== "todos" && st !== filter) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        (row.email ?? "").toLowerCase().includes(q) ||
        (row.roomLabel ?? "").toLowerCase().includes(q)
      );
    });
  }, [data.rows, filter, search, todayStr, in30Str]);

  const { kpis } = data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink">Residentes</h1>
          <p className="mt-1 text-ink-soft">Gestioná ingresos, estadías y renovaciones en un solo lugar.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="flex cursor-pointer items-center gap-1.5 rounded-full bg-forest px-5 py-2.5 text-sm font-bold text-white shadow-card hover:bg-forest-600"
        >
          <Icon name={showAdd ? "close" : "person_add"} className="text-lg" />
          {showAdd ? "Cerrar" : "Agregar residente"}
        </button>
      </div>

      {showAdd && (
        <div className="mb-6">
          <AddResidentForm residenceId={residenceId} roomTypes={data.roomTypes} />
        </div>
      )}

      {/* KPIs — ref gestión de residentes (sin "evaluaciones": feature pospuesta) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm font-semibold text-ink-soft">Residentes activos</p>
          <p className="mt-1 text-3xl font-extrabold text-ink">{kpis.active}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-semibold text-ink-soft">Próximos ingresos</p>
          <p className="mt-1 text-3xl font-extrabold text-ink">{kpis.arrivals}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-semibold text-ink-soft">Salidas próximas</p>
          <p className="mt-1 flex items-baseline gap-2 text-3xl font-extrabold text-ink">
            {kpis.departures}
            <span className="text-xs font-semibold text-ink-faint">30 días</span>
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-semibold text-ink-soft">Renovación en ventana</p>
          <p className={`mt-1 text-3xl font-extrabold ${kpis.renewals > 0 ? "text-orange-700" : "text-ink"}`}>
            {kpis.renewals}
          </p>
        </Card>
      </div>

      {/* Búsqueda + pills */}
      <div className="mt-6 rounded-card border-[1.5px] border-line bg-paper p-4 shadow-card">
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-ink-faint" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o habitación…"
            className="w-full rounded-field border-[1.5px] border-line bg-cream py-2.5 pl-10 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-forest focus:outline-none"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {FILTER_PILLS.map((pill) => (
            <button
              key={pill.key}
              type="button"
              onClick={() => setFilter(pill.key)}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                filter === pill.key
                  ? "bg-forest text-white"
                  : "border-[1.5px] border-line bg-paper text-ink-soft hover:border-line-2"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="groups"
            title="Sin residentes para mostrar"
            description="Ajustá los filtros o cargá el primero con “Agregar residente”."
          />
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-card border-[1.5px] border-line bg-paper shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-cream-2">
                <tr>
                  {["Residente", "Habitación / Cama", "Estado", "Contrato hasta", "Tarifa mensual", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => {
                  const st = statusOf(row, todayStr, in30Str);
                  const meta = STATUS_META[st];
                  const open = openStayId === row.stayId;
                  const effectiveRate = row.rateUsd ?? row.baseRateUsd;
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
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{formatDate(row.expectedEndDate)}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-bold text-ink">
                          {effectiveRate != null ? formatUsd(effectiveRate) : "—"}
                          {row.rateUsd != null && row.baseRateUsd != null && row.rateUsd !== row.baseRateUsd && (
                            <span className="block text-[10px] font-normal text-orange-700">personalizada</span>
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
                              row={row}
                              freeBeds={data.freeBeds}
                              notes={data.notesByStay[row.stayId] ?? []}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-ink-faint">
        El residente controla su propia visibilidad en la comunidad pública; acá solo gestionás la operación de tu
        residencia.
      </p>
    </div>
  );
}
