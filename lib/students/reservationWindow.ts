/**
 * Ventana de reserva vigente del estudiante (Ciclo 58, decisión del dueño 2026-10-23).
 *
 * Regla: quien tiene una reserva confirmada o vigente NO puede crear solicitudes ni anotarse en listas de
 * espera para fechas que se SUPERPONGAN con el período de esa reserva/estadía; SÍ puede para fechas
 * POSTERIORES al fin de ese período. Se mantiene el máximo de 2 solicitudes activas. La renovación NO es una
 * solicitud nueva y no pasa por acá.
 *
 *   Período vigente = [start_date de la reserva, fin de contrato vigente)
 *   Fin de contrato vigente = el de `lib/students/contractEnd.ts` (estadía → renovación confirmada →
 *   start_date + duración). El fin es EXCLUSIVO: pedir con ingreso el mismo día del fin no se superpone.
 *
 * "Reserva vigente" = estados `LIVE_RESERVATION_STATUSES` (`reservationStatus.ts`) salvo que su estadía ya
 * haya terminado (`resident_stays.status = 'inactive'`). Reservas con varios períodos (raro) se funden en uno
 * solo: desde el ingreso más temprano hasta el fin más tardío (criterio conservador).
 *
 * EXCEPCIÓN (Ciclo 59, DR3 "Quiero cambiar"): con un aviso `open` del estudiante, la superposición con SU período
 * vigente se permite hacia OTRAS residencias (no hacia la actual); la solicitud/lista creada queda vinculada al aviso
 * (`stay_change_intent_id`) para poder cerrarla si el aviso se cancela. Ver `lib/stayChange/exception.ts`.
 *
 * Las fechas son date-only ("YYYY-MM-DD") y se operan como strings/UTC: nunca `new Date("YYYY-MM-DD")` +
 * horario local (correría el día en Argentina). Sin `server-only` a propósito: las funciones puras sirven
 * también a componentes cliente y tests; el loader recibe el cliente de Supabase por parámetro.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIVE_RESERVATION_STATUSES } from "@/lib/reservations/reservationStatus";
import { addMonthsIso, formatDateOnly } from "@/lib/students/contractEnd";
import { loadStudentContracts } from "@/lib/students/loadStudentContracts";
import { exceptionAppliesToResidence, findStayChangeException } from "@/lib/stayChange/exception";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export type ReservationWindow = {
  /** Ingreso de la reserva ("YYYY-MM-DD"). */
  startDate: string;
  /** Fin de contrato vigente, exclusivo ("YYYY-MM-DD"). */
  endDate: string;
};

/** Qué mostrar en el panel de solicitud de la ficha cuando el estudiante tiene una ventana vigente. */
export type ReservationWindowNotice = {
  /**
   * Primera fecha de ingreso permitida para solicitar (= fin del período). "YYYY-MM-DD". `null` con un aviso
   * "Quiero cambiar" abierto (DR3): puede pedir cualquier fecha, aunque se superponga.
   */
  minRequestStartDate: string | null;
  /** "Ya tenés una reserva hasta 20/01/2027. Podés solicitar para fechas posteriores." */
  message: string;
  /** Fin formateado "DD/MM/AAAA". */
  endDateLabel: string;
  /** `true` si rige la excepción DR3 hacia ESTA residencia (aviso `open` y esta no es la residencia actual). */
  stayChangeOpen: boolean;
};

/** Hoy en America/Argentina/Buenos_Aires como "YYYY-MM-DD" (el `now` se inyecta para testear). */
function todayArIso(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(now);
}

/**
 * ¿El período deseado [desiredStartDate, +durationMonths) se superpone con la ventana [startDate, endDate)?
 * Sin ventana → nunca. Fecha deseada inválida → `false` (otras validaciones la rechazan antes/después).
 * Duración inválida o < 1 se toma como 1 mes (mínimo posible de un pedido).
 */
export function overlapsReservationWindow(
  window: ReservationWindow | null,
  desiredStartDate: string,
  durationMonths: number | null | undefined,
): boolean {
  if (!window) return false;
  if (!DATE_ONLY.test(desiredStartDate)) return false;
  const months = durationMonths && durationMonths >= 1 ? Math.floor(durationMonths) : 1;
  const desiredEnd = addMonthsIso(desiredStartDate, months);
  // [a, b) y [c, d) se superponen sii a < d && c < b. "YYYY-MM-DD" ordena bien como string.
  return desiredStartDate < window.endDate && window.startDate < desiredEnd;
}

/** Primera fecha de ingreso desde la que puede solicitar (el fin del período, exclusivo). `null` sin ventana. */
export function minRequestStartDate(window: ReservationWindow | null): string | null {
  return window ? window.endDate : null;
}

/** Mensaje en voseo para errores de server actions y para el panel de la ficha. */
export function reservationWindowMessage(window: ReservationWindow, audience: "student" | "family" = "student"): string {
  if (audience === "family") {
    return `Este estudiante ya tiene una reserva hasta ${formatDateOnly(window.endDate)}. Podés proponer para fechas posteriores.`;
  }
  return `Ya tenés una reserva hasta ${formatDateOnly(window.endDate)}. Podés solicitar para fechas posteriores.`;
}

/**
 * Lo que consume el panel de la ficha: fecha mínima para solicitar + texto. `null` si no hay ventana vigente
 * (el panel se comporta como siempre).
 */
export function describeReservationWindow(
  window: ReservationWindow | null,
  options: { stayChangeOpen?: boolean } = {},
): ReservationWindowNotice | null {
  if (!window) return null;
  if (options.stayChangeOpen) {
    return {
      minRequestStartDate: null,
      message:
        "Estás buscando cambiar de residencia; tu residencia actual fue avisada. Podés solicitar para cualquier fecha, aunque se superponga con tu estadía.",
      endDateLabel: formatDateOnly(window.endDate),
      stayChangeOpen: true,
    };
  }
  return {
    minRequestStartDate: window.endDate,
    message: reservationWindowMessage(window),
    endDateLabel: formatDateOnly(window.endDate),
    stayChangeOpen: false,
  };
}

/**
 * Funde períodos en una sola ventana (ingreso más temprano → fin más tardío) y descarta los ya terminados
 * (fin <= hoy). `null` si no queda ninguno.
 */
export function mergeReservationPeriods(
  periods: ReservationWindow[],
  now: Date = new Date(),
): ReservationWindow | null {
  const today = todayArIso(now);
  const live = periods.filter((p) => DATE_ONLY.test(p.startDate) && DATE_ONLY.test(p.endDate) && p.endDate > today);
  if (live.length === 0) return null;
  return {
    startDate: live.reduce((min, p) => (p.startDate < min ? p.startDate : min), live[0].startDate),
    endDate: live.reduce((max, p) => (p.endDate > max ? p.endDate : max), live[0].endDate),
  };
}

export type LoadReservationWindowResult = {
  window: ReservationWindow | null;
  /** `true` si no se pudo leer (el llamador decide si falla cerrado, como las server actions). */
  failed: boolean;
};

/**
 * Carga la ventana vigente del estudiante. Funciona con el cliente admin (server actions) o con el del usuario
 * (RLS ya limita a lo propio; igual se filtra por `studentProfileId`). Nunca lanza.
 */
export async function loadReservationWindow(
  supabase: SupabaseClient,
  studentProfileId: string,
  now: Date = new Date(),
): Promise<LoadReservationWindowResult> {
  const { data: reservations, error } = await supabase
    .from("reservations")
    .select("id, start_date, initial_duration_months")
    .eq("student_profile_id", studentProfileId)
    .in("status", [...LIVE_RESERVATION_STATUSES]);
  if (error) {
    console.error("[reservationWindow] no se pudieron leer las reservas:", error);
    return { window: null, failed: true };
  }
  if (!reservations || reservations.length === 0) return { window: null, failed: false };

  const ids = reservations.map((r) => r.id as string);
  // Estadías ya terminadas (finalizadas antes de tiempo o por la residencia/admin): no bloquean.
  const { data: endedStays, error: staysError } = await supabase
    .from("resident_stays")
    .select("reservation_id")
    .in("reservation_id", ids)
    .eq("status", "inactive");
  if (staysError) {
    console.error("[reservationWindow] no se pudieron leer las estadías:", staysError);
    return { window: null, failed: true };
  }
  const ended = new Set((endedStays ?? []).map((s) => s.reservation_id as string));
  const active = reservations.filter((r) => !ended.has(r.id as string));
  if (active.length === 0) return { window: null, failed: false };

  const contracts = await loadStudentContracts(
    supabase,
    active.map((r) => ({
      id: r.id as string,
      start_date: r.start_date as string,
      initial_duration_months: Number(r.initial_duration_months),
      snapshotRateUsd: null,
    })),
    now,
  );
  const periods: ReservationWindow[] = active.map((r) => ({
    startDate: r.start_date as string,
    endDate: contracts.get(r.id as string)?.endDate ?? addMonthsIso(r.start_date as string, Number(r.initial_duration_months)),
  }));
  return { window: mergeReservationPeriods(periods, now), failed: false };
}

/** Variante para páginas que solo tienen el `user_id` (p. ej. la ficha pública). */
export async function loadReservationWindowForUser(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<LoadReservationWindowResult> {
  const { data: profile, error } = await supabase
    .from("student_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[reservationWindow] no se pudo leer el perfil:", error);
    return { window: null, failed: true };
  }
  if (!profile) return { window: null, failed: false };
  return loadReservationWindow(supabase, profile.id as string, now);
}

export type ReservationOverlapCheck =
  /** `stayChangeIntentId`: id del aviso "Quiero cambiar" si el pedido se permitió POR la excepción (se guarda en la solicitud/lista). */
  | { ok: true; stayChangeIntentId: string | null }
  | { ok: false; error: string };

/**
 * Guarda server-side para solicitudes, listas de espera y propuestas del familiar. Falla CERRADO si no pudo
 * leer las reservas (mejor pedir reintentar que dejar pasar una superposición). `desiredStartDate` null =
 * "lo antes posible" (lista de espera sin fecha): se evalúa desde hoy.
 */
export async function checkReservationWindowOverlap(
  supabase: SupabaseClient,
  params: {
    studentProfileId: string;
    desiredStartDate: string | null;
    durationMonths: number | null | undefined;
    /** Quién ve el mensaje: el estudiante ("Ya tenés…") o el familiar que propone ("Este estudiante ya tiene…"). */
    audience?: "student" | "family";
    /** Residencia a la que va el pedido: la excepción "Quiero cambiar" NO rige hacia la residencia actual. */
    residenceId: string;
  },
  now: Date = new Date(),
): Promise<ReservationOverlapCheck> {
  const { window, failed } = await loadReservationWindow(supabase, params.studentProfileId, now);
  if (failed) return { ok: false, error: "No pudimos verificar tus reservas vigentes. Intentá de nuevo en unos minutos." };
  // DR3 (decisión del dueño): con un aviso "Quiero cambiar" abierto, TODA solicitud/lista hacia otra residencia queda
  // vinculada al aviso (haya o no superposición): señal "en proceso de mudanza", preaviso de 48 h y cierre al cancelar.
  const { exception, failed: exceptionFailed } = await findStayChangeException(supabase, params.studentProfileId);
  if (!exceptionFailed && exceptionAppliesToResidence(exception, params.residenceId)) {
    return { ok: true, stayChangeIntentId: exception!.intentId };
  }
  if (!window) return { ok: true, stayChangeIntentId: null };
  const start = params.desiredStartDate && DATE_ONLY.test(params.desiredStartDate) ? params.desiredStartDate : todayArIso(now);
  if (!overlapsReservationWindow(window, start, params.durationMonths)) return { ok: true, stayChangeIntentId: null };
  if (exceptionFailed) return { ok: false, error: "No pudimos verificar tu aviso de cambio. Intentá de nuevo en unos minutos." };
  return { ok: false, error: reservationWindowMessage(window, params.audience) };
}
