import { formatUsd } from "@/lib/mock/exchange";

/**
 * Nota transparente cuando la residencia cargó para la estadía una tarifa
 * distinta de la que el estudiante aceptó en la reserva (H05, decisión D5:
 * la tarifa puede diferir, pero nunca en silencio). Sin acusar a nadie:
 * informa antes/ahora y deriva a Soporte si el estudiante no está de
 * acuerdo. Solo se muestra cuando `differs` es `true`.
 */
export function StayRateNote({
  agreedRateUsd,
  currentRateUsd,
  className = "",
}: {
  agreedRateUsd: number | null;
  currentRateUsd: number | null;
  className?: string;
}) {
  if (agreedRateUsd == null || currentRateUsd == null) return null;
  return (
    <p className={`rounded-field bg-warning-bg px-3 py-2 text-xs text-warning-fg ${className}`}>
      <span className="font-semibold">Tu residencia actualizó tu tarifa mensual:</span> antes {formatUsd(agreedRateUsd)}, ahora{" "}
      {formatUsd(currentRateUsd)}. Si no estás de acuerdo, escribile a Soporte.
    </p>
  );
}
