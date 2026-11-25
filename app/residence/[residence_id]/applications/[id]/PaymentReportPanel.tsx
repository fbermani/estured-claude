"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Textarea } from "@/components/ui/Input";
import { formatDateTime } from "@/lib/dates/format";
import { formatArs, formatUsd } from "@/lib/mock/exchange";
import type { PaymentReportView } from "@/lib/applications/paymentReportView";
import { DISPUTE_REASON_MAX } from "@/lib/applications/paymentReportView";
import { RESIDENCE_REOPEN_CAP_MESSAGE } from "@/lib/payments/reopenCap";
import {
  disputeReportedPayment,
  openStudentPaymentProof,
  resolveStudentPaymentIssue,
  type PaymentReviewState,
} from "@/app/residence/[residence_id]/applications/[id]/payment/reportActions";

const initialState: PaymentReviewState = { status: "idle" };

/**
 * Lo que el estudiante avisó del pago de la reserva (DR63 (e) y (l)), arriba del botón «Marcar pago recibido» (que sigue siendo la acción
 * principal de la pantalla). «Ya pagué»: se ve el comprobante (si lo hay) y se puede registrar «No recibí el pago». «No pude realizar el
 * pago»: se contacta por WhatsApp o se vuelve a habilitar el pago. Presentación: el servidor valida permiso, rol y estado de cada acción.
 * Nunca muestra datos de cobro.
 */
export function PaymentReportPanel({
  applicationId,
  report,
  canAct,
  isOwner,
  isMinor,
  methods,
  currentMethodKey,
}: {
  applicationId: string;
  report: PaymentReportView;
  /** Permiso `payments.residence` (solo presentación). */
  canAct: boolean;
  isOwner: boolean;
  isMinor: boolean;
  methods: { key: string; label: string }[];
  currentMethodKey: string | null;
}) {
  const [proofError, setProofError] = useState<string | null>(null);
  const [isOpening, startOpen] = useTransition();
  const [showDispute, setShowDispute] = useState(false);

  const disputeAction = disputeReportedPayment.bind(null, applicationId);
  const [disputeState, disputeFormAction, isDisputePending] = useActionState(disputeAction, initialState);
  const resolveAction = resolveStudentPaymentIssue.bind(null, applicationId);
  const [resolveState, resolveFormAction, isResolvePending] = useActionState(resolveAction, initialState);

  function openProof() {
    setProofError(null);
    startOpen(async () => {
      const result = await openStudentPaymentProof(applicationId);
      if (result.ok) window.open(result.url, "_blank", "noopener,noreferrer");
      else setProofError(result.error);
    });
  }

  if (report.disputed) {
    return (
      <div className="rounded-field border border-line-2 bg-warning-bg px-4 py-3 text-sm text-warning-fg">
        <p className="flex items-center gap-2 font-bold">
          <Icon name="flag" className="text-lg" /> Registraste que no recibiste este pago
        </p>
        <p className="mt-1 text-xs leading-relaxed">
          Soporte de EstuRed revisa el caso. Si igual lo recibís, podés confirmarlo abajo con «Marcar pago recibido».
          {report.disputeReason ? ` Tu motivo: ${report.disputeReason}` : ""}
        </p>
      </div>
    );
  }

  if (report.issueOpen) {
    const capReached = report.reopenLimitReached;
    const showMethodChoice = isOwner && methods.length > 1 && !capReached;
    return (
      <form action={resolveFormAction} className="space-y-3 rounded-field border border-line-2 bg-warning-bg px-4 py-3 text-sm text-warning-fg">
        <div>
          <p className="flex items-center gap-2 font-bold">
            <Icon name="error" className="text-lg" /> El estudiante no pudo realizar el pago
          </p>
          <p className="mt-1 text-xs leading-relaxed">
            {report.issueAt ? `Avisó el ${formatDateTime(report.issueAt)}. ` : ""}
            El plazo de 48 h está frenado hasta que respondas.
            {report.issueReason ? ` Motivo: ${report.issueReason}` : ""}
          </p>
          <p className="mt-1 text-xs leading-relaxed">
            {isMinor
              ? "Es menor: contactá solo a su familiar vinculado."
              : capReached
                ? "Podés contactarlo por WhatsApp."
                : "Podés contactarlo por WhatsApp o volver a habilitar el pago."}{" "}
            Al responder, el plazo de 48 h se reinicia.
          </p>
        </div>

        {showMethodChoice && (
          <label className="block text-xs font-bold text-ink-soft">
            Medio de pago al volver a habilitar
            <select
              name="chosen_method"
              defaultValue={currentMethodKey ?? ""}
              className="mt-1 w-full rounded-field border-[1.5px] border-field-border bg-cream px-3 py-2 text-sm text-ink focus:border-forest focus:outline-2 focus:outline-forest-tint"
            >
              {methods.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {resolveState.status === "error" && (
          <p role="alert" className="rounded-field bg-danger-bg px-3 py-2 text-sm font-medium text-danger-fg">
            {resolveState.message}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="resolution" value="contact_whatsapp" variant="outline" size="sm" disabled={!canAct || isResolvePending}>
            {isResolvePending ? "Guardando…" : "Contactar por WhatsApp"}
          </Button>
          <Button
            type="submit"
            name="resolution"
            value="reenable_payment"
            variant="outline"
            size="sm"
            disabled={!canAct || !isOwner || isResolvePending || capReached}
            title={capReached ? RESIDENCE_REOPEN_CAP_MESSAGE : isOwner ? undefined : "Solo el dueño puede volver a habilitar el pago con medios de cobro."}
          >
            Volver a habilitar el pago
          </Button>
        </div>
        {capReached && (
          <p role="status" className="text-xs">
            {RESIDENCE_REOPEN_CAP_MESSAGE}
          </p>
        )}
        {!isOwner && !capReached && <p className="text-xs">Volver a habilitar el pago lo hace solo el dueño de la residencia.</p>}
      </form>
    );
  }

  return (
    <div className="space-y-3 rounded-field border border-line-2 bg-mint px-4 py-3 text-sm text-forest-700">
      <div>
        <p className="flex items-center gap-2 font-bold">
          <Icon name="schedule" className="text-lg" /> El estudiante avisó que pagó
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          {report.reportedPaidAt ? `Lo avisó el ${formatDateTime(report.reportedPaidAt)}. ` : ""}
          Revisá que el pago esté en tu cuenta y confirmalo abajo. Hasta que lo confirmes la reserva no avanza.
        </p>
        {(report.reportedAmountUsd !== null || report.reportedAmountArs !== null || report.methodLabel) && (
          <p className="mt-1 text-xs tabular-nums text-ink-soft">
            Informó:{" "}
            {[
              report.reportedAmountUsd !== null ? formatUsd(report.reportedAmountUsd) : null,
              report.reportedAmountArs !== null ? formatArs(report.reportedAmountArs) : null,
              report.methodLabel,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {report.hasProof ? (
          <Button type="button" variant="outline" size="sm" disabled={!canAct || isOpening} onClick={openProof}>
            {isOpening ? "Abriendo…" : "Ver comprobante"}
          </Button>
        ) : (
          <span className="self-center text-xs text-ink-soft">Sin comprobante adjunto.</span>
        )}
        <Button type="button" variant="outline" size="sm" disabled={!canAct} aria-expanded={showDispute} onClick={() => setShowDispute((v) => !v)}>
          No recibí el pago
        </Button>
      </div>
      {proofError && (
        <p role="alert" className="rounded-field bg-danger-bg px-3 py-2 text-sm font-medium text-danger-fg">
          {proofError}
        </p>
      )}

      {showDispute && canAct && (
        <form action={disputeFormAction} className="space-y-3 rounded-field border border-line-2 bg-paper p-3 text-ink">
          <Textarea
            label="¿Qué pasó? (obligatorio)"
            name="reason"
            rows={3}
            required
            minLength={10}
            maxLength={DISPUTE_REASON_MAX}
            hint="Al menos 10 caracteres. No pongas datos bancarios."
          />
          <label className="flex items-start gap-3 text-xs text-ink-soft">
            <input type="checkbox" name="terms_accepted" required className="mt-0.5 h-4 w-4 accent-forest" />
            <span>
              Entiendo que esto abre un caso de Soporte, que EstuRed no interviene en el pago a la residencia ni lo garantiza, y que
              el estudiante va a recibir un aviso.
            </span>
          </label>
          {disputeState.status === "error" && (
            <p role="alert" className="rounded-field bg-danger-bg px-3 py-2 text-sm font-medium text-danger-fg">
              {disputeState.message}
            </p>
          )}
          <Button type="submit" variant="outline" size="sm" disabled={isDisputePending}>
            {isDisputePending ? "Registrando…" : "Registrar que no recibí el pago"}
          </Button>
        </form>
      )}
    </div>
  );
}
