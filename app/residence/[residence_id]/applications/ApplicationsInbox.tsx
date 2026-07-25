"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatUsd } from "@/lib/mock/exchange";
import { ApplicationActions } from "@/app/residence/[residence_id]/applications/[id]/ApplicationActions";

export type FullApplication = {
  id: string;
  status: string;
  contactTarget: string;
  desiredStartDate: string;
  initialDurationMonths: number;
  academicObjective: string;
  roomTypeId: string | null;
  roomTypeName: string | null;
  studentName: string;
  studentNationality: string | null;
  studentOriginCity: string | null;
  expiresAt: string | null;
  paymentDeadlineAt: string | null;
  createdAt: string;
  priceUsd: number | null;
  reservationStatus: string | null;
  whatsappUrl: string | null;
  waitlistRelatedCount: number;
  isActive: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  submitted: "Nueva",
  queued_for_place: "En cola",
  under_review: "En revisión",
  contact_established: "Contacto establecido",
  offer_pending_student_acceptance: "Propuesta enviada",
  conditions_accepted: "Condiciones aceptadas",
  residence_payment_pending: "Esperando pago del estudiante",
  residence_payment_reported: "Pago recibido",
  converted_to_reservation: "Reserva",
  paused_due_to_other_active_request: "Pausada",
  rejected: "Rechazada",
  expired_no_residence_response: "Vencida",
  expired_offer_no_response: "Vencida (propuesta)",
  cancelled_by_student: "Cancelada",
};
const STATUS_TONE: Record<string, "amber" | "sage" | "neutral" | "danger"> = {
  submitted: "amber",
  queued_for_place: "neutral",
  under_review: "amber",
  contact_established: "sage",
  offer_pending_student_acceptance: "amber",
  conditions_accepted: "sage",
  residence_payment_pending: "amber",
  residence_payment_reported: "sage",
  converted_to_reservation: "sage",
  paused_due_to_other_active_request: "neutral",
  rejected: "neutral",
  expired_no_residence_response: "neutral",
  expired_offer_no_response: "neutral",
  cancelled_by_student: "neutral",
};

const NEW_STATUSES = ["submitted", "queued_for_place", "under_review"];
const NEGOTIATION_STATUSES = [
  "contact_established",
  "offer_pending_student_acceptance",
  "conditions_accepted",
  "residence_payment_pending",
  "residence_payment_reported",
];
const URGENT_WINDOW_HOURS = 24;

function deadlineFor(app: FullApplication): string | null {
  if (["submitted", "under_review"].includes(app.status)) return app.expiresAt;
  if (["contact_established", "residence_payment_pending"].includes(app.status)) return app.paymentDeadlineAt;
  return null;
}

function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / (3600 * 1000);
}

type Group = { key: string; label: string; entries: FullApplication[] };

function groupApplications(applications: FullApplication[]): Group[] {
  const urgent: FullApplication[] = [];
  const fresh: FullApplication[] = [];
  const negotiation: FullApplication[] = [];
  const other: FullApplication[] = [];
  const closed: FullApplication[] = [];

  for (const app of applications) {
    if (!app.isActive) {
      closed.push(app);
      continue;
    }
    const deadline = deadlineFor(app);
    if (deadline && hoursUntil(deadline) <= URGENT_WINDOW_HOURS) {
      urgent.push(app);
    } else if (NEW_STATUSES.includes(app.status)) {
      fresh.push(app);
    } else if (NEGOTIATION_STATUSES.includes(app.status)) {
      negotiation.push(app);
    } else {
      other.push(app);
    }
  }

  urgent.sort((a, b) => hoursUntil(deadlineFor(a)!) - hoursUntil(deadlineFor(b)!));
  fresh.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  negotiation.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  other.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  closed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const groups: Group[] = [];
  if (urgent.length) groups.push({ key: "urgent", label: "Próximas a vencer", entries: urgent });
  if (fresh.length) groups.push({ key: "fresh", label: "Nuevas", entries: fresh });
  if (negotiation.length) groups.push({ key: "negotiation", label: "En negociación", entries: negotiation });
  if (other.length) groups.push({ key: "other", label: "Pausadas / otras activas", entries: other });
  if (closed.length) groups.push({ key: "closed", label: "Cerradas", entries: closed });
  return groups;
}

function ListRow({
  app,
  selected,
  urgent,
  onClick,
}: {
  app: FullApplication;
  selected: boolean;
  urgent: boolean;
  onClick: () => void;
}) {
  const badgeTone = STATUS_TONE[app.status] ?? "neutral";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full cursor-pointer rounded-field border-[1.5px] p-3 text-left transition-colors ${
        selected
          ? "border-forest bg-forest-tint"
          : urgent
            ? "border-danger-fg/30 bg-danger-bg/40 hover:border-danger-fg/50"
            : "border-line bg-paper hover:border-forest/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-bold text-ink">{app.studentName}</p>
        <Badge tone={badgeTone}>{STATUS_LABEL[app.status] ?? app.status}</Badge>
      </div>
      <p className="mt-0.5 truncate text-xs text-ink-faint">
        {app.roomTypeName ?? "Cualquier tipo"} · Ingreso {app.desiredStartDate}
      </p>
    </button>
  );
}

export function ApplicationsInbox({
  residenceId,
  applications,
  initialSelectedId,
}: {
  residenceId: string;
  applications: FullApplication[];
  initialSelectedId: string | null;
}) {
  const groups = useMemo(() => groupApplications(applications), [applications]);
  const firstEntryId = groups[0]?.entries[0]?.id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId && applications.some((a) => a.id === initialSelectedId) ? initialSelectedId : firstEntryId,
  );
  const selected = applications.find((a) => a.id === selectedId) ?? null;

  if (applications.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-3xl font-bold text-ink">Solicitudes recibidas</h1>
        <p className="mt-1 text-ink-soft">Revisá y respondé las solicitudes de reserva.</p>
        <div className="mt-8">
          <EmptyState
            icon="inbox"
            title="Todavía no recibiste solicitudes"
            description="Cuando un estudiante envíe una solicitud a esta residencia, va a aparecer acá."
          />
        </div>
      </div>
    );
  }

  const ListColumn = (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.key}>
          <div className="mb-2 flex items-center gap-2 px-1">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-muted">{group.label}</h2>
            <span className="rounded-full bg-cream-2 px-2 py-0.5 text-xs font-bold text-ink-soft">
              {group.entries.length}
            </span>
          </div>
          <div className="space-y-2">
            {group.entries.map((app) => (
              <ListRow
                key={app.id}
                app={app}
                selected={app.id === selectedId}
                urgent={group.key === "urgent"}
                onClick={() => setSelectedId(app.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const DetailColumn = selected ? (
    <ApplicationDetail residenceId={residenceId} app={selected} />
  ) : (
    <div className="flex h-full items-center justify-center rounded-card border-[1.5px] border-dashed border-line p-8 text-center text-sm text-ink-faint">
      Elegí una solicitud de la lista para ver el detalle.
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-bold text-ink">Solicitudes recibidas</h1>
      <p className="mt-1 text-ink-soft">Revisá y respondé las solicitudes de reserva.</p>

      {/* Desktop: 2 columnas — lista + detalle (el resumen vive dentro del detalle). */}
      <div className="mt-8 hidden gap-6 lg:grid lg:grid-cols-[340px_1fr]">
        <div className="sticky top-8 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">{ListColumn}</div>
        <div>{DetailColumn}</div>
      </div>

      {/* Mobile/tablet: lista sola, o detalle con botón de volver. */}
      <div className="mt-8 lg:hidden">
        {selected ? (
          <div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="mb-4 inline-flex cursor-pointer items-center gap-1 text-sm font-bold text-forest-700"
            >
              <Icon name="arrow_back" className="text-base" />
              Volver a la lista
            </button>
            {DetailColumn}
          </div>
        ) : (
          ListColumn
        )}
      </div>
    </div>
  );
}

function ApplicationDetail({ residenceId, app }: { residenceId: string; app: FullApplication }) {
  const statusLabel =
    app.status === "converted_to_reservation"
      ? app.reservationStatus === "confirmed"
        ? "Reserva confirmada"
        : "Reserva creada — fee pendiente"
      : (STATUS_LABEL[app.status] ?? app.status);

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink">{app.studentName}</h2>
          <p className="text-sm text-ink-soft">
            {[app.studentNationality, app.studentOriginCity, app.roomTypeName].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Badge tone="petrol">{statusLabel}</Badge>
      </div>

      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <div className="flex justify-between border-b border-sand-200 pb-2 sm:col-span-1">
          <dt className="text-ink-faint">Fecha de ingreso deseada</dt>
          <dd className="font-medium text-ink">{app.desiredStartDate}</dd>
        </div>
        <div className="flex justify-between border-b border-sand-200 pb-2 sm:col-span-1">
          <dt className="text-ink-faint">Duración estimada</dt>
          <dd className="font-medium text-ink">{app.initialDurationMonths} meses</dd>
        </div>
        <div className="flex justify-between border-b border-sand-200 pb-2 sm:col-span-1">
          <dt className="text-ink-faint">Tarifa acordada</dt>
          <dd className="font-medium text-ink">{app.priceUsd !== null ? formatUsd(app.priceUsd) : "—"}</dd>
        </div>
        <div className="flex justify-between border-b border-sand-200 pb-2 sm:col-span-1">
          <dt className="text-ink-faint">Contacto dirigido a</dt>
          <dd className="font-medium text-ink">{app.contactTarget === "family_member" ? "Familiar vinculado" : "Estudiante"}</dd>
        </div>
      </dl>

      <p className="mt-6 text-sm text-ink-soft">
        <span className="font-semibold text-ink">Objetivo académico:</span> {app.academicObjective}
      </p>

      {app.waitlistRelatedCount > 0 && (
        <Link
          href={`/residence/${residenceId}/waitlist`}
          className="mt-4 flex items-center gap-2 rounded-field bg-cream-2 px-3 py-2.5 text-xs font-semibold text-ink-soft hover:text-forest-700"
        >
          <Icon name="hourglass_top" className="text-sm" />
          {app.waitlistRelatedCount === 1
            ? "1 estudiante en lista de espera para este mismo tipo de habitación →"
            : `${app.waitlistRelatedCount} estudiantes en lista de espera para este mismo tipo de habitación →`}
        </Link>
      )}

      <div className="mt-8 border-t border-sand-200 pt-6">
        <ApplicationActions
          applicationId={app.id}
          residenceId={residenceId}
          status={app.status}
          reservationStatus={app.reservationStatus}
          whatsappUrl={app.whatsappUrl}
        />
      </div>
    </Card>
  );
}
