"use client";

import { useActionState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { cmd } from "@/components/admin/ui/tokens";
import { formatDateTime } from "@/lib/dates/format";
import { REJECTION_REASON_MAX, REJECTION_REASON_MIN } from "@/lib/residences/reservationCollection";
import type { PendingCollectionMethod } from "@/lib/residences/collectionApprovalDb";
import { reviewCollectionAccount, type CollectionReviewState } from "@/app/admin/collection-approvals/actions";

const initialState: CollectionReviewState = { status: "idle" };

/** Detalle de una residencia: un panel por medio con cambios pendientes, lo propuesto y lo vigente lado a lado. */
export function CollectionApprovalDetail({
  residence,
  methods,
}: {
  residence: { id: string; name: string; publicArea: string | null };
  methods: PendingCollectionMethod[];
}) {
  return (
    <div className="max-w-4xl space-y-6">
      <AdminCard className="p-6">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.primary }}>
          Residencias / Cobros de reserva
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold" style={{ color: cmd.onSurface }}>
            {residence.name}
          </h1>
          <Link href={`/admin/verifications?id=${residence.id}`} className="text-xs font-bold underline" style={{ color: cmd.primary }}>
            Ver verificación →
          </Link>
        </div>
        <p className="mt-1 text-sm" style={{ color: cmd.onSurfaceVariant }}>
          {residence.publicArea ?? "Zona sin definir"} · {methods.length === 1 ? "1 medio" : `${methods.length} medios`} con datos de cobro por revisar
        </p>
        <p className="mt-3 text-xs" style={{ color: cmd.outline }}>
          Son datos sensibles: ves el alias o CBU completo para poder aprobarlo. Un medio solo se ofrece al estudiante con datos aprobados. Hasta que apruebes, rigen los
          datos anteriores.
        </p>
      </AdminCard>

      {methods.length === 0 ? (
        <p className="text-sm" style={{ color: cmd.outline }}>
          Esta residencia ya no tiene datos de cobro por revisar.
        </p>
      ) : (
        methods.map((m) => <MethodReview key={`${m.methodKey}:${m.submittedAt}`} residenceId={residence.id} method={m} />)
      )}
    </div>
  );
}

function MethodReview({ residenceId, method }: { residenceId: string; method: PendingCollectionMethod }) {
  const router = useRouter();
  const reasonId = useId();
  const [state, formAction] = useActionState(reviewCollectionAccount, initialState);

  // La acción no revalida la cola (para no perder este mensaje): un instante después, se refresca sola.
  useEffect(() => {
    if (state.status !== "saved") return;
    const timer = setTimeout(() => router.refresh(), 1500);
    return () => clearTimeout(timer);
  }, [state.status, router]);

  const done = state.status === "saved";
  return (
    <AdminCard className="p-6">
      <form action={formAction}>
        <input type="hidden" name="residence_id" value={residenceId} />
        <input type="hidden" name="method_key" value={method.methodKey} />
        <input type="hidden" name="expected_submitted_at" value={method.submittedAt} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold" style={{ color: cmd.onSurface }}>
            {method.name}
          </h2>
          <div className="flex items-center gap-2">
            <AdminBadge tone={method.isFirstLoad ? "primary" : "amber"}>{method.isFirstLoad ? "Primera carga" : "Cambio"}</AdminBadge>
            <span className="text-xs" style={{ color: cmd.outline }}>
              Enviado el {formatDateTime(method.submittedAt)}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Side title="Vigente (aprobado)" label={method.currentLabel} details={method.currentDetails} empty="Todavía no hay datos aprobados." />
          <Side title="Propuesto" label={method.proposedLabel} details={method.proposedDetails} empty="Sin cambios en los datos (solo cambia el nombre)." highlight />
        </div>

        {state.status === "error" && (
          <p role="alert" className="mt-4 rounded px-3 py-2 text-sm font-medium" style={{ backgroundColor: cmd.roseBg, color: cmd.rose }}>
            {state.message}
          </p>
        )}
        {state.status === "saved" && (
          <p role="status" className="mt-4 rounded px-3 py-2 text-sm font-medium" style={{ backgroundColor: cmd.emeraldBg, color: cmd.emerald }}>
            {state.message}
          </p>
        )}

        <div className="mt-5">
          <label htmlFor={reasonId} className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
            Motivo del rechazo
          </label>
          <textarea
            id={reasonId}
            name="reason"
            rows={2}
            maxLength={REJECTION_REASON_MAX}
            disabled={done}
            placeholder={`Obligatorio si rechazás (al menos ${REJECTION_REASON_MIN} caracteres). El dueño lo ve. No escribas datos de cobro.`}
            className="mt-1 w-full rounded px-3 py-2 text-sm"
            style={{ border: `1px solid ${cmd.outline}` }}
          />
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <IntentButton intent="reject" variant="danger" label="Rechazar" disabled={done} />
          <IntentButton intent="approve" variant="primary" label="Aprobar" disabled={done} />
        </div>
      </form>
    </AdminCard>
  );
}

function Side({ title, label, details, empty, highlight = false }: { title: string; label: string | null; details: string | null; empty: string; highlight?: boolean }) {
  return (
    <div className="rounded p-3" style={{ border: `1px solid ${highlight ? cmd.primary : cmd.border}`, backgroundColor: highlight ? cmd.emeraldBg : cmd.surface }}>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
        {title}
      </p>
      {label ? (
        <p className="mt-2 text-xs" style={{ color: cmd.onSurfaceVariant }}>
          Nombre: <strong>{label}</strong>
        </p>
      ) : null}
      {details ? (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm font-medium" style={{ color: cmd.onSurface }}>
          {details}
        </p>
      ) : (
        <p className="mt-2 text-sm" style={{ color: cmd.outline }}>
          {empty}
        </p>
      )}
    </div>
  );
}

function IntentButton({ intent, variant, label, disabled }: { intent: "approve" | "reject"; variant: "primary" | "danger"; label: string; disabled: boolean }) {
  const { pending, data } = useFormStatus();
  const isThisPending = pending && data?.get("intent") === intent;
  return (
    <AdminButton type="submit" name="intent" value={intent} variant={variant} disabled={pending || disabled} className="whitespace-nowrap">
      {isThisPending ? "Guardando…" : label}
    </AdminButton>
  );
}
