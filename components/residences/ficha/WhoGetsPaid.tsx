import { Icon } from "@/components/ui/Icon";
import { FEE_PERCENT } from "@/lib/applications/fee";
import { formatUsd } from "@/lib/mock/exchange";
import { describeEnrollmentFee } from "@/lib/residences/enrollmentFee";
import { describeInitialPayment } from "@/lib/residences/fichaConditions";
import type { InitialPaymentConfig } from "@/lib/reservations/initialPayment";

/**
 * "Qué pagás y a quién": separa el pago a la residencia del fee de EstuRed para que nadie los confunda
 * (regla 3: pago a residencia, fee y reserva son entidades distintas). El 5% ya es público en `/terms`.
 */
export function WhoGetsPaid({
  initialPayment,
  hasDeposit,
  enrollment,
  forFamily = false,
}: {
  /** Vista del familiar vinculado (DR4): mismo desglose, copy en tercera persona y con "propuesta". */
  forFamily?: boolean;
  initialPayment: InitialPaymentConfig;
  hasDeposit: boolean;
  enrollment: { mode: "one_month" | "manual" | null; usd: number | null; frequency: "once" | "annual" };
}) {
  const feePercent = Math.round(FEE_PERCENT * 100);
  const initial = describeInitialPayment(initialPayment);
  const initialLabel =
    initial.kind === "fixed"
      ? `Pago inicial para reservar (${formatUsd(initial.usd)})`
      : initial.kind === "enrollment_only"
        ? "Pago inicial para reservar (matrícula)"
        : initial.kind === "deposit_only"
          ? "Pago inicial para reservar (depósito)"
          : "Pago inicial para reservar (primer mes)";
  // La matrícula la cobra la residencia (cargo de ingreso) y entra a la base del fee; el depósito no.
  const enrollmentInfo = describeEnrollmentFee({ enrollmentFeeMode: enrollment.mode, enrollmentFeeUsd: enrollment.usd });
  const hasEnrollment = enrollmentInfo.kind === "one_month" || enrollmentInfo.kind === "fixed";
  return (
    <div className="overflow-hidden rounded-card border-[1.5px] border-line bg-paper shadow-card">
      <h3 className="px-5 pt-5 text-lg font-bold text-ink">Qué pagás y a quién</h3>
      <div className="mt-4 grid border-t border-line md:grid-cols-2 md:divide-x md:divide-line">
        <div className="bg-forest-tint/50 p-5 max-md:border-b max-md:border-line">
          <p className="flex items-center gap-2 font-bold text-forest-700">
            <Icon name="home_work" className="text-xl" />
            A la residencia
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
            <li className="flex gap-2"><span aria-hidden="true">·</span>{initialLabel}</li>
            <li className="flex gap-2"><span aria-hidden="true">·</span>Renta mensual, mes a mes</li>
            {hasEnrollment && (
              <li className="flex gap-2">
                <span aria-hidden="true">·</span>
                Matrícula ({enrollment.frequency === "annual" ? "anual" : "única vez"})
              </li>
            )}
            {hasDeposit && <li className="flex gap-2"><span aria-hidden="true">·</span>Depósito reembolsable</li>}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-ink-faint">
            Se paga directamente a la residencia, recién cuando confirma la reserva y habilita el pago.
          </p>
        </div>
        <div className="bg-orange-tint/50 p-5">
          <p className="flex items-center gap-2 font-bold text-orange-700">
            <Icon name="verified_user" className="text-xl" />A EstuRed
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
            <li className="flex gap-2"><span aria-hidden="true">·</span>Fee del {feePercent}% sobre meses × tarifa + matrícula</li>
            <li className="flex gap-2"><span aria-hidden="true">·</span>Solo si la residencia confirma {forFamily ? "la" : "tu"} reserva</li>
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-ink-faint">
            {forFamily
              ? "Enviar una propuesta es gratis. Al armarla en «Proponer» ves el detalle exacto con los montos."
              : "Enviar la solicitud es gratis. Te mostramos el detalle exacto antes de enviarla."}
          </p>
        </div>
      </div>
    </div>
  );
}
