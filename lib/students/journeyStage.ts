/**
 * Etapa del camino del estudiante para el dashboard («Tu próximo paso»). Es solo presentación: deriva la etapa de
 * los estados oficiales ya resueltos por `getVisibleStatus` (docs/04) y nunca muestra el estado técnico — el texto
 * sale de `label`/`helper` de ese helper. No decide permisos ni transiciones.
 */
export const JOURNEY_STEPS = ["Perfil", "Buscar", "Solicitud", "Propuesta", "Pago", "Reserva"] as const;
export type JourneyStage = 1 | 2 | 3 | 4 | 5 | 6;

export type JourneyApplication = {
  id: string;
  residenceName: string;
  /** `VisibleStatus.key`: estado de la reserva asociada si existe, si no el de la solicitud. */
  statusKey: string;
  label: string;
  helper: string;
  studentActionRequired: boolean;
};

export type NextStep = {
  stage: JourneyStage;
  title: string;
  description: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string } | null;
};

const STAGE_BY_KEY: Record<string, JourneyStage> = {
  offer_pending_student_acceptance: 4,
  conditions_accepted: 4,
  residence_payment_pending: 5,
  residence_payment_reported: 5,
  pending_estured_fee: 5,
  estured_fee_processing: 5,
  estured_fee_failed: 5,
  pending_manual_payment: 5,
  confirmed: 6,
  receipt_pending: 6,
  receipt_issued: 6,
  completed: 6,
};

export function stageForStatusKey(key: string): JourneyStage {
  return STAGE_BY_KEY[key] ?? 3;
}

function titleFor(stage: JourneyStage, name: string, action: boolean): string {
  if (stage === 4) return action ? `Revisá la propuesta de ${name}` : `Tu propuesta de ${name}`;
  if (stage === 5) return action ? `Seguí con tu reserva en ${name}` : `Tu pago en ${name}`;
  if (stage === 6) return `Tu reserva en ${name}`;
  return `Tu solicitud a ${name}`;
}

/**
 * `application`: la solicitud vigente más relevante (con acción pendiente primero), o `null` si no hay ninguna
 * en curso (sin solicitudes o todas cerradas).
 */
export function getNextStep(input: {
  profilePercent: number;
  application: JourneyApplication | null;
  hadPreviousApplications?: boolean;
}): NextStep {
  const { profilePercent, application, hadPreviousApplications } = input;

  if (application) {
    const stage = stageForStatusKey(application.statusKey);
    const href = `/students/applications/${application.id}`;
    return {
      stage,
      title: titleFor(stage, application.residenceName, application.studentActionRequired),
      description: application.helper || application.label,
      primary: {
        label: application.studentActionRequired ? (stage === 4 ? "Ver propuesta" : "Continuar") : "Ver mi solicitud",
        href,
      },
      secondary: { label: "Todas mis solicitudes", href: "/students/applications" },
    };
  }

  if (profilePercent < 100) {
    return {
      stage: 1,
      title: "Completá tu perfil para pedir residencia",
      description:
        "Con tu perfil completo, las residencias te conocen mejor y tu solicitud tiene más chances. Te lleva unos minutos.",
      primary: { label: "Completar mi perfil", href: "/students/profile" },
      secondary: { label: "Buscar residencias", href: "/search" },
    };
  }

  return {
    stage: 2,
    title: hadPreviousApplications ? "Seguí buscando tu residencia" : "Elegí tu residencia",
    description: hadPreviousApplications
      ? "Tu solicitud anterior ya se cerró. Podés mirar el catálogo y enviar una nueva cuando quieras."
      : "Tu perfil está listo. Mirá reglas, servicios y quiénes viven en cada residencia, y enviá tu solicitud sin costo.",
    primary: { label: "Buscar residencias", href: "/search" },
    secondary: null,
  };
}
