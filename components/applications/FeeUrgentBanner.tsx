import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { describeFeeBanner, familyFeePayerNote, type FeePayerView } from "@/lib/payments/feeUrgentBanner";

/**
 * Aviso del plazo del fee EstuRed, arriba de todo en el panel (estudiante y familiar). Con menos de 24 h cambia a tono de
 * urgencia. Sin datos de facturación ni de otros estudiantes. Presentación pura: el plazo ya viene leído.
 */
export function FeeUrgentBanner({
  audience,
  expiresAt,
  residenceName,
  href,
  studentName,
  payerView,
  now,
}: {
  audience: "student" | "family";
  expiresAt: string;
  residenceName: string;
  /** Pantalla del fee; en el familiar solo se usa si es el pagador. */
  href: string;
  studentName?: string;
  payerView?: FeePayerView;
  now?: Date;
}) {
  const info = describeFeeBanner(expiresAt, now);
  if (!info) return null;

  const isFamily = audience === "family";
  const name = studentName ?? "tu familiar";
  const canPay = !isFamily || payerView === "viewer_pays";
  const note = isFamily && payerView ? familyFeePayerNote(payerView, name) : null;

  return (
    <section
      aria-label="Plazo para pagar el fee de EstuRed"
      className={`mt-6 flex flex-wrap items-center justify-between gap-4 rounded-card border p-5 ${
        info.urgent ? "border-orange bg-warning-bg" : "border-line-2 bg-forest-tint"
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon name="schedule" className={`mt-0.5 shrink-0 text-2xl ${info.urgent ? "text-warning-fg" : "text-forest-700"}`} />
        <div className="min-w-0">
          <p className={`font-bold ${info.urgent ? "text-warning-fg" : "text-ink"}`}>
            {isFamily
              ? `Falta el fee de EstuRed de ${name}: vence el ${info.absolute}`
              : `Tenés hasta el ${info.absolute} para pagar el fee de EstuRed`}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {info.urgent ? "Falta menos de un día. " : ""}
            Reserva en {residenceName}. Si no se registra el pago antes, la reserva vence.
            {note ? ` ${note}` : ""}
          </p>
        </div>
      </div>
      {canPay && (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-bold text-white hover:bg-forest-600"
        >
          <Icon name="payments" className="text-base" /> {isFamily ? "Pagar el fee" : "Pagar el fee de EstuRed"}
        </Link>
      )}
    </section>
  );
}
