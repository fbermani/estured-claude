import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCollectionChoiceContext, type CollectionChoiceContext } from "@/lib/applications/reservationCollectionChoice";

/**
 * Lecturas del servidor para elegir cómo cobrar la reserva de una solicitud (DR63 (d)). Usa service role: `residence_collection_accounts`
 * tiene RLS SIN policies (dato sensible). Los datos de cobro APROBADOS (`details`) se leen SOLO acá y SOLO para congelarlos en el servidor
 * (`instructions_snapshot`); nunca se devuelven a la pantalla. Nunca `select("*")`.
 *
 * Degrada sin la migración 0102: devuelve `missing` y el que llama sigue con el comportamiento anterior a DR63 (contacto directo).
 */

const SCHEMA_MISSING_CODES = new Set(["42703", "42P01", "PGRST204", "PGRST205"]);
const isSchemaMissing = (error: { code?: string } | null): boolean => Boolean(error?.code && SCHEMA_MISSING_CODES.has(error.code));
const filled = (s: string | null | undefined): boolean => (s ?? "").trim().length > 0;

/** Datos de cobro APROBADOS por medio. Solo para congelar en el servidor. */
export type ApprovedAccountData = Map<string, { methodLabel: string | null; details: string }>;

export type CollectionChoiceLoad =
  | { kind: "ok"; ctx: CollectionChoiceContext; accounts: ApprovedAccountData }
  /** La migración 0102 no está aplicada en este entorno. */
  | { kind: "missing" }
  | { kind: "error" };

export async function loadCollectionChoice(admin: SupabaseClient, residenceId: string, preferred?: string | null): Promise<CollectionChoiceLoad> {
  const residence = await admin
    .from("residences")
    .select("reservation_payment_modes, accepted_payment_methods")
    .eq("id", residenceId)
    .maybeSingle();
  if (isSchemaMissing(residence.error)) return { kind: "missing" };
  if (residence.error || !residence.data) {
    if (residence.error) console.error("[collection-choice] residence read failed:", residence.error.code, residence.error.message);
    return { kind: "error" };
  }
  const row = residence.data as { reservation_payment_modes: string[] | null; accepted_payment_methods: string[] | null };

  const accounts: ApprovedAccountData = new Map();
  // Sin «Cobro con medios habilitados» no hace falta leer las cuentas.
  if ((row.reservation_payment_modes ?? []).includes("enabled_methods")) {
    const read = await admin.from("residence_collection_accounts").select("method_key, method_label, details").eq("residence_id", residenceId);
    if (isSchemaMissing(read.error)) return { kind: "missing" };
    if (read.error) {
      console.error("[collection-choice] accounts read failed:", read.error.code, read.error.message);
      return { kind: "error" };
    }
    for (const a of (read.data ?? []) as { method_key: string; method_label: string | null; details: string | null }[]) {
      if (filled(a.details)) accounts.set(a.method_key, { methodLabel: a.method_label, details: (a.details as string).trim() });
    }
  }

  const ctx = buildCollectionChoiceContext({
    modes: row.reservation_payment_modes,
    acceptedMethods: row.accepted_payment_methods,
    approved: [...accounts.entries()].map(([methodKey, a]) => ({ methodKey, methodLabel: a.methodLabel })),
    preferred,
  });
  return { kind: "ok", ctx, accounts };
}

/** Columnas de DR63 de la solicitud. `schemaReady: false` = la migración 0102 no está aplicada. */
export type ApplicationCollectionColumns = { schemaReady: boolean; preferred: string | null; collectionMode: string | null };

export async function readApplicationCollectionColumns(admin: SupabaseClient, applicationId: string): Promise<ApplicationCollectionColumns | null> {
  const { data, error } = await admin
    .from("application_requests")
    .select("preferred_payment_method, collection_mode")
    .eq("id", applicationId)
    .maybeSingle();
  if (isSchemaMissing(error)) return { schemaReady: false, preferred: null, collectionMode: null };
  if (error) {
    console.error("[collection-choice] application columns read failed:", error.code, error.message);
    return null;
  }
  const r = (data ?? {}) as { preferred_payment_method?: string | null; collection_mode?: string | null };
  return { schemaReady: true, preferred: r.preferred_payment_method ?? null, collectionMode: r.collection_mode ?? null };
}
