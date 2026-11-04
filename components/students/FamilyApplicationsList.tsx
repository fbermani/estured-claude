import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { FeeDeadlineNote } from "@/components/applications/FeeDeadlineNote";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { familyFeePayerNote } from "@/lib/payments/feeUrgentBanner";
import type { FamilyApplicationView } from "@/lib/family/loadFamilyOverview";

/**
 * Solicitudes y reserva del estudiante, vistas por el familiar vinculado (DR4, `docs/08` §6.1): solo lectura, en tercera
 * persona. La única acción propia del familiar es PAGAR el fee cuando es el pagador designado; el resto lo decide el
 * estudiante. Sin documentos ni mensajes privados.
 */
export function FamilyApplicationsList({
  applications,
  studentName,
  limit,
  emptyHint,
}: {
  applications: FamilyApplicationView[];
  studentName: string;
  limit?: number;
  emptyHint?: string;
}) {
  if (applications.length === 0) {
    return (
      <p className="rounded-field bg-sand-100 px-4 py-3 text-sm text-ink-soft">
        {emptyHint ?? `${studentName} todavía no envió solicitudes. Cuando lo haga, vas a ver acá cómo avanzan.`}
      </p>
    );
  }
  // Primero lo que necesita al familiar (pagar), después lo vigente y al final lo cerrado.
  const ordered = [...applications].sort((a, b) => rank(a) - rank(b));
  const shown = limit ? ordered.slice(0, limit) : ordered;
  const hidden = ordered.length - shown.length;

  return (
    <div className="tone-family space-y-3">
      {shown.map((a) => (
        <div
          key={a.id}
          className={`rounded-[18px] border p-4 shadow-card transition-shadow hover:shadow-card-hover ${a.nextAction?.kind === "pay_fee" ? "border-orange bg-gradient-to-b from-orange-tint to-paper to-80%" : "border-line bg-paper"}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-bold text-ink">{a.residenceName}</p>
              <p className="text-xs text-ink-soft">
                {[a.roomTypeName, `Ingreso ${formatDateOnly(a.desiredStartDate)}`].filter(Boolean).join(" · ")}
              </p>
            </div>
            <Badge tone={a.statusTone}>{a.statusLabel}</Badge>
          </div>

          {a.nextAction?.kind === "pay_fee" && (
            <div className="mt-3 space-y-2">
              <FeeDeadlineNote expiresAt={a.nextAction.expiresAt} />
              <Link
                href={a.nextAction.href}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-(--tone) px-4 text-sm font-bold text-white transition duration-200 ease-out-fresh motion-safe:active:scale-[0.97] hover:-translate-y-px hover:bg-(--tone-600) focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--tone)"
              >
                <Icon name="payments" className="text-base" /> Pagar el fee EstuRed
              </Link>
            </div>
          )}
          {a.nextAction?.kind === "waiting_fee_payment" && (
            <p className="mt-3 flex items-start gap-2 text-xs text-ink-soft">
              <Icon name="hourglass_top" className="mt-0.5 text-sm" /> Falta el pago del fee EstuRed.{" "}
              {familyFeePayerNote(a.nextAction.payerView, studentName)}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {a.nextAction?.kind === "view_receipt" && (
              <Link
                href={a.nextAction.href}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] border-line-2 px-3.5 text-xs font-semibold text-ink hover:border-(--tone) hover:bg-(--tone-tint) focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--tone)"
              >
                <Icon name="receipt_long" className="text-sm text-(--tone-700)" /> Ver comprobante
              </Link>
            )}
            <Link
              href={`/students/applications/${a.id}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] border-line-2 px-3.5 text-xs font-semibold text-ink hover:border-(--tone) hover:bg-(--tone-tint) focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--tone)"
            >
              <Icon name="open_in_new" className="text-sm" /> Ver detalle
            </Link>
          </div>
        </div>
      ))}
      {hidden > 0 && (
        <Link href="/students/applications" className="inline-flex min-h-11 items-center text-sm font-semibold text-(--tone-700) underline">
          Ver las {ordered.length} solicitudes
        </Link>
      )}
    </div>
  );
}

function rank(a: FamilyApplicationView): number {
  if (a.nextAction?.kind === "pay_fee") return 0;
  return a.isClosed ? 2 : 1;
}
