/**
 * Alertas del plazo de pago de la reserva (DR74) y textos del plazo nuevo de 24 h (DR73 (c)). Módulo PURO: etapas y textos aprobados
 * (docs/propuestas/TEXTOS_PESOS_Y_PAGO_2026-11-26.md §5). Sin montos ni datos de cobro.
 *
 * Supuesto reversible (docs/00 DR74): las etapas se ordenan por el tiempo que falta (36, 24, 12 y 6 h antes del vencimiento = las 12,
 * 24, 36 y 42 h de un plazo de 48). Si el cron se atrasa, sale solo la última que corresponda. La etapa enviada se guarda junto con el
 * plazo al que se refiere (`deadline_alert_for`): si el plazo cambia (se reinicia), la cuenta vuelve a empezar sin tocar a quien lo cambia.
 */

const HOUR_MS = 3_600_000;
const TZ = "America/Argentina/Buenos_Aires";

export const PAYMENT_ALERT_STAGES = [
  { hoursLeft: 36, title: "Tenés un pago pendiente" },
  { hoursLeft: 24, title: "Te queda la mitad del plazo" },
  { hoursLeft: 12, title: "Tu solicitud puede vencer pronto" },
  { hoursLeft: 6, title: "Último aviso para pagar la reserva" },
] as const;

/** Etapa del «Último aviso» (42 h): también se avisa a la residencia. */
export const LAST_ALERT_STAGE = PAYMENT_ALERT_STAGES.length;

/** DR73 (c): plazo nuevo al cerrar el caso de Soporte con el plazo vencido. */
export const NEW_WINDOW_HOURS = 24;
/** En el plazo nuevo ya pasaron las etapas de 36 y 24 h: el aviso del plazo nuevo las reemplaza. */
export const NEW_WINDOW_START_STAGE = 2;

/** Cuántas etapas ya corresponden (0 a 4). 0 si el plazo venció o no es válido. */
export function dueAlertStage(deadlineIso: string | null | undefined, now: Date): number {
  if (!deadlineIso) return 0;
  const deadline = new Date(deadlineIso).getTime();
  if (Number.isNaN(deadline)) return 0;
  const left = deadline - now.getTime();
  if (left <= 0) return 0;
  return PAYMENT_ALERT_STAGES.filter((s) => left <= s.hoursLeft * HOUR_MS).length;
}

/**
 * Etapa a enviar ahora, o `null`. La etapa guardada solo vale si se refiere a este mismo plazo; si el plazo cambió, cuenta desde cero.
 */
export function nextAlertStage(input: { deadlineIso: string | null; now: Date; sentStage: number | null; sentFor: string | null }): number | null {
  const due = dueAlertStage(input.deadlineIso, input.now);
  if (due === 0) return null;
  const sameDeadline = Boolean(input.sentFor && input.deadlineIso && new Date(input.sentFor).getTime() === new Date(input.deadlineIso).getTime());
  const sent = sameDeadline ? (input.sentStage ?? 0) : 0;
  return due > sent ? due : null;
}

/** «28/11» y «14:30», en hora de Buenos Aires. */
export function deadlineParts(deadlineIso: string): { fecha: string; hora: string } {
  const date = new Date(deadlineIso);
  const fecha = date.toLocaleDateString("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
  const hora = date.toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  return { fecha, hora };
}

/** Cierra la oración sin duplicar el punto de la inicial («Lucía F.»). */
const endSentence = (text: string) => (text.endsWith(".") ? text : `${text}.`);

export type AlertAudience =
  /** Estudiante mayor: paga él. */
  | "student"
  /** Familiar vinculado de un menor: paga él. */
  | "family"
  /** Estudiante menor: paga su familiar. */
  | "minor_student";

export type Copy = { title: string; body: string };

/** Texto de las cuatro alertas al estudiante / familiar. */
export function studentAlertCopy(input: { stage: number; audience: AlertAudience; residenceName: string; studentName: string; deadlineIso: string }): Copy {
  const stage = PAYMENT_ALERT_STAGES[Math.min(Math.max(input.stage, 1), LAST_ALERT_STAGE) - 1];
  const { fecha, hora } = deadlineParts(input.deadlineIso);
  const tail = `antes del ${fecha} a las ${hora}. Si no, la solicitud puede vencer.`;
  const support = "¿Tenés un problema? Escribí a Soporte antes de esa hora.";
  const body =
    input.audience === "minor_student"
      ? `Tu familiar vinculado tiene que pagar la reserva en ${input.residenceName} y avisarlo ${tail}`
      : input.audience === "family"
        ? `Pagá la reserva de ${input.studentName} en ${input.residenceName} y tocá «Ya pagué» ${tail} ${support}`
        : `Pagá la reserva en ${input.residenceName} y tocá «Ya pagué» ${tail} ${support}`;
  return { title: stage.title, body };
}

/** Aviso a la residencia con el «Último aviso» (42 h). */
export function residenceLastAlertCopy(input: { studentName: string; deadlineIso: string; isMinor: boolean }): Copy {
  const { fecha, hora } = deadlineParts(input.deadlineIso);
  const contact = input.isMinor ? "Podés escribirle al familiar vinculado para que pague." : "Podés escribirle para que pague.";
  return {
    title: "Una solicitud puede vencer",
    body: `${endSentence(`Todavía no se informó el pago de la reserva de ${input.studentName}`)} Vence el ${fecha} a las ${hora}. ${contact} Si ya recibiste el pago, marcá «Pago recibido».`,
  };
}

/** Plazo nuevo de 24 h: estudiante / familiar. */
export function newWindowStudentCopy(input: { audience: AlertAudience; residenceName: string; studentName: string; deadlineIso: string }): Copy {
  const { fecha, hora } = deadlineParts(input.deadlineIso);
  const title = "Tenés 24 horas más para pagar la reserva";
  if (input.audience === "minor_student") {
    return { title, body: `Tu familiar vinculado tiene que pagar la reserva en ${input.residenceName} y avisarlo antes del ${fecha} a las ${hora}.` };
  }
  const pay = input.audience === "family" ? `Pagá la reserva de ${input.studentName} en ${input.residenceName}` : `Pagá en ${input.residenceName}`;
  return { title, body: `Se cerró el caso de Soporte. ${pay} y tocá «Ya pagué» antes del ${fecha} a las ${hora}. Si no, la solicitud puede vencer.` };
}

/** Plazo nuevo de 24 h: residencia. */
export function newWindowResidenceCopy(input: { studentName: string; deadlineIso: string }): Copy {
  const { fecha, hora } = deadlineParts(input.deadlineIso);
  return {
    title: "Plazo nuevo para una solicitud",
    body: `${endSentence(`Se cerró el caso de Soporte sobre el pago de ${input.studentName}`)} Si ya lo recibiste, marcá «Pago recibido» antes del ${fecha} a las ${hora}. Si no, la solicitud puede vencer.`,
  };
}

/**
 * DR73 (c): ¿corresponde el plazo nuevo al cerrar el caso? Solo si la solicitud sigue esperando el pago, el plazo ya venció y nada más lo
 * frena («Ya pagué» o un problema de pago abierto; supuesto reversible). «Pago recibido» saca la solicitud de `residence_payment_pending`.
 */
export function shouldOpenNewWindow(input: { applicationStatus: string; deadlineIso: string | null; now: Date; heldByPayment: boolean }): boolean {
  if (input.applicationStatus !== "residence_payment_pending" || input.heldByPayment) return false;
  if (!input.deadlineIso) return false;
  const deadline = new Date(input.deadlineIso).getTime();
  return !Number.isNaN(deadline) && deadline <= input.now.getTime();
}
