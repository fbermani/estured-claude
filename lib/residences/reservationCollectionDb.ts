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

/** Acciones de auditoría que mueven el estado de un medio (guardado del dueño, aprobación y rechazo del admin). */
export const COLLECTION_AUDIT_ACTIONS = {
  pending: "residence_collection_account_pending",
  approved: "residence_collection_account_approved",
  rejected: "residence_collection_account_rejected",
} as const;

/**
 * Último rechazo vigente por medio, leído del historial de auditoría (sin columna propia: la 0102 no guarda el motivo). Un rechazo
 * «rige» solo si es lo ÚLTIMO que pasó con ese medio (después el dueño pudo volver a enviar o el admin aprobar). Nunca lanza: si la
 * lectura falla, no hay rechazos que mostrar.
 */
export async function loadLatestRejections(admin: SupabaseClient, residenceId: string): Promise<Map<string, { reason: string; at: string }>> {
  const out = new Map<string, { reason: string; at: string }>();
  const { data, error } = await admin
    .from("audit_logs")
    .select("action, reason_text, created_at, new_value")
    .eq("entity_type", "residences")
    .eq("entity_id", residenceId)
    .in("action", [COLLECTION_AUDIT_ACTIONS.pending, COLLECTION_AUDIT_ACTIONS.approved, COLLECTION_AUDIT_ACTIONS.rejected])
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[reservation-collection] audit read failed:", error.code, error.message);
    return out;
  }
  const seen = new Set<string>();
  for (const row of (data ?? []) as { action: string; reason_text: string | null; created_at: string; new_value: unknown }[]) {
    const key = (row.new_value as { method_key?: unknown } | null)?.method_key;
    if (typeof key !== "string" || seen.has(key)) continue;
    seen.add(key);
    if (row.action === COLLECTION_AUDIT_ACTIONS.rejected) out.set(key, { reason: (row.reason_text ?? "").trim(), at: row.created_at });
  }
  return out;
}

/**
 * Configuración completa del «Cobro de la reserva» PARA EL DUEÑO (incluye los datos de cobro). El que llama tiene que haber comprobado
 * antes que el usuario es el dueño de la residencia (`assertResidenceOwner`): esta función no valida permisos.
 */
export async function loadCollectionAccountsForOwner(admin: SupabaseClient, residenceId: string): Promise<OwnerCollectionLoad> {
  const read = await readRaw(admin, residenceId, "owner");
  if (read.kind === "missing") return { ok: true, ready: false };
  if (read.kind === "error") return { ok: false };
  const rejections = await loadLatestRejections(admin, residenceId);
  const accounts: OwnerCollectionAccount[] = read.raw.rows.map((a) => {
      const rejection = rejections.get(a.method_key) ?? null;
      return {
        methodKey: a.method_key,
        state: methodDataState(
          { details: a.details, pendingDetails: a.pending_details, pendingMethodLabel: a.pending_method_label },
          { rejected: rejection !== null },
        ),
        methodLabel: a.method_label,
        pendingMethodLabel: a.pending_method_label,
        details: a.details,
        pendingDetails: a.pending_details,
        pendingSubmittedAt: a.pending_submitted_at,
        rejectedReason: rejection && rejection.reason !== "" ? rejection.reason : null,
        rejectedAt: rejection?.at ?? null,
      };
  });
  // Un medio rechazado que nunca tuvo datos aprobados no conserva fila (el admin la borra al rechazar): igual se muestra como «Rechazado».
  const withRow = new Set(accounts.map((a) => a.methodKey));
  for (const [key, rejection] of rejections) {
    if (withRow.has(key) || !isPaymentMethodKey(key)) continue;
    accounts.push({
      methodKey: key,
      state: "rejected",
      methodLabel: null,
      pendingMethodLabel: null,
      details: null,
      pendingDetails: null,
      pendingSubmittedAt: null,
      rejectedReason: rejection.reason !== "" ? rejection.reason : null,
      rejectedAt: rejection.at,
    });
  }
  return { ok: true, ready: true, modes: read.raw.modes, acceptedMethods: read.raw.accepted, accounts };
}
