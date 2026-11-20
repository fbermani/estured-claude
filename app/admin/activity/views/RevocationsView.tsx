import type { ReactNode } from "react";
import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/dates/format";
import { formatShortName } from "@/lib/format/shortName";
import { pluralize } from "@/lib/format/plural";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { cmd } from "@/components/admin/ui/tokens";
import { REFUND_METHOD_LABELS } from "@/lib/revocations/copy";
import { buenosAiresDateString } from "@/lib/revocations/evaluateResolution";
import { loadRevocationRecords, type RevocationRecord, type RevocationState } from "@/lib/revocations/loadRevocations";
import { REVOCATION_WINDOW_DAYS, describeRevocationDay, pendingAgeDays } from "@/lib/revocations/window";
import { ResolveRevocationForm } from "@/app/admin/activity/views/ResolveRevocationForm";

const STATE_BADGE: Record<RevocationState, { label: string; tone: "amber" | "emerald" | "neutral" }> = {
  pending: { label: "Pendiente", tone: "amber" },
  refunded: { label: "Reintegrada", tone: "emerald" },
  denied: { label: "Denegada", tone: "neutral" },
  other: { label: "Otro estado", tone: "neutral" },
};

function ars(value: number): string {
  return `ARS ${value.toLocaleString("es-AR")}`;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
        {label}
      </dt>
      <dd className="mt-0.5 text-sm" style={{ color: cmd.onSurface }}>
        {children}
      </dd>
    </div>
  );
}

function RevocationCard({ record, canResolve, todayIso, now }: { record: RevocationRecord; canResolve: boolean; todayIso: string; now: Date }) {
  const badge = STATE_BADGE[record.state];
  const window = record.window;
  const pending = record.state === "pending";

  return (
    <AdminCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-bold" style={{ color: cmd.onSurface }}>
            {record.studentName ? formatShortName(record.studentName.firstName, record.studentName.lastInitial) : "Estudiante"}
            <span className="font-normal" style={{ color: cmd.onSurfaceVariant }}>
              {" "}
              · {record.residenceName ?? "Residencia"}
              {record.residenceArea ? ` (${record.residenceArea})` : ""}
            </span>
          </p>
          {record.requestedBy && (
            <p className="text-xs" style={{ color: cmd.outline }}>
              La pidió {record.requestedBy === "family_member" ? "un familiar (pagador del fee)" : "el estudiante"}
            </p>
          )}
        </div>
        <AdminBadge tone={badge.tone}>{badge.label}</AdminBadge>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <Fact label={pending ? "Fee a reintegrar" : "Fee"}>
          <span className="font-bold">{ars(record.feeAmountArs)}</span>
          {record.paymentCurrency === "USD" && (
            <span className="block text-xs font-semibold" style={{ color: cmd.amber }}>
              Pagado en USD
            </span>
          )}
          {record.feeAmountUsd !== null && (
            <span className="block text-xs" style={{ color: cmd.outline }}>
              ≈ USD {record.feeAmountUsd.toLocaleString("es-AR")}
            </span>
          )}
        </Fact>
        <Fact label="Fee pagado el">{record.paidAt ? formatDate(record.paidAt) : "—"}</Fact>
        <Fact label="Revocada el">{record.revokedAt ? formatDateTime(record.revokedAt) : "—"}</Fact>
        <Fact label={`Plazo de ${REVOCATION_WINDOW_DAYS} días corridos`}>
          {window ? (
            <>
              <span className="font-bold" style={{ color: window.withinWindow ? cmd.emerald : cmd.rose }}>
                {window.withinWindow ? "Dentro de plazo" : "Fuera de plazo"}
              </span>
              <span className="block text-xs" style={{ color: cmd.outline }}>
                Revocada {describeRevocationDay(window)}; el plazo {window.deadline.getTime() > now.getTime() ? "vence" : "venció"} el {formatDate(window.deadline)}.
              </span>
            </>
          ) : (
            "No se pudo calcular"
          )}
        </Fact>
        {pending && record.revokedAt && (
          <Fact label="Sin resolver hace">{pluralize(pendingAgeDays(record.revokedAt, now), "día", "días")}</Fact>
        )}
        {record.supportCaseId && (
          <Fact label="Soporte">
            <Link href={`/admin/support-cases?id=${record.supportCaseId}`} className="font-bold hover:underline" style={{ color: cmd.primary }}>
              Ver caso →
            </Link>
          </Fact>
        )}
      </dl>

      {record.studentReason && (
        <p className="mt-3 text-sm" style={{ color: cmd.onSurfaceVariant }}>
          <span className="font-semibold" style={{ color: cmd.onSurface }}>
            Motivo del estudiante:
          </span>{" "}
          {record.studentReason}
        </p>
      )}

      {!pending && (
        <div className="mt-4 rounded-lg p-3 text-sm" style={{ backgroundColor: cmd.surfaceContainerLow, color: cmd.onSurfaceVariant }}>
          {record.state === "refunded" ? (
            <p>
              <span className="font-bold" style={{ color: cmd.onSurface }}>
                Reintegrada
              </span>
              {record.refundedAt ? ` el ${formatDate(record.refundedAt)}` : ""}
              {record.refundAmountArs !== null ? ` por ${ars(record.refundAmountArs)}` : ""}
              {record.refundMethod ? ` · ${REFUND_METHOD_LABELS[record.refundMethod] ?? record.refundMethod}` : ""}
              {record.refundReference ? ` · ref. ${record.refundReference}` : ""}.
            </p>
          ) : record.state === "other" ? (
            <p>
              <span className="font-bold" style={{ color: cmd.onSurface }}>
                El fee está en estado «{record.feeStatus}»
              </span>
              : no es una revocación pendiente de resolver desde acá. Revisalo con el equipo de pagos.
            </p>
          ) : (
            <p className="font-bold" style={{ color: cmd.onSurface }}>
              Denegada{record.resolvedAt ? ` el ${formatDate(record.resolvedAt)}` : ""}.
            </p>
          )}
          {record.internalReason && (
            <p className="mt-1">
              <span className="font-semibold">Motivo interno:</span> {record.internalReason}
            </p>
          )}
          {record.studentMessage && (
            <p className="mt-1">
              <span className="font-semibold">Mensaje al estudiante:</span> {record.studentMessage}
            </p>
          )}
        </div>
      )}

      {pending && canResolve && window && record.paidAt && (
        <details className="group mt-4">
          <summary
            className="inline-flex cursor-pointer list-none items-center rounded-full px-5 py-2 text-sm font-bold text-white"
            style={{ backgroundColor: cmd.primary }}
          >
            Resolver revocación
          </summary>
          <ResolveRevocationForm
            reservationId={record.reservationId}
            feeAmountArs={record.feeAmountArs}
            withinWindow={window.withinWindow}
            dayLabel={describeRevocationDay(window)}
            paidInUsd={record.paymentCurrency === "USD"}
            todayIso={todayIso}
          />
        </details>
      )}
    </AdminCard>
  );
}

export async function RevocationsView() {
  const admin = getSupabaseAdmin();
  const { records, migrationApplied, loadFailed } = admin
    ? await loadRevocationRecords(admin)
    : { records: [] as RevocationRecord[], migrationApplied: true, loadFailed: false };

  const now = new Date();
  const todayIso = buenosAiresDateString(now);

  const pending = records
    .filter((r) => r.state === "pending")
    .sort((a, b) => new Date(a.revokedAt ?? 0).getTime() - new Date(b.revokedAt ?? 0).getTime());
  const resolved = records
    .filter((r) => r.state !== "pending")
    .sort((a, b) => new Date(b.resolvedAt ?? b.revokedAt ?? 0).getTime() - new Date(a.resolvedAt ?? a.revokedAt ?? 0).getTime());

  return (
    <div className="p-8">
      <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
        Revocaciones del fee
      </h1>
      <p className="mt-1 max-w-3xl text-sm" style={{ color: cmd.onSurfaceVariant }}>
        Cuando un estudiante revoca el fee dentro de los 10 días corridos del pago, EstuRed le reintegra el fee completo después de tu
        revisión. El fee sigue pagado hasta que lo resuelvas, siempre con motivo. Lo pagado a la residencia queda afuera.
      </p>
      <p className="mt-2 text-sm font-semibold" style={{ color: cmd.onSurface }}>
        {pluralize(pending.length, "pendiente", "pendientes")} · {records.filter((r) => r.state === "refunded").length} reintegradas ·{" "}
        {records.filter((r) => r.state === "denied").length} denegadas
        {records.some((r) => r.state === "other") ? ` · ${records.filter((r) => r.state === "other").length} en otro estado` : ""}
      </p>

      {!migrationApplied && (
        <p role="status" className="mt-4 rounded-lg px-4 py-3 text-sm font-medium" style={{ backgroundColor: cmd.amberBg, color: cmd.amber }}>
          Falta aplicar la migración 0049: por ahora la lista es solo de lectura y no se puede registrar la resolución.
        </p>
      )}
      {loadFailed && (
        <p role="alert" className="mt-4 rounded-lg px-4 py-3 text-sm font-medium" style={{ backgroundColor: cmd.roseBg, color: cmd.rose }}>
          No pudimos cargar las revocaciones. Recargá la página; si sigue igual, revisá los logs del servidor.
        </p>
      )}

      {records.length === 0 && !loadFailed && (
        <AdminCard className="mt-6 p-6">
          <p className="text-sm" style={{ color: cmd.outline }}>
            Todavía no hay revocaciones registradas.
          </p>
        </AdminCard>
      )}

      {pending.length > 0 && (
        <section className="mt-6 space-y-4" aria-label="Revocaciones pendientes">
          {pending.map((r) => (
            <RevocationCard key={r.reservationId} record={r} canResolve={migrationApplied} todayIso={todayIso} now={now} />
          ))}
        </section>
      )}

      {resolved.length > 0 && (
        <section className="mt-8" aria-label="Revocaciones resueltas">
          <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
            Resueltas
          </h2>
          <div className="mt-3 space-y-4">
            {resolved.map((r) => (
              <RevocationCard key={r.reservationId} record={r} canResolve={false} todayIso={todayIso} now={now} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
