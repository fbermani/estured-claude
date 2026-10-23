import type { UserRole } from "@/lib/auth/session";

/**
 * Qué muestra el panel de solicitud de la ficha según quién mira (Ciclo 57, SPEC §5). Función pura: el
 * server arma los hechos (rol, si está alojado, si es el equipo de ESTA residencia, bloqueo de menor) y acá
 * se decide el modo. No cambia ninguna regla de negocio: los bloqueos reales los sigue aplicando el server
 * al enviar (`createApplicationRequest`, `createFamilyProposal`). Quien tiene una reserva vigente sigue siendo
 * `student`: solo puede pedir fechas posteriores (`lib/students/reservationWindow.ts`), el panel lo avisa.
 */
export type RequestPanelMode =
  | "guest"
  | "student"
  | "minor_no_family"
  | "minor_no_phone"
  | "family"
  | "family_unlinked"
  | "team"
  | "other";

export function resolveRequestPanelMode(input: {
  roles: readonly UserRole[] | null;
  isOwnResidenceTeam: boolean;
  minorBlock: "no_family" | "no_phone" | null;
  linkedStudentsCount: number;
}): RequestPanelMode {
  if (!input.roles) return "guest";
  // El equipo de esta residencia ve una vista previa, aunque además tenga otro rol.
  if (input.isOwnResidenceTeam) return "team";
  if (input.roles.includes("family_member")) return input.linkedStudentsCount > 0 ? "family" : "family_unlinked";
  if (input.roles.includes("student")) {
    if (input.minorBlock === "no_family") return "minor_no_family";
    if (input.minorBlock === "no_phone") return "minor_no_phone";
    return "student";
  }
  return "other";
}

/** ¿El panel ofrece una acción que abre la hoja (formulario)? */
export function modeOpensSheet(mode: RequestPanelMode): boolean {
  return mode === "student" || mode === "family";
}
