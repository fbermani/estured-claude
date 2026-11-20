/**
 * Panel «Completá tu ficha» que aparece tras guardar o enviar la configuración: empuja a completar el reglamento, las preguntas
 * frecuentes y a compartir la ficha. Lógica pura: arma las filas con su estado real a partir de datos que la pantalla ya tiene.
 *
 * Criterios (supuestos reversibles, no cambian reglas de negocio):
 * - Reglamento: hecho si la residencia publicó un reglamento propio (`hasOwnRegulation`, el mismo dato que usa el enlace a `/regulation`).
 *   Ojo: el checklist del Panel (`onboardingStatus`, paso «Reglamento») mide otra cosa: que haya resumen de reglas o PDF cargado.
 * - Preguntas: hecho si las esenciales están todas listas (mismo umbral que el paso «Preguntas esenciales» del checklist del Panel).
 *   Sin catálogo disponible, la fila no se muestra.
 * - Compartir: no es algo que se «complete»: con la ficha publicada está disponible; sin publicar se activa cuando se publique. Nunca
 *   cuenta como pendiente ni promete fechas ni disponibilidad.
 * - El panel se ve solo si falta algo (reglamento o preguntas).
 */
export type CompletionKey = "regulation" | "faq" | "share";
/** `done` hecho · `todo` pendiente · `ready` disponible para usar · `locked` se activa al publicar. */
export type CompletionState = "done" | "todo" | "ready" | "locked";

export type CompletionRow = {
  key: CompletionKey;
  label: string;
  state: CompletionState;
  /** Estado real en una frase corta. */
  detail: string;
  /** Por qué conviene, en una línea. */
  reason: string;
  /** Pantalla a la que lleva (`/residence/<id>/<href>`); `null` si todavía no hay nada que hacer. */
  href: CompletionKey | null;
  /** Texto del enlace; `null` si la fila no lleva enlace. */
  cta: string | null;
};

export type CompletionInput = {
  hasOwnRegulation: boolean;
  /** `null` = el catálogo de preguntas no está disponible. */
  faq: { essentialReady: number; essentialTotal: number } | null;
  /** La ficha ya está publicada (`residences.status = verified_active`). */
  published: boolean;
};

export type CompletionPanel = { rows: CompletionRow[]; pendingCount: number; show: boolean };

export function buildCompletionPanel(input: CompletionInput): CompletionPanel {
  const rows: CompletionRow[] = [];

  rows.push(
    input.hasOwnRegulation
      ? { key: "regulation", label: "Reglamento", state: "done", detail: "Publicado.", reason: "Un reglamento prolijo evita preguntas repetidas antes de reservar.", href: null, cta: null }
      : {
          key: "regulation",
          label: "Reglamento",
          state: "todo",
          detail: "Todavía usás el modelo base.",
          reason: "Un reglamento prolijo evita preguntas repetidas antes de reservar.",
          href: "regulation",
          cta: "Completar ahora",
        },
  );

  if (input.faq) {
    const ready = input.faq.essentialReady >= input.faq.essentialTotal;
    rows.push({
      key: "faq",
      label: "Preguntas frecuentes",
      state: ready ? "done" : "todo",
      detail: ready ? "Las esenciales están listas." : `${input.faq.essentialReady} de ${input.faq.essentialTotal} esenciales listas.`,
      reason: "Con las respuestas claras en tu ficha, los estudiantes las leen antes de escribirte.",
      href: ready ? null : "faq",
      cta: ready ? null : "Completar ahora",
    });
  }

  rows.push(
    input.published
      ? {
          key: "share",
          label: "Compartir ficha",
          state: "ready",
          detail: "Tu ficha ya tiene link para compartir.",
          reason: "Mandala por WhatsApp con un mensaje listo.",
          href: "share",
          cta: "Compartir ahora",
        }
      : {
          key: "share",
          label: "Compartir ficha",
          state: "locked",
          detail: "Se activa cuando tu residencia se publique.",
          reason: "Después vas a poder mandar tu ficha por WhatsApp con un mensaje listo.",
          href: null,
          cta: null,
        },
  );

  const pendingCount = rows.filter((r) => r.state === "todo").length;
  return { rows, pendingCount, show: pendingCount > 0 };
}
