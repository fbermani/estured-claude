/**
 * Helpers PUROS de presentación del flujo "Quiero cambiar" (DR3, Ciclo 60). Sin Supabase ni `server-only`: sirven a
 * server components, client components y tests. Nada de reglas de negocio acá: solo cómo se cuenta lo que ya decidió
 * `lib/stayChange/status.ts` y `load.ts`.
 */
import type { StayChangeUiKey } from "@/lib/stayChange/status";

export type StepState = "done" | "current" | "pending";
export type StayChangeStep = { key: string; label: string; state: StepState };

/**
 * Los 4 pasos de la tarjeta de estado (SPEC §3.4). No dependen solo del color: la UI usa relleno (hecho), anillo
 * (actual) y vacío (pendiente) más el texto.
 */
export function buildStayChangeSteps(uiKey: StayChangeUiKey, hasResponse = false): StayChangeStep[] {
  const labels = {
    notice: "Avisaste a tu residencia",
    response: "Tu residencia responde",
    search: "Buscás y solicitás",
    confirm: "Confirmás tu nuevo lugar",
  };
  const make = (states: [StepState, StepState, StepState, StepState], responded = false): StayChangeStep[] => [
    { key: "notice", label: uiKey === "pending_family" ? "Tu familiar confirma el aviso" : labels.notice, state: states[0] },
    { key: "response", label: responded ? "Tu residencia respondió" : labels.response, state: states[1] },
    { key: "search", label: labels.search, state: states[2] },
    { key: "confirm", label: labels.confirm, state: states[3] },
  ];
  switch (uiKey) {
    case "pending_family":
      return make(["current", "pending", "pending", "pending"]);
    case "open_no_response":
      return make(["done", "current", "pending", "pending"]);
    case "open_expiring":
      return hasResponse ? make(["done", "done", "current", "pending"], true) : make(["done", "current", "pending", "pending"]);
    case "open_responded":
      return make(["done", "done", "current", "pending"], true);
    case "resolved":
      return make(["done", "done", "done", "done"], true);
    default:
      return make(["pending", "pending", "pending", "pending"]);
  }
}

const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "diciembre" para "2026-12-15". `null` si la fecha no es "YYYY-MM-DD". */
export function monthNameOf(dateOnly: string | null | undefined): string | null {
  const match = /^\d{4}-(\d{2})-\d{2}$/.exec(dateOnly ?? "");
  if (!match) return null;
  return MONTH_NAMES[Number(match[1]) - 1] ?? null;
}

/**
 * Pie de planificación de la residencia: "Si se van en las fechas estimadas, se libera 1 Individual desde diciembre y
 * 1 Doble desde marzo." Se arma SOLO de avisos abiertos con fecha estimada; no cambia la disponibilidad. `null` si no
 * hay nada que planificar.
 */
export function buildPlanningSummary(items: { roomTypeName: string | null; estimatedExitDate: string | null }[]): string | null {
  const groups = new Map<string, { count: number; typeName: string; month: string; date: string }>();
  for (const item of items) {
    const month = monthNameOf(item.estimatedExitDate);
    if (!month || !item.estimatedExitDate) continue;
    const typeName = item.roomTypeName ?? "plaza";
    const key = `${typeName}|${month}`;
    const current = groups.get(key);
    if (current) {
      current.count += 1;
      if (item.estimatedExitDate < current.date) current.date = item.estimatedExitDate;
    } else {
      groups.set(key, { count: 1, typeName, month, date: item.estimatedExitDate });
    }
  }
  const ordered = [...groups.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (ordered.length === 0) return null;
  const parts = ordered.map((g) => `${g.count === 1 ? `1 ${g.typeName}` : `${g.count} plazas ${g.typeName}`} desde ${g.month}`);
  const joined = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
  return `Si se van en las fechas estimadas, se libera${ordered.reduce((n, g) => n + g.count, 0) > 1 ? "n" : ""} ${joined}.`;
}

/** "hace 3 d" / "hoy" para una fecha ISO (timestamp). Pura: `now` se inyecta. */
export function timeAgoLabel(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 1) return "hoy";
  if (days === 1) return "ayer";
  if (days < 60) return `hace ${days} días`;
  return `hace ${Math.round(days / 30)} meses`;
}

export type ResponseBadgeKey = "unanswered" | "answered" | "answered_seen";

/** Estado de respuesta de la residencia para el `Badge` de la tabla (siempre ícono + texto). */
export function responseBadge(response: { seenByStudentAt: string | null } | null): { key: ResponseBadgeKey; label: string } {
  if (!response) return { key: "unanswered", label: "Sin responder" };
  return response.seenByStudentAt ? { key: "answered_seen", label: "Respondida · vista" } : { key: "answered", label: "Respondida" };
}

/** Fecha "YYYY-MM-DD" en America/Argentina/Buenos_Aires de un timestamp ISO (para no correr el día de noche). */
export function arDateOf(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso));
}

/** Día anterior a una fecha "YYYY-MM-DD" (sugerencia de fecha de salida cuando el residente ingresa a otra residencia). */
export function dayBefore(dateOnly: string): string {
  const d = new Date(`${dateOnly}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** "Lucía F.." → "Lucía F.": algunos perfiles guardan la inicial ya con punto y el nombre corto la repite. */
export function tidyShortName(name: string): string {
  return name.replace(/\.{2,}$/, ".");
}
