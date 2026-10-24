/**
 * Plantillas de respuesta de la residencia al aviso "Quiero cambiar" (DR3, Ciclo 59; SPEC §5.2).
 *
 * Funciones PURAS. Las plantillas completan los 4 campos de la respuesta (mensaje, costos, condiciones, detalles)
 * con datos reales de la estadía; la residencia las revisa y edita antes de enviar. Son INFORMATIVAS: nunca prometen
 * disponibilidad ni garantías, no hablan de "mediación" y no inventan reglas de negocio (por eso no mencionan
 * prorrateo ni horarios: solo lo que la residencia cargó en su perfil o un texto neutro que ella ajusta).
 *
 * Si la residencia definió su política de salida anticipada en el perfil (`residences.early_exit_*_text`), esa política
 * precarga costos y condiciones (decisión del dueño): "la residencia puede ajustarla para ese caso".
 */
import { addMonthsIso } from "@/lib/students/contractEnd";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";

export const STAY_CHANGE_TEMPLATE_KEYS = ["min", "none", "notice", "listen"] as const;
export type StayChangeTemplateKey = (typeof STAY_CHANGE_TEMPLATE_KEYS)[number];

export const STAY_CHANGE_TEMPLATE_LABELS: Record<StayChangeTemplateKey, string> = {
  min: "Estadía mínima no cumplida",
  none: "Sin costos de salida",
  notice: "Preaviso y entrega",
  listen: "Queremos escucharte",
};

export type StayChangeTemplateContext = {
  studentFirstName: string;
  /** Fecha estimada de salida que informó el estudiante ("YYYY-MM-DD"), si la hay. */
  estimatedExitDate: string | null;
  /** Ingreso de la estadía ("YYYY-MM-DD"), si se conoce. */
  stayStartDate: string | null;
  /** Estadía mínima de la residencia en meses, si la definió. */
  minimumStayMonths: number | null;
  /** Depósito de la reserva (snapshot), en USD, si lo hay. */
  depositUsd: number | null;
  /** Política de salida anticipada del perfil de la residencia (texto libre), si la cargó. */
  policy: { depositClausesText?: string | null; costsText: string | null; conditionsText: string | null } | null;
  /** Días de preaviso que mencionan las plantillas (default 30). */
  noticeDays?: number;
};

export type StayChangeTemplateFields = {
  message: string;
  exitCostsText: string;
  exitCostsUsd: number | null;
  exitConditionsText: string;
  exitDetailsText: string;
};

/** Fecha en la que se cumple la estadía mínima, o `null` si falta algún dato. */
export function minimumStayFulfilledOn(ctx: Pick<StayChangeTemplateContext, "stayStartDate" | "minimumStayMonths">): string | null {
  if (!ctx.stayStartDate || !ctx.minimumStayMonths || ctx.minimumStayMonths < 1) return null;
  return addMonthsIso(ctx.stayStartDate, ctx.minimumStayMonths);
}

/**
 * Plantilla que se preselecciona: "Estadía mínima no cumplida" SOLO si la salida estimada es anterior al
 * cumplimiento de la estadía mínima. En cualquier otro caso, ninguna (la residencia elige).
 */
export function suggestTemplate(ctx: StayChangeTemplateContext): StayChangeTemplateKey | null {
  const fulfilled = minimumStayFulfilledOn(ctx);
  if (fulfilled && ctx.estimatedExitDate && ctx.estimatedExitDate < fulfilled) return "min";
  return null;
}

export function buildTemplate(key: StayChangeTemplateKey, ctx: StayChangeTemplateContext): StayChangeTemplateFields {
  const name = ctx.studentFirstName.trim() || "";
  const hello = name ? `Hola ${name}` : "Hola";
  const days = ctx.noticeDays ?? 30;
  const fulfilled = minimumStayFulfilledOn(ctx);
  const noticeSentence = `Preaviso de ${days} días con la fecha exacta de salida.`;
  const handover = "Coordinamos la entrega de la habitación con administración.";

  switch (key) {
    case "min": {
      const generatedCosts = fulfilled
        ? ctx.depositUsd
          ? `Si salís antes del ${formatDateOnly(fulfilled)} (estadía mínima de ${ctx.minimumStayMonths} meses), el depósito no se devuelve.`
          : `Si salís antes del ${formatDateOnly(fulfilled)} (estadía mínima de ${ctx.minimumStayMonths} meses), aplican las condiciones que acordaron al reservar.`
        : "Si salís antes de cumplir la estadía mínima, aplican las condiciones que acordaron al reservar.";
      return {
        message: `${hello}, gracias por avisarnos con tiempo. Te contamos cómo sería tu salida para que lo tengas en cuenta al decidir.`,
        exitCostsText: ctx.policy?.costsText ?? generatedCosts,
        exitCostsUsd: ctx.depositUsd ?? null,
        exitConditionsText: ctx.policy?.conditionsText ?? noticeSentence,
        exitDetailsText: handover,
      };
    }
    case "none":
      return {
        message: `${hello}, gracias por avisarnos. Te contamos cómo sería tu salida.`,
        exitCostsText: "No hay costos de salida anticipada.",
        exitCostsUsd: null,
        exitConditionsText: "Avisanos la fecha exacta de salida para que podamos organizar la plaza.",
        exitDetailsText: handover,
      };
    case "notice":
      return {
        message: `${hello}, gracias por avisarnos con tiempo. Para organizar tu salida necesitamos lo siguiente.`,
        exitCostsText: ctx.policy?.costsText ?? "",
        exitCostsUsd: null,
        exitConditionsText: ctx.policy?.conditionsText ?? noticeSentence,
        exitDetailsText: ctx.estimatedExitDate
          ? `Salida prevista: ${formatDateOnly(ctx.estimatedExitDate)}. Entrega de llaves y revisión de inventario con administración.`
          : "Entrega de llaves y revisión de inventario con administración.",
      };
    case "listen":
      return {
        message: `${hello}, gracias por avisarnos con tiempo. Si hay algo que podamos mejorar o un cambio de habitación que te sirva, contanos y lo vemos.`,
        exitCostsText: "",
        exitCostsUsd: null,
        exitConditionsText: "",
        exitDetailsText: "",
      };
  }
}

/**
 * Precarga inicial de la hoja "Responder" cuando la residencia todavía no respondió: si definió una política de
 * salida en su perfil, costos y condiciones salen de ahí; si no, campos vacíos (o la plantilla sugerida).
 */
export function buildInitialResponse(ctx: StayChangeTemplateContext): StayChangeTemplateFields & { suggestedTemplate: StayChangeTemplateKey | null } {
  const suggestedTemplate = suggestTemplate(ctx);
  if (suggestedTemplate) return { ...buildTemplate(suggestedTemplate, ctx), suggestedTemplate };
  return {
    message: "",
    exitCostsText: ctx.policy?.costsText ?? "",
    exitCostsUsd: null,
    exitConditionsText: ctx.policy?.conditionsText ?? "",
    exitDetailsText: "",
    suggestedTemplate: null,
  };
}

/** Aviso suave opcional (SPEC §5.2): el texto suena a promesa o a "mediación". Solo informa, no bloquea. */
export function hasPromissoryLanguage(text: string): boolean {
  return /garantiz|asegur|mediaci[oó]n|seguro hay lugar/i.test(text);
}
