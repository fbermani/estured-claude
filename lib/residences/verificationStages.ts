/**
 * Etapas visibles del alta de una residencia (Panel). Función pura: traduce
 * `residences.status` a cuatro etapas (Configuración, En verificación,
 * Verificada, Publicada). No agrega estados nuevos: la verificación y la
 * publicación ocurren juntas (`verified_active` = «verificada y publicada»,
 * docs/04 §13). No promete plazos ni disponibilidad.
 * Estados fuera del recorrido (`suspended`, `paused_*`, `archived`) devuelven `null`.
 */
export type StageKey = "setup" | "verifying" | "verified" | "published";
export type StageState = "done" | "current" | "upcoming";
export type ChipTone = "info" | "warning" | "success";

export interface VerificationStage {
  key: StageKey;
  /** Número visible (1 a 4). */
  position: number;
  label: string;
  state: StageState;
  /** Texto del estado para lectores de pantalla y para quien no distingue colores. */
  stateLabel: string;
}

export interface VerificationProgress {
  stages: VerificationStage[];
  /** Etapa actual (1 a 4). En `verified_active` es 4: la residencia completó el recorrido. */
  currentPosition: number;
  /** «Etapa 2 de 4: En verificación». */
  currentLine: string;
  /** Estado principal de la residencia, visible junto al nombre. */
  chip: { label: string; tone: ChipTone };
  /** Qué pasa ahora, en una frase. */
  now: string;
  /** Qué sigue, en una frase. */
  next: string;
  /** Aviso destacado cuando el recorrido volvió a la etapa 1 (cambios pedidos o verificación vencida). */
  alert: string | null;
  /** `true` si la residencia ya completó el recorrido. */
  complete: boolean;
}

const LABELS: Record<StageKey, string> = {
  setup: "Configuración",
  verifying: "En verificación",
  verified: "Verificada",
  published: "Publicada",
};

const ORDER: StageKey[] = ["setup", "verifying", "verified", "published"];

const STATE_LABEL: Record<StageState, string> = {
  done: "Completada",
  current: "Etapa actual",
  upcoming: "Pendiente",
};

function build(currentPosition: number, complete: boolean): VerificationStage[] {
  return ORDER.map((key, index) => {
    const position = index + 1;
    const state: StageState = complete || position < currentPosition ? "done" : position === currentPosition ? "current" : "upcoming";
    return { key, position, label: LABELS[key], state, stateLabel: STATE_LABEL[state] };
  });
}

export function getVerificationProgress(status: string): VerificationProgress | null {
  switch (status) {
    case "draft":
      return {
        stages: build(1, false),
        currentPosition: 1,
        currentLine: `Etapa 1 de 4: ${LABELS.setup}`,
        chip: { label: "En configuración", tone: "info" },
        now: "Completá el perfil, las fotos y el reglamento. Después enviá la residencia a revisión.",
        next: "Cuando la enviás, Soporte coordina la verificación en persona.",
        alert: null,
        complete: false,
      };
    case "needs_changes":
      return {
        stages: build(1, false),
        currentPosition: 1,
        currentLine: `Etapa 1 de 4: ${LABELS.setup}`,
        chip: { label: "Cambios por corregir", tone: "warning" },
        now: "Corregí lo que pidió Soporte y reenviá la residencia a revisión.",
        next: "Cuando reenviás, Soporte retoma la verificación en persona.",
        alert: "Hay cambios para corregir",
        complete: false,
      };
    case "verification_expired":
      return {
        stages: build(1, false),
        currentPosition: 1,
        currentLine: `Etapa 1 de 4: ${LABELS.setup}`,
        chip: { label: "Verificación vencida", tone: "warning" },
        now: "Revisá que el perfil esté al día y reenviá la residencia para revisión.",
        next: "Soporte coordina una nueva visita en persona.",
        alert: "La verificación anual venció",
        complete: false,
      };
    case "pending_verification":
      return {
        stages: build(2, false),
        currentPosition: 2,
        currentLine: `Etapa 2 de 4: ${LABELS.verifying}`,
        chip: { label: "En proceso de verificación", tone: "info" },
        now: "Soporte revisa tu ficha y coordina la visita en persona.",
        next: "Después de la visita, si todo está en orden, la residencia queda verificada y publicada.",
        alert: null,
        complete: false,
      };
    case "verification_scheduled":
      return {
        stages: build(2, false),
        currentPosition: 2,
        currentLine: `Etapa 2 de 4: ${LABELS.verifying}`,
        chip: { label: "En proceso de verificación", tone: "info" },
        now: "Soporte programó la visita en persona a tu residencia.",
        next: "Después de la visita, Soporte revisa y, si todo está en orden, la residencia queda verificada y publicada.",
        alert: null,
        complete: false,
      };
    case "verified_active":
      return {
        stages: build(4, true),
        currentPosition: 4,
        currentLine: `Etapa 4 de 4: ${LABELS.published}`,
        chip: { label: "Verificada y publicada", tone: "success" },
        now: "Tu residencia está verificada y los estudiantes ya pueden verla.",
        next: "La verificación se renueva cada año.",
        alert: null,
        complete: true,
      };
    default:
      return null;
  }
}
