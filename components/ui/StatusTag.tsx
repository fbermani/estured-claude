import type { AvailabilityMode } from "@/types/domain";
import { InfoTip } from "@/components/ui/InfoTip";

/**
 * Etiquetas de disponibilidad oficiales (docs/08 §4.5).
 * Nunca mostrar estados técnicos crudos al usuario.
 */
const availabilityCopy: Record<
  AvailabilityMode,
  { label: string; className: string }
> = {
  real_by_place: {
    label: "Disponibilidad asegurada",
    className: "bg-success-bg text-success-fg",
  },
  by_room_type_to_confirm: {
    label: "Disponibilidad informada",
    className: "bg-info-bg text-info-fg",
  },
  full: {
    label: "Residencia completa",
    className: "bg-warning-bg text-warning-fg",
  },
  not_updated: {
    label: "Sin disponibilidad actualizada",
    className: "bg-sand-100 text-ink-soft",
  },
  // docs/04 §10.2 (texto visible).
  paused_by_residence: {
    label: "Solicitudes pausadas por la residencia",
    className: "bg-sand-100 text-ink-soft",
  },
  paused_by_admin: {
    label: "Disponibilidad pausada por EstuRed",
    className: "bg-warning-bg text-warning-fg",
  },
};

/**
 * Etiqueta oficial de un estado de disponibilidad. Si el estado es `full` y se
 * pasa `roomTypeName`, es la variante POR TIPO de habitación ("Doble: completa"):
 * "Residencia completa" sería falso cuando solo un tipo está lleno (D3/H03,
 * Ciclo 55). Para los demás estados el nombre del tipo no cambia la etiqueta.
 */
export function availabilityLabel(mode: AvailabilityMode, roomTypeName?: string | null): string {
  if (mode === "full" && roomTypeName) return `${roomTypeName}: completa`;
  return availabilityCopy[mode].label;
}

export function StatusTag({
  mode,
  roomTypeName,
  elevated = false,
  withTip = false,
}: {
  mode: AvailabilityMode;
  /** Solo con `mode="full"`: muestra la variante por tipo ("Doble: completa"). */
  roomTypeName?: string | null;
  /** Sobre imágenes: fondo sólido con sombra para legibilidad. */
  elevated?: boolean;
  /** Agrega un (i) que explica qué significa el estado — para el primer contacto del usuario con el badge (ej. cards de catálogo). */
  withTip?: boolean;
}) {
  const { className } = availabilityCopy[mode];
  const label = availabilityLabel(mode, roomTypeName);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${className} ${
        elevated ? "shadow-float ring-1 ring-white/60" : ""
      }`}
    >
      {label}
      {withTip && (
        <InfoTip label={`Qué significa "${label}"`}>{availabilityHelpText(mode, roomTypeName)}</InfoTip>
      )}
    </span>
  );
}

export function availabilityHelpText(mode: AvailabilityMode, roomTypeName?: string | null): string {
  if (mode === "full" && roomTypeName) {
    return "No hay lugar informado en este tipo. Podés sumarte a la lista de espera.";
  }
  switch (mode) {
    case "real_by_place":
      return "Disponibilidad asegurada.";
    case "by_room_type_to_confirm":
      return "Disponibilidad informada por la residencia. Requiere confirmación al solicitar.";
    case "full":
      return "Residencia completa. Podés sumarte a la lista de espera.";
    case "not_updated":
      return "Sin disponibilidad actualizada. Podés consultar o sumarte a lista de espera si está habilitada.";
    case "paused_by_residence":
      return "Solicitudes pausadas por la residencia.";
    case "paused_by_admin":
      return "Disponibilidad pausada por EstuRed.";
  }
}
