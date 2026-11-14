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
  /** Requisito real (docs/05): una menor sin familiar vinculado todavía no puede enviar solicitudes. */
  minorWithoutLink?: boolean;
}): NextStep {
  const { profilePercent, application, hadPreviousApplications, minorWithoutLink } = input;

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

  // Único requisito real previo a solicitar: la menor necesita un familiar vinculado.
  if (minorWithoutLink) {
    return {
      stage: 1,
      title: "Vinculá a tu padre, madre o tutor para pedir residencia",
      description:
        "Por ser menor de edad, necesitás un familiar vinculado para enviar solicitudes. Mientras tanto podés explorar y guardar residencias.",
      primary: { label: "Invitar a un familiar", href: "/students/dashboard#vinculacion" },
      secondary: { label: "Buscar residencias", href: "/search" },
    };
  }

  // El perfil es una recomendación, no un requisito: nunca frena la búsqueda ni la solicitud.
  const profileIncomplete = profilePercent < 100;
  return {
    stage: 2,
    title: hadPreviousApplications ? "Seguí buscando tu residencia" : "Elegí tu residencia",
    description: hadPreviousApplications
      ? "Tus solicitudes anteriores ya se cerraron. Podés mirar el catálogo y enviar una nueva cuando quieras."
      : "Mirá reglas, servicios y quiénes viven en cada residencia, y enviá tu solicitud sin costo.",
    ...(profileIncomplete
      ? {
          description: `${
            hadPreviousApplications
              ? "Tus solicitudes anteriores ya se cerraron. Podés buscar y enviar una nueva cuando quieras."
              : "Podés buscar y solicitar ya, sin costo."
          } Completar tu perfil es opcional: ayuda a que las residencias te conozcan mejor.`,
        }
      : {}),
    primary: { label: "Buscar residencias", href: "/search" },
    secondary: profileIncomplete ? { label: "Completar mi perfil", href: "/students/profile" } : null,
  };
}
