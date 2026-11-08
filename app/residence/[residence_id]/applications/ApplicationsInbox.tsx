"use client";

import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { ResidenceHero } from "@/components/residences/ResidenceHero";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatUsd } from "@/lib/mock/exchange";
import { ApplicationActions, type ApplicationAllowed } from "@/app/residence/[residence_id]/applications/[id]/ApplicationActions";
import { getVisibleStatus, type ReservationStatusInput } from "@/lib/applications/visibleStatus";
import { describePaymentDeadline } from "@/lib/applications/paymentDeadline";
import type { ApplicantProfileView } from "@/lib/applications/applicantProfile";
import { ApplicantAvatar, ApplicantProfileBlock } from "@/app/residence/[residence_id]/applications/ApplicantProfileBlock";

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
  /** Perfil visible para la residencia, ya filtrado en el servidor (menor / interruptores de visibilidad). */
  applicant: ApplicantProfileView;
  expiresAt: string | null;
  paymentDeadlineAt: string | null;
  createdAt: string;
  priceUsd: number | null;
  /** `true` cuando ya hay condiciones acordadas (snapshot final); antes la tarifa es la solicitada. */
  priceAgreed: boolean;
  /** Reserva asociada (H01): su estado manda sobre el de la solicitud. */
  reservation: ReservationStatusInput | null;
  /** Reserva confirmada con comprobante emitido: solo N.º y código de verificación (sin facturación ni pagador). */
  confirmedBooking: { receiptNumber: string; verificationCode: string } | null;
  whatsappUrl: string | null;
  waitlistRelatedCount: number;
  isActive: boolean;
  /** DR3b: solicitud de un residente en proceso de mudanza. Nunca trae la residencia de origen ni el motivo (salvo la nota voluntaria). */
  moving: { label: string; note: string | null; advanceNotice: string | null } | null;
};

function visibleOf(app: FullApplication) {
  return getVisibleStatus({ applicationStatus: app.status, reservation: app.reservation, viewer: "residence" });
}

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

/** "Vence en 5 h" / "Vence en menos de 1 h" / "Plazo vencido", solo si falta poco (H24: es una marca, no un grupo). */
function urgencyLabel(app: FullApplication): string | null {
  if (!app.isActive) return null;
  const deadline = deadlineFor(app);
  if (!deadline) return null;
  const hours = hoursUntil(deadline);
  if (hours > URGENT_WINDOW_HOURS) return null;
  if (hours <= 0) return "Plazo vencido";
  if (hours < 1) return "Vence en menos de 1 h";
  return `Vence en ${Math.round(hours)} h`;
}

type Group = { key: string; label: string; entries: FullApplication[] };

/**
 * Agrupa por el ESTADO REAL (H24), no por urgencia: antes un mismo
 * `contact_established` caía en "Próximas a vencer" o en "En negociación"
 * según las horas que le quedaran, y "Cerradas" mezclaba reservas abiertas
 * con solicitudes terminales. La urgencia pasa a ser una marca en cada fila
 * y ordena dentro del grupo. "Cerrada" sale de `getVisibleStatus().isClosed`.
 */
function groupApplications(applications: FullApplication[]): Group[] {
  const buckets: Record<string, FullApplication[]> = {
    fresh: [],
    negotiation: [],
    reservation: [],
    paused: [],
    other: [],
    closed: [],
  };

  for (const app of applications) {
    const visible = visibleOf(app);
    if (visible.isClosed) buckets.closed.push(app);
    else if (app.status === "converted_to_reservation") buckets.reservation.push(app);
    else if (app.status === "paused_due_to_other_active_request") buckets.paused.push(app);
    else if (NEW_STATUSES.includes(app.status)) buckets.fresh.push(app);
    else if (NEGOTIATION_STATUSES.includes(app.status)) buckets.negotiation.push(app);
    else buckets.other.push(app);
  }

  const byDeadlineThenRecent = (a: FullApplication, b: FullApplication) => {
    const da = deadlineFor(a);
    const db = deadlineFor(b);
    if (da && db && da !== db) return new Date(da).getTime() - new Date(db).getTime();
    if (da && !db) return -1;
    if (!da && db) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  };
  const byRecent = (a: FullApplication, b: FullApplication) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  buckets.fresh.sort(byDeadlineThenRecent);
  buckets.negotiation.sort(byDeadlineThenRecent);
  buckets.reservation.sort(byRecent);
  buckets.paused.sort(byRecent);
  buckets.other.sort(byRecent);
  buckets.closed.sort(byRecent);

  const LABELS: [string, string][] = [
    ["fresh", "Nuevas"],
    ["negotiation", "En contacto y pago"],
    ["reservation", "Con reserva"],
    ["paused", "Pausadas"],
    ["other", "Otras activas"],
    ["closed", "Cerradas"],
  ];
  return LABELS.filter(([key]) => buckets[key].length > 0).map(([key, label]) => ({
    key,
    label,
    entries: buckets[key],
  }));
}

function ListRow({
  app,
  selected,
  onClick,
}: {
  app: FullApplication;
  selected: boolean;
  onClick: () => void;
}) {
  const visible = visibleOf(app);
  const urgency = urgencyLabel(app);
  const urgent = urgency !== null;
  // H06: en "Contacto establecido" el plazo se ve siempre (no solo cuando falta poco): si vence, la solicitud se cierra.
  const contactDeadline =
    app.status === "contact_established" && !urgent ? describePaymentDeadline(app.paymentDeadlineAt) : null;
  const basics = [app.applicant.age !== null ? `${app.applicant.age} años` : null, app.applicant.career]
    .filter(Boolean)
    .join(" · ");
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
      <div className="flex items-start gap-2.5">
        <ApplicantAvatar initial={app.applicant.avatarInitial} className="h-9 w-9 text-sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-bold text-ink">{app.studentName}</p>
            <Badge tone={visible.tone}>{visible.label}</Badge>
          </div>
          {basics && <p className="mt-0.5 truncate text-xs text-ink-soft">{basics}</p>}
          <p className="mt-0.5 truncate text-xs text-ink-faint">
            {app.roomTypeName ?? "Cualquier tipo"} · Ingreso {formatDateOnly(app.desiredStartDate)}
          </p>
          {app.moving && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-orange-tint px-2 py-0.5 text-xs font-bold text-orange-700">
              <Icon name="swap_horiz" className="text-sm" />
              {app.moving.label}
            </p>
          )}
          {urgency && (
            <p className="mt-1 flex items-center gap-1 text-xs font-bold text-danger-fg">
              <Icon name="schedule" className="text-sm" />
              {urgency}
            </p>
          )}
          {contactDeadline && (
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-ink-soft">
              <Icon name="schedule" className="text-sm" />
              {contactDeadline.relative}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

export function ApplicationsInbox({
  residenceId,
  applications,
  initialSelectedId,
  allowed,
}: {
  residenceId: string;
  applications: FullApplication[];
  initialSelectedId: string | null;
  /** DR11: permisos de quien mira, resueltos en el servidor (solo presentación; cada acción se valida en el servidor). */
  allowed: ApplicationAllowed;
}) {
  const groups = useMemo(() => groupApplications(applications), [applications]);
  const firstEntryId = groups[0]?.entries[0]?.id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId && applications.some((a) => a.id === initialSelectedId) ? initialSelectedId : firstEntryId,
  );
  const selected = applications.find((a) => a.id === selectedId) ?? null;

  if (applications.length === 0) {
    return (
      <div className="tone-residence mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <ResidenceHero icon="inbox" title="Solicitudes recibidas" subtitle="Revisá y respondé las solicitudes de reserva." />
        <div className="mt-8">
          <EmptyState
            tone="residence"
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
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted">{group.label}</h2>
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
                onClick={() => setSelectedId(app.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const DetailColumn = selected ? (
    <ApplicationDetail residenceId={residenceId} app={selected} allowed={allowed} />
  ) : (
    <div className="flex h-full items-center justify-center rounded-card border-[1.5px] border-dashed border-line p-8 text-center text-sm text-ink-faint">
      Elegí una solicitud de la lista para ver el detalle.
    </div>
  );

  return (
    <div className="tone-residence mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <ResidenceHero icon="inbox" title="Solicitudes recibidas" subtitle="Revisá y respondé las solicitudes de reserva." actions={<span className="inline-flex items-center rounded-full bg-paper px-2.5 py-1 text-xs font-bold text-(--tone-700)">{applications.length === 1 ? "1 solicitud" : `${applications.length} solicitudes`}</span>} />

      {/* Desktop: 2 columnas — lista + detalle (el resumen vive dentro del detalle). */}
      <div className="mt-6 hidden gap-6 lg:grid lg:grid-cols-[340px_1fr]">
        <div className="sticky top-8 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">{ListColumn}</div>
        <div>{DetailColumn}</div>
      </div>

      {/* Mobile/tablet: lista sola, o detalle con botón de volver. */}
      <div className="mt-6 lg:hidden">
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

function ApplicationDetail({ residenceId, app, allowed }: { residenceId: string; app: FullApplication; allowed: ApplicationAllowed }) {
  const visible = visibleOf(app);

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink">Solicitud de {app.studentName}</h2>
          <p className="text-sm text-ink-soft">{app.roomTypeName ?? "Cualquier tipo de habitación"}</p>
        </div>
        <Badge tone={visible.tone}>{visible.label}</Badge>
      </div>

      {app.moving && (
        <div className="mt-4 rounded-field border border-orange/30 bg-orange-tint/50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-orange-700">
            <Icon name="swap_horiz" className="text-lg" />
            {app.moving.label}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            Este estudiante ya vive en una residencia y está buscando cambiarse. No vemos de cuál viene: solo lo que él decida contarte.
          </p>
          {app.moving.note && (
            <blockquote className="mt-2 border-l-4 border-orange pl-3 text-sm leading-relaxed text-ink">{app.moving.note}</blockquote>
          )}
          {app.moving.advanceNotice && app.isActive && (
            <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-ink-soft">
              <Icon name="schedule" className="mt-0.5 shrink-0 text-sm" />
              {app.moving.advanceNotice}
            </p>
          )}
        </div>
      )}

      <ApplicantProfileBlock applicant={app.applicant} beforeContact={NEW_STATUSES.includes(app.status)} />

      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <div className="flex justify-between border-b border-sand-200 pb-2 sm:col-span-1">
          <dt className="text-ink-faint">Fecha de ingreso deseada</dt>
          <dd className="font-medium text-ink">{formatDateOnly(app.desiredStartDate)}</dd>
        </div>
        <div className="flex justify-between border-b border-sand-200 pb-2 sm:col-span-1">
          <dt className="text-ink-faint">Duración estimada</dt>
          <dd className="font-medium text-ink">{app.initialDurationMonths} meses</dd>
        </div>
        <div className="flex justify-between border-b border-sand-200 pb-2 sm:col-span-1">
          <dt className="text-ink-faint">{app.priceAgreed ? "Tarifa acordada" : "Tarifa solicitada"}</dt>
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

      {app.confirmedBooking && (
        <div className="mt-6 rounded-card border border-success-fg/30 bg-success-bg p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-success-fg">
            <Icon name="verified" className="text-lg" />
            Reserva confirmada
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Ingreso</p>
          <p className="text-xl font-bold text-ink">{formatDateOnly(app.desiredStartDate)}</p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-faint">Comprobante N.º</dt>
              <dd className="font-mono font-semibold text-ink">{app.confirmedBooking.receiptNumber}</dd>
            </div>
            <div>
              <dt className="text-ink-faint">Verificación pública</dt>
              <dd>
                <a
                  href={`/verify/${app.confirmedBooking.verificationCode}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-forest-700 underline"
                >
                  Verificar comprobante
                </a>
              </dd>
            </div>
          </dl>
          <Link
            href={`/residence/${residenceId}/residents`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700"
          >
            Ir a Residentes →
          </Link>
        </div>
      )}

      <div className="mt-8 border-t border-sand-200 pt-6">
        <ApplicationActions
          applicationId={app.id}
          residenceId={residenceId}
          status={app.status}
          reservation={app.reservation}
          whatsappUrl={app.whatsappUrl}
          paymentDeadlineAt={app.paymentDeadlineAt}
          allowed={allowed}
        />
      </div>
    </Card>
  );
}
