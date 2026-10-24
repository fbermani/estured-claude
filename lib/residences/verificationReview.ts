import { validateChangesMessage } from "@/lib/residences/changesRequest";

/**
 * Ciclo de vida de la verificación de residencias en el panel admin (Ciclo 70, DR7 en docs/00 §31).
 * Funciones puras: transiciones permitidas, validación de la decisión y helpers de la cola. Sin acceso a datos.
 */
export type ReviewAction = "schedule" | "approve" | "needs_changes" | "reject";

export const REVIEW_ACTIONS: readonly ReviewAction[] = ["schedule", "approve", "needs_changes", "reject"];

/** Estados de residencia que el admin tiene que revisar (la cola los muestra como "para revisar"). */
export const ACTIONABLE_STATUSES = ["pending_verification", "verification_scheduled", "verification_expired"] as const;

/** `needs_changes` espera a la residencia: está en la cola pero no cuenta como pendiente del admin. */
export const WAITING_STATUS = "needs_changes";

/** Todos los estados que aparecen en la cola de `/admin/verifications`. */
export const QUEUE_STATUSES = [...ACTIONABLE_STATUSES, WAITING_STATUS] as const;

/** Desde qué estados de residencia se permite cada acción (update condicional, sin pisar un estado ya resuelto). */
export const ALLOWED_FROM: Record<ReviewAction, readonly string[]> = {
  schedule: ACTIONABLE_STATUSES,
  approve: ACTIONABLE_STATUSES,
  needs_changes: ACTIONABLE_STATUSES,
  // Rechazar una residencia que está corrigiendo cambios es posible; las demás acciones esperan su reenvío.
  reject: QUEUE_STATUSES,
};

export const RESIDENCE_STATUS_AFTER: Record<ReviewAction, string> = {
  schedule: "verification_scheduled",
  approve: "verified_active",
  needs_changes: "needs_changes",
  reject: "suspended",
};

export const VERIFICATION_STATUS_AFTER: Record<ReviewAction, string> = {
  schedule: "visit_scheduled",
  approve: "approved",
  needs_changes: "needs_changes",
  reject: "rejected",
};

export const AUDIT_ACTION: Record<ReviewAction, string> = {
  schedule: "residence_verification_scheduled",
  approve: "residence_verification_approved",
  needs_changes: "residence_verification_needs_changes",
  reject: "residence_verification_rejected",
};

export function isReviewAction(value: unknown): value is ReviewAction {
  return typeof value === "string" && (REVIEW_ACTIONS as readonly string[]).includes(value);
}

export function canReviewFrom(action: ReviewAction, residenceStatus: string | null | undefined): boolean {
  return !!residenceStatus && ALLOWED_FROM[action].includes(residenceStatus);
}

export function isActionableStatus(status: string | null | undefined): boolean {
  return !!status && (QUEUE_STATUSES as readonly string[]).includes(status);
}

/** Vigencia de la verificación aprobada: un año (docs/04 §13.3). */
export const VERIFICATION_VALID_DAYS = 365;

// --- Fechas (solo día, hora de Buenos Aires) ---

/** "YYYY-MM-DD" de hoy en Buenos Aires (el servidor corre en UTC). */
export function argentinaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Devuelve el mismo string si es un día válido "YYYY-MM-DD"; si no, null. */
export function parseDateOnly(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return value;
}

/** Se guarda a las 12:00 UTC (09:00 en Buenos Aires): el día se ve igual en UTC y en hora local. */
export function dateOnlyToIso(day: string): string {
  return `${day}T12:00:00.000Z`;
}

// --- Validación de la decisión ---

export interface ReviewInput {
  action: ReviewAction;
  /** El botón de confirmación del paso de aprobar/rechazar manda `confirmed=1`. */
  confirmed: boolean;
  responsibleChecked: boolean;
  addressChecked: boolean;
  photosMatch: boolean;
  visitedAt: string;
  scheduledAt: string;
  notesInternal: string;
  changesMessage: string;
  today: string;
}

export interface ReviewParsed {
  visitedAtIso: string | null;
  scheduledAtIso: string | null;
  notesInternal: string;
  changesMessage: string | null;
}

export function validateReview(input: ReviewInput): { ok: true; value: ReviewParsed } | { ok: false; error: string } {
  const visitedDay = input.visitedAt.trim() ? parseDateOnly(input.visitedAt) : null;
  const scheduledDay = input.scheduledAt.trim() ? parseDateOnly(input.scheduledAt) : null;
  if (input.visitedAt.trim() && !visitedDay) return { ok: false, error: "La fecha de la visita no es válida." };
  if (input.scheduledAt.trim() && !scheduledDay) return { ok: false, error: "La fecha de la visita programada no es válida." };

  const notes = input.notesInternal.trim();
  let changesMessage: string | null = null;

  switch (input.action) {
    case "schedule":
      if (!scheduledDay) return { ok: false, error: "Elegí la fecha de la visita programada." };
      if (scheduledDay < input.today) {
        return { ok: false, error: "La fecha de la visita programada no puede ser anterior a hoy." };
      }
      break;
    case "approve":
      if (!input.confirmed) return { ok: false, error: "Confirmá la aprobación para continuar." };
      if (!visitedDay) {
        return { ok: false, error: "Cargá la fecha de la visita presencial: es obligatoria para aprobar." };
      }
      if (visitedDay > input.today) return { ok: false, error: "La fecha de la visita no puede ser futura." };
      if (!(input.responsibleChecked && input.addressChecked && input.photosMatch)) {
        return {
          ok: false,
          error:
            "Antes de aprobar, marcá al menos: identidad del responsable, dirección verificada y fotos coinciden con la realidad.",
        };
      }
      break;
    case "needs_changes": {
      const parsed = validateChangesMessage(input.changesMessage);
      if (!parsed.ok) return { ok: false, error: parsed.error };
      changesMessage = parsed.value;
      break;
    }
    case "reject":
      if (!input.confirmed) return { ok: false, error: "Confirmá el rechazo para continuar." };
      if (notes.length < 5) return { ok: false, error: "Escribí un motivo para que quede registrado." };
      if (visitedDay && visitedDay > input.today) return { ok: false, error: "La fecha de la visita no puede ser futura." };
      break;
  }

  return {
    ok: true,
    value: {
      visitedAtIso: visitedDay ? dateOnlyToIso(visitedDay) : null,
      scheduledAtIso: scheduledDay ? dateOnlyToIso(scheduledDay) : null,
      notesInternal: notes,
      changesMessage,
    },
  };
}

// --- Cola ---

export type QueueChipKey = "new" | "resubmitted" | "scheduled" | "expired" | "needs_changes";

/** Acciones de auditoría que marcan un reenvío o un pedido de cambios (DR5). */
export const REVIEW_EVENT_ACTIONS = ["residence_verification_needs_changes", "residence_profile_resubmitted"] as const;

/**
 * `true` si lo último que pasó con la residencia fue un reenvío del dueño (audit log más reciente primero).
 * Distingue "Reenviada" de "Nueva" en la cola (indicio de DR5).
 */
export function wasResubmitted(
  status: string,
  latestEventAction: string | null | undefined,
): boolean {
  return status === "pending_verification" && latestEventAction === "residence_profile_resubmitted";
}

export function queueChipKey(status: string, resubmitted: boolean): QueueChipKey {
  switch (status) {
    case "verification_scheduled":
      return "scheduled";
    case "verification_expired":
      return "expired";
    case "needs_changes":
      return "needs_changes";
    default:
      return resubmitted ? "resubmitted" : "new";
  }
}

export const QUEUE_CHIPS: Record<QueueChipKey, { label: string; tone: "amber" | "violet" | "rose" }> = {
  new: { label: "Nueva", tone: "amber" },
  resubmitted: { label: "Reenviada", tone: "violet" },
  scheduled: { label: "Visita programada", tone: "violet" },
  expired: { label: "Vencida", tone: "rose" },
  needs_changes: { label: "Cambios pedidos", tone: "rose" },
};

/** Cuántas de la cola esperan al admin y cuántas a la residencia. */
export function summarizeQueue(statuses: string[]): { toReview: number; waitingForResidence: number } {
  let toReview = 0;
  let waitingForResidence = 0;
  for (const s of statuses) {
    if (s === WAITING_STATUS) waitingForResidence += 1;
    else toReview += 1;
  }
  return { toReview, waitingForResidence };
}

/** Orden de la cola: lo que espera al admin primero (más viejas arriba), lo que espera a la residencia al final. */
export function sortQueue<T extends { status: string; created_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aw = a.status === WAITING_STATUS ? 1 : 0;
    const bw = b.status === WAITING_STATUS ? 1 : 0;
    if (aw !== bw) return aw - bw;
    return a.created_at.localeCompare(b.created_at);
  });
}

// --- Vencimiento ---

/** Ventana de aviso previo al vencimiento (docs/09 §7.5 lista 60/30/7 días; este ciclo solo implementa 30). */
export const EXPIRY_WARNING_DAYS = 30;

/** `true` si `expiresAt` cae entre ahora y `days` días (todavía no venció). */
export function expiresWithin(expiresAt: string | null | undefined, now: Date, days: number): boolean {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return false;
  return t > now.getTime() && t <= now.getTime() + days * 24 * 60 * 60 * 1000;
}
