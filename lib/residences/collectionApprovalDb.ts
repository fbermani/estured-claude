import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isPaymentMethodKey, paymentMethodLabel } from "@/lib/payments/paymentMethods";

/**
 * Lecturas de la cola «Cobros de reserva» del admin (DR63 fase 2b). SOLO para páginas que ya pasaron por `requireAdmin()`: el detalle trae
 * los datos de cobro completos (propuestos y vigentes), que ven el admin, el superadmin y el dueño, nadie más. Columnas explícitas,
 * nunca `select("*")`. `ready: false` = la migración 0102 no está aplicada en este entorno.
 */

const SCHEMA_MISSING_CODES = new Set(["42703", "42P01", "PGRST204", "PGRST205"]);
const isSchemaMissing = (error: { code?: string } | null): boolean => Boolean(error?.code && SCHEMA_MISSING_CODES.has(error.code));

/** Filtro del índice parcial `residence_collection_accounts_pending_idx`: hay datos o nombre a la espera del admin. */
const PENDING_FILTER = "pending_details.not.is.null,pending_method_label.not.is.null";

export interface CollectionQueueRow {
  residenceId: string;
  name: string;
  publicArea: string | null;
  status: string;
  /** Cantidad de medios con cambios pendientes. */
  pendingCount: number;
  /** Fecha más vieja entre los pendientes (ISO). */
  oldestSubmittedAt: string;
}

/** Agrupa filas pendientes por residencia y ordena por la espera más larga primero. Función pura. */
export function groupPendingByResidence(
  rows: readonly { residence_id: string; pending_submitted_at: string | null }[],
  residences: ReadonlyMap<string, { name: string; public_area: string | null; status: string }>,
): CollectionQueueRow[] {
  const groups = new Map<string, { count: number; oldest: string }>();
  for (const r of rows) {
    const at = r.pending_submitted_at ?? "";
    const g = groups.get(r.residence_id);
    if (!g) groups.set(r.residence_id, { count: 1, oldest: at });
    else {
      g.count += 1;
      if (at !== "" && (g.oldest === "" || at < g.oldest)) g.oldest = at;
    }
  }
  const out: CollectionQueueRow[] = [];
  for (const [residenceId, g] of groups) {
    const info = residences.get(residenceId);
    if (!info) continue;
    out.push({ residenceId, name: info.name, publicArea: info.public_area, status: info.status, pendingCount: g.count, oldestSubmittedAt: g.oldest });
  }
  return out.sort((a, b) => (a.oldestSubmittedAt < b.oldestSubmittedAt ? -1 : a.oldestSubmittedAt > b.oldestSubmittedAt ? 1 : a.name.localeCompare(b.name, "es")));
}

export type CollectionQueueLoad = { ok: true; ready: true; rows: CollectionQueueRow[] } | { ok: true; ready: false } | { ok: false };

export async function loadCollectionApprovalQueue(admin: SupabaseClient): Promise<CollectionQueueLoad> {
  const pending = await admin
    .from("residence_collection_accounts")
    .select("residence_id, pending_submitted_at")
    .or(PENDING_FILTER)
    .order("pending_submitted_at", { ascending: true });
  if (isSchemaMissing(pending.error)) return { ok: true, ready: false };
  if (pending.error) {
    console.error("[collection-approval] queue read failed:", pending.error.code, pending.error.message);
    return { ok: false };
  }
  const rows = (pending.data ?? []) as { residence_id: string; pending_submitted_at: string | null }[];
  if (rows.length === 0) return { ok: true, ready: true, rows: [] };
  const ids = [...new Set(rows.map((r) => r.residence_id))];
  const residences = await admin.from("residences").select("id, name, public_area, status").in("id", ids);
  if (residences.error) {
    console.error("[collection-approval] residences read failed:", residences.error.code, residences.error.message);
    return { ok: false };
  }
  const byId = new Map<string, { name: string; public_area: string | null; status: string }>();
  for (const r of (residences.data ?? []) as { id: string; name: string; public_area: string | null; status: string }[]) byId.set(r.id, r);
  return { ok: true, ready: true, rows: groupPendingByResidence(rows, byId) };
}

/** Un medio con cambios pendientes, con lo propuesto y lo vigente lado a lado. */
export interface PendingCollectionMethod {
  methodKey: string;
  /** Nombre para mostrar (el propuesto en «Otro»). */
  name: string;
  proposedDetails: string | null;
  proposedLabel: string | null;
  currentDetails: string | null;
  currentLabel: string | null;
  /** Valor exacto de `pending_submitted_at`: el formulario lo devuelve para que la acción detecte si el dueño cambió algo. */
  submittedAt: string;
  /** No tiene datos vigentes: es la primera carga. */
  isFirstLoad: boolean;
}

export type CollectionDetailLoad =
  | { ok: true; ready: true; residence: { id: string; name: string; publicArea: string | null; status: string }; methods: PendingCollectionMethod[] }
  | { ok: true; ready: false }
  | { ok: false; notFound?: boolean };

export async function loadCollectionApprovalDetail(admin: SupabaseClient, residenceId: string): Promise<CollectionDetailLoad> {
  const residence = await admin.from("residences").select("id, name, public_area, status").eq("id", residenceId).maybeSingle();
  if (residence.error) {
    console.error("[collection-approval] residence read failed:", residence.error.code, residence.error.message);
    return { ok: false };
  }
  if (!residence.data) return { ok: false, notFound: true };
  const accounts = await admin
    .from("residence_collection_accounts")
    .select("method_key, method_label, pending_method_label, details, pending_details, pending_submitted_at")
    .eq("residence_id", residenceId)
    .or(PENDING_FILTER)
    .order("pending_submitted_at", { ascending: true });
  if (isSchemaMissing(accounts.error)) return { ok: true, ready: false };
  if (accounts.error) {
    console.error("[collection-approval] accounts read failed:", accounts.error.code, accounts.error.message);
    return { ok: false };
  }
  const r = residence.data as { id: string; name: string; public_area: string | null; status: string };
  const methods: PendingCollectionMethod[] = [];
  for (const a of (accounts.data ?? []) as {
    method_key: string;
    method_label: string | null;
    pending_method_label: string | null;
    details: string | null;
    pending_details: string | null;
    pending_submitted_at: string | null;
  }[]) {
    if (!isPaymentMethodKey(a.method_key) || !a.pending_submitted_at) continue;
    methods.push({
      methodKey: a.method_key,
      name: paymentMethodLabel(a.method_key, a.pending_method_label ?? a.method_label),
      proposedDetails: a.pending_details,
      proposedLabel: a.pending_method_label,
      currentDetails: a.details,
      currentLabel: a.method_label,
      submittedAt: a.pending_submitted_at,
      isFirstLoad: (a.details ?? "").trim() === "" && (a.method_label ?? "").trim() === "",
    });
  }
  return { ok: true, ready: true, residence: { id: r.id, name: r.name, publicArea: r.public_area, status: r.status }, methods };
}

/** Cantidad de medios con cambios pendientes (toda la plataforma, o una residencia). `null` si no se pudo contar (p. ej. sin la 0102). */
export async function countPendingCollectionMethods(admin: SupabaseClient, residenceId?: string): Promise<number | null> {
  let query = admin.from("residence_collection_accounts").select("id", { count: "exact", head: true }).or(PENDING_FILTER);
  if (residenceId) query = query.eq("residence_id", residenceId);
  const { count, error } = await query;
  if (error) {
    if (!isSchemaMissing(error)) console.error("[collection-approval] count failed:", error.code, error.message);
    return null;
  }
  return count ?? 0;
}
