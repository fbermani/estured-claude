import type { AvailabilityMode } from "@/types/domain";

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
};

export function StatusTag({
  mode,
  elevated = false,
}: {
  mode: AvailabilityMode;
  /** Sobre imágenes: fondo sólido con sombra para legibilidad. */
  elevated?: boolean;
}) {
  const { label, className } = availabilityCopy[mode];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${className} ${
        elevated ? "shadow-float ring-1 ring-white/60" : ""
      }`}
    >
      {label}
    </span>
  );
}

export function availabilityHelpText(mode: AvailabilityMode): string {
  switch (mode) {
    case "real_by_place":
      return "Disponibilidad asegurada.";
    case "by_room_type_to_confirm":
      return "Disponibilidad informada por la residencia. Requiere confirmación al solicitar.";
    case "full":
      return "Residencia completa. Podés sumarte a la lista de espera.";
    case "not_updated":
      return "Sin disponibilidad actualizada. Podés consultar o sumarte a lista de espera si está habilitada.";
  }
}
