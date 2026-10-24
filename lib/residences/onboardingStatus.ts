import { MIN_PUBLISH_PHOTOS } from "@/lib/residences/photos";

/**
 * Onboarding de una residencia nueva (Ciclo 65). Funciones puras: arman el
 * contenido del banner de estado del Panel a partir de `residences.status`
 * y de datos ya existentes. No inventan plazos: la verificación presencial la
 * coordina el equipo de EstuRed y se avisa por mail y en la campana.
 */
export type OnboardingTone = "info" | "warning" | "danger" | "success";

export interface OnboardingBannerCopy {
  tone: OnboardingTone;
  icon: string;
  title: string;
  now: string;
  meanwhile: string;
}

/** `null` = sin banner (residencia verificada y publicada u otros estados operativos). */
export function getOnboardingBanner(status: string): OnboardingBannerCopy | null {
  switch (status) {
    case "draft":
      return {
        tone: "info",
        icon: "edit_note",
        title: "Tu residencia es un borrador",
        now: "Todavía no la ven los estudiantes. Completá el perfil y enviala para revisión cuando esté lista.",
        meanwhile: "Podés guardar cuando quieras y seguir después.",
      };
    case "pending_verification":
      return {
        tone: "info",
        icon: "hourglass_top",
        title: "Enviada, pendiente de verificación",
        now: "El equipo de EstuRed va a coordinar la verificación presencial antes de publicar tu residencia. Te avisamos por mail y en la campana.",
        meanwhile: "Mientras tanto podés seguir completando el perfil, cargar fotos y el reglamento. Todavía no recibís solicitudes de estudiantes.",
      };
    case "verification_scheduled":
      return {
        tone: "info",
        icon: "event_available",
        title: "Visita de verificación programada",
        now: "El equipo de EstuRed va a visitar la residencia para la verificación presencial. Después de la visita revisamos y publicamos.",
        meanwhile: "Dejá el perfil, las fotos y el reglamento al día para la visita.",
      };
    case "needs_changes":
      return {
        tone: "warning",
        icon: "edit_note",
        title: "El equipo de EstuRed te pidió cambios",
        now: "Hay información del perfil para corregir antes de poder publicar la residencia.",
        meanwhile: "Revisá el perfil y las fotos, guardá los cambios y escribinos por Soporte para avisarnos que está listo.",
      };
    case "suspended":
      return {
        tone: "danger",
        icon: "block",
        title: "La verificación no fue aprobada",
        now: "Tu residencia no está publicada. Para conocer el motivo y los pasos a seguir, escribinos por Soporte.",
        meanwhile: "Mientras tanto no recibís solicitudes de estudiantes.",
      };
    default:
      return null;
  }
}

export type ChecklistState = "done" | "todo" | "in_progress";

export interface ChecklistItem {
  key: "profile" | "photos" | "rules" | "visit";
  label: string;
  detail: string;
  state: ChecklistState;
  href: "profile" | null;
}

export interface ChecklistInput {
  /** Brechas del perfil (de `computeProfileStrength`). */
  profileGapsCount: number;
  photos: number;
  hasRules: boolean;
  /** residence_verifications.status (null si no hay fila). */
  verificationStatus: string | null;
  scheduledAt: string | null;
  /** Fecha ya formateada para mostrar (opcional). */
  scheduledAtLabel?: string | null;
}

export function buildOnboardingChecklist(input: ChecklistInput): ChecklistItem[] {
  const photos = Math.max(0, Math.floor(input.photos));
  const v = input.verificationStatus;
  const approved = v === "approved";
  const visited = approved || v === "under_review";
  const scheduled = v === "visit_scheduled" || (v === "visit_pending" && !!input.scheduledAt);

  let visit: ChecklistItem;
  if (approved) {
    visit = { key: "visit", label: "Verificación presencial", detail: "Realizada y aprobada.", state: "done", href: null };
  } else if (visited) {
    visit = { key: "visit", label: "Verificación presencial", detail: "Visita realizada; el equipo está revisando.", state: "in_progress", href: null };
  } else if (scheduled) {
    visit = {
      key: "visit",
      label: "Verificación presencial",
      detail: input.scheduledAtLabel ? `Visita programada: ${input.scheduledAtLabel}.` : "Visita programada.",
      state: "in_progress",
      href: null,
    };
  } else {
    visit = {
      key: "visit",
      label: "Verificación presencial",
      detail: "La coordina el equipo de EstuRed; te avisamos por mail y en la campana.",
      state: "todo",
      href: null,
    };
  }

  return [
    {
      key: "profile",
      label: "Perfil completo",
      detail: input.profileGapsCount === 0 ? "Todas las secciones están completas." : `Faltan ${input.profileGapsCount} ${input.profileGapsCount === 1 ? "sección" : "secciones"} por completar.`,
      state: input.profileGapsCount === 0 ? "done" : "todo",
      href: "profile",
    },
    {
      key: "photos",
      label: "Fotos de la residencia",
      detail: photos >= MIN_PUBLISH_PHOTOS ? `${photos} fotos cargadas.` : `${photos} de ${MIN_PUBLISH_PHOTOS} fotos mínimas para publicar.`,
      state: photos >= MIN_PUBLISH_PHOTOS ? "done" : photos > 0 ? "in_progress" : "todo",
      href: "profile",
    },
    {
      key: "rules",
      label: "Reglamento",
      detail: input.hasRules ? "Cargado." : "Cargá el resumen de reglas o el PDF del reglamento.",
      state: input.hasRules ? "done" : "todo",
      href: "profile",
    },
    visit,
  ];
}
