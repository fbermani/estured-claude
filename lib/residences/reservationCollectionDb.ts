import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isPaymentMethodKey } from "@/lib/payments/paymentMethods";
import { methodDataState, type MethodDataState, type ReservationCollectionConfig } from "@/lib/residences/reservationCollection";

/**
 * Lecturas del «Cobro de la reserva» (DR63). `residence_collection_accounts` tiene RLS SIN policies a propósito: solo el service role la
 * lee, y los datos de cobro (`details`, `pending_details`) solo se leen para el DUEÑO de la residencia (`loadCollectionAccountsForOwner`)
 * o, sin salir del servidor, para saber si un medio tiene datos (`loadReservationCollectionConfig`, que devuelve solo claves).
 * Nunca `select("*")`: siempre columnas explícitas.
 */

/** Códigos de «columna o tabla inexistente»: la migración 0102 todavía no está aplicada en este entorno. */
const SCHEMA_MISSING_CODES = new Set(["42703", "42P01", "PGRST204", "PGRST205"]);
const isSchemaMissing = (error: { code?: string } | null): boolean => Boolean(error?.code && SCHEMA_MISSING_CODES.has(error.code));

const filled = (s: string | null | undefined): boolean => (s ?? "").trim().length > 0;

type AccountRow = {
  method_key: string;
  method_label: string | null;
  pending_method_label: string | null;
  details: string | null;
  pending_details: string | null;
  pending_submitted_at: string | null;
  approved_at: string | null;
};

const ACCOUNT_COLUMNS = "method_key, method_label, pending_method_label, details, pending_details, pending_submitted_at, approved_at";

type Raw = { modes: string[] | null; accepted: string[] | null; rows: AccountRow[] };

/** Lectura común (columnas explícitas). `missing` = la migración 0102 no está aplicada; `error` = fallo real de lectura. */
async function readRaw(admin: SupabaseClient, residenceId: string, tag: string): Promise<{ kind: "ok"; raw: Raw } | { kind: "missing" } | { kind: "error" }> {
  const residence = await admin
    .from("residences")
    .select("reservation_payment_modes, accepted_payment_methods")
    .eq("id", residenceId)
    .maybeSingle();
  if (isSchemaMissing(residence.error)) return { kind: "missing" };
  if (residence.error || !residence.data) {
    if (residence.error) console.error(`[reservation-collection] ${tag} residence read failed:`, residence.error.code, residence.error.message);
    return { kind: "error" };
  }
  const accounts = await admin.from("residence_collection_accounts").select(ACCOUNT_COLUMNS).eq("residence_id", residenceId);
  if (isSchemaMissing(accounts.error)) return { kind: "missing" };
  if (accounts.error) {
    console.error(`[reservation-collection] ${tag} accounts read failed:`, accounts.error.code, accounts.error.message);
    return { kind: "error" };
  }
  const row = residence.data as { reservation_payment_modes: string[] | null; accepted_payment_methods: string[] | null };
  return {
    kind: "ok",
    raw: {
      modes: row.reservation_payment_modes,
      accepted: row.accepted_payment_methods,
      rows: ((accounts.data ?? []) as AccountRow[]).filter((a) => isPaymentMethodKey(a.method_key)),
    },
  };
}

/** Estado de cada medio para la tarjeta de la configuración: solo claves y estados, ningún dato de cobro. */
export interface CollectionCardSummary {
  modes: string[] | null;
  acceptedMethods: string[] | null;
  states: Record<string, MethodDataState>;
}

export interface CollectionOverview {
  /** Para el requisito 10 de «Enviar para revisión». */
  config: ReservationCollectionConfig;
  /** Para la tarjeta de la configuración (la ven dueño y staff). */
  summary: CollectionCardSummary;
}

/**
 * Resumen SIN datos de cobro: opciones elegidas, medios aceptados, qué medios tienen datos cargados (aprobados o pendientes) y el estado
 * de cada uno. Devuelve solo CLAVES y estados: ningún dato de cobro sale de acá. `overview: null` = la migración 0102 no está aplicada
 * en este entorno (el requisito no se exige). `ok: false` = error real de lectura (no se puede afirmar nada).
 */
export async function loadCollectionOverview(
  admin: SupabaseClient,
  residenceId: string,
): Promise<{ ok: true; overview: CollectionOverview | null } | { ok: false }> {
  const read = await readRaw(admin, residenceId, "overview");
  if (read.kind === "missing") return { ok: true, overview: null };
  if (read.kind === "error") return { ok: false };
  const { modes, accepted, rows } = read.raw;
  const methodsWithData = rows
    .filter((a) => filled(a.details) || filled(a.pending_details))
    // «Otro» además necesita un nombre (aprobado o pendiente).
    .filter((a) => a.method_key !== "other" || filled(a.method_label) || filled(a.pending_method_label))
    .map((a) => a.method_key);
  const states: Record<string, MethodDataState> = {};
  for (const a of rows) {
    states[a.method_key] = methodDataState({ details: a.details, pendingDetails: a.pending_details, pendingMethodLabel: a.pending_method_label });
  }
  return {
    ok: true,
    overview: {
      config: { modes, acceptedMethods: accepted, methodsWithData },
      summary: { modes, acceptedMethods: accepted, states },
    },
  };
}

/** Solo el requisito 10 (el gate del envío): ver `loadCollectionOverview`. */
export async function loadReservationCollectionConfig(
  admin: SupabaseClient,
  residenceId: string,
): Promise<{ ok: true; config: ReservationCollectionConfig | null } | { ok: false }> {
  const res = await loadCollectionOverview(admin, residenceId);
  return res.ok ? { ok: true, config: res.overview?.config ?? null } : { ok: false };
}

/** Un medio con sus datos de cobro, tal como los ve el DUEÑO en su pantalla. NO usar fuera de la pantalla del dueño. */
export interface OwnerCollectionAccount {
  methodKey: string;
  state: MethodDataState;
  /** Nombre aprobado de «Otro». */
  methodLabel: string | null;
  pendingMethodLabel: string | null;
  /** Datos aprobados y vigentes. */
  details: string | null;
  /** Datos nuevos a la espera del admin. */
  pendingDetails: string | null;
  pendingSubmittedAt: string | null;
  /** Motivo del último rechazo del admin, si ese rechazo es lo último que pasó con el medio. Solo lo ve el dueño. */
  rejectedReason: string | null;
  rejectedAt: string | null;
}

export type OwnerCollectionLoad =
  | { ok: true; ready: true; modes: string[] | null; acceptedMethods: string[] | null; accounts: OwnerCollectionAccount[] }
  /** La migración 0102 no está aplicada en este entorno. */
  | { ok: true; ready: false }
  | { ok: false };

/**
 * Configuración completa del «Cobro de la reserva» PARA EL DUEÑO (incluye los datos de cobro). El que llama tiene que haber comprobado
 * antes que el usuario es el dueño de la residencia (`assertResidenceOwner`): esta función no valida permisos.
 */
export async function loadCollectionAccountsForOwner(admin: SupabaseClient, residenceId: string): Promise<OwnerCollectionLoad> {
  const read = await readRaw(admin, residenceId, "owner");
  if (read.kind === "missing") return { ok: true, ready: false };
  if (read.kind === "error") return { ok: false };
  // DR65 (c): sin aprobación del admin no hay rechazos que mostrar.
  const accounts: OwnerCollectionAccount[] = read.raw.rows.map((a) => ({
    methodKey: a.method_key,
    state: methodDataState({ details: a.details, pendingDetails: a.pending_details, pendingMethodLabel: a.pending_method_label }),
    methodLabel: a.method_label,
    pendingMethodLabel: a.pending_method_label,
    details: a.details,
    pendingDetails: a.pending_details,
    pendingSubmittedAt: a.pending_submitted_at,
    rejectedReason: null,
    rejectedAt: null,
  }));
  return { ok: true, ready: true, modes: read.raw.modes, acceptedMethods: read.raw.accepted, accounts };
}
