import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { loadPaymentSettings } from "@/lib/payments/paymentSettings";
import { loadFeeCollectionMethods } from "@/lib/payments/feeCollectionMethods";
import { invalidateFeeMethodChoice } from "@/lib/payments/invalidateFeeMethodChoice";
import { notifySuperadminsOfFeeCollectionChange } from "@/lib/payments/notifyFeeCollectionChange";
import {
  FEE_FALLBACK_METHOD_KEY,
  composeSettingsDetails,
  describeFeeMethodChange,
  feeMethodAuditView,
  isFeeCurrency,
  type FeeCurrency,
} from "@/lib/payments/feeCollection";
import { isPaymentMethodKey, paymentMethodInfo, validatePaymentDetails, validatePaymentLabel } from "@/lib/payments/paymentMethods";

/**
 * Configuración de los medios con los que EstuRed cobra su fee (DR64 (a); `docs/07` §17.6). SOLO un `superadmin` escribe: el rol se
 * verifica en la BASE (`user_roles`), no en lo que mande el formulario. Cada cambio se audita con los datos de cobro ENMASCARADOS y
 * avisa a todos los superadmin sin datos de cobro. SIN aprobación de un segundo admin (supuesto reversible de DR64 (a)).
 */

export type FeeCollectionSaveResult = { ok: true; changed: boolean } | { ok: false; error: string };

const GENERIC_ERROR = "No pudimos guardar el medio de cobro. Intentá de nuevo.";
const NOT_READY = "Los medios de cobro del fee todavía no están disponibles en este entorno (falta aplicar la migración 0105).";
const NOT_SUPERADMIN = "Solo un superadmin puede modificar los medios de cobro del fee.";
const SCHEMA_MISSING = new Set(["42P01", "42703", "PGRST204", "PGRST205"]);

async function isActiveSuperadmin(admin: SupabaseClient, userId: string): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await admin.from("user_roles").select("user_id").eq("user_id", userId).eq("role", "superadmin").eq("is_active", true).maybeSingle();
  if (error) {
    console.error("[fee-collection] role read failed:", error.code, error.message);
    return false;
  }
  return Boolean(data);
}

type ExistingRow = { id: string; method_key: string; method_label: string | null; details: string; currency: string; is_enabled: boolean };
const COLUMNS = "id, method_key, method_label, details, currency, is_enabled";

export type SaveFeeCollectionMethodInput = {
  actorUserId: string;
  methodKey: unknown;
  /** Datos de cobro. Vacío con una fila existente = conservar los que ya tiene. */
  details: unknown;
  currency: unknown;
  isEnabled: boolean;
  /** Solo `other`: nombre del medio (2 a 60). */
  label?: unknown;
};

/** Crea o actualiza UN medio del catálogo (upsert por `method_key`). */
export async function saveFeeCollectionMethodCore(admin: SupabaseClient, params: SaveFeeCollectionMethodInput): Promise<FeeCollectionSaveResult> {
  if (!(await isActiveSuperadmin(admin, params.actorUserId))) return { ok: false, error: NOT_SUPERADMIN };

  if (!isPaymentMethodKey(params.methodKey)) return { ok: false, error: "Ese medio no existe en el catálogo." };
  const key = params.methodKey;
  const info = paymentMethodInfo(key);
  const name = info?.label ?? key;
  if (!isFeeCurrency(params.currency)) return { ok: false, error: "Elegí la moneda del medio: pesos o dólares." };
  const currency: FeeCurrency = params.currency;

  const read = await admin.from("estured_fee_collection_methods").select(COLUMNS).eq("method_key", key).maybeSingle();
  if (read.error) {
    console.error("[fee-collection] read failed:", read.error.code, read.error.message);
    return { ok: false, error: SCHEMA_MISSING.has(read.error.code ?? "") ? NOT_READY : GENERIC_ERROR };
  }
  const existing = (read.data as ExistingRow | null) ?? null;

  const detailsInput = typeof params.details === "string" ? params.details.trim() : "";
  let details: string;
  if (detailsInput === "" && existing) {
    details = existing.details;
  } else {
    const checked = validatePaymentDetails(params.details, name);
    if (!checked.ok) return { ok: false, error: checked.error };
    details = checked.value;
  }

  // La etiqueta solo existe con «Otro» (check de la migración 0105): para el resto va null, siempre.
  let label: string | null = null;
  if (info?.requiresLabel) {
    const labelInput = typeof params.label === "string" ? params.label.trim() : "";
    if (labelInput === "" && existing?.method_label) {
      label = existing.method_label;
    } else {
      const checked = validatePaymentLabel(params.label);
      if (!checked.ok) return { ok: false, error: checked.error };
      label = checked.value;
    }
  }

  const next = { method_key: key, method_label: label, currency, is_enabled: params.isEnabled, details };
  const before = existing ? { method_key: existing.method_key, method_label: existing.method_label, currency: existing.currency, is_enabled: existing.is_enabled, details: existing.details } : null;
  const changes = describeFeeMethodChange(before, next);
  if (existing && changes.length === 0) return { ok: true, changed: false };

  let rowId = existing?.id ?? null;
  if (existing) {
    const { error } = await admin
      .from("estured_fee_collection_methods")
      .update({ method_label: label, details, currency, is_enabled: params.isEnabled, updated_by_user_id: params.actorUserId })
      .eq("id", existing.id);
    if (error) {
      console.error("[fee-collection] update failed:", error.code, error.message);
      return { ok: false, error: GENERIC_ERROR };
    }
  } else {
    const { data, error } = await admin
      .from("estured_fee_collection_methods")
      .insert({ method_key: key, method_label: label, details, currency, is_enabled: params.isEnabled, updated_by_user_id: params.actorUserId })
      .select("id")
      .single();
    if (error || !data) {
      if (error) console.error("[fee-collection] insert failed:", error.code, error.message);
      return { ok: false, error: error && SCHEMA_MISSING.has(error.code ?? "") ? NOT_READY : GENERIC_ERROR };
    }
    rowId = data.id as string;
  }

  // Un medio deshabilitado o con datos, moneda o nombre cambiados ya no es el que vio quien lo eligió: ese pagador vuelve a elegir.
  const invalidatesChoice =
    Boolean(existing) &&
    (!next.is_enabled || details.trim() !== (existing?.details ?? "").trim() || currency !== existing?.currency || (label ?? "") !== (existing?.method_label ?? ""));
  const invalidated = invalidatesChoice ? await invalidateFeeMethodChoice(admin, key) : 0;

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "superadmin",
    action: "estured_fee_collection_method_updated",
    entityType: "estured_fee_collection_methods",
    entityId: rowId,
    oldValue: before ? feeMethodAuditView(before) : null,
    newValue: invalidated !== 0 ? { ...feeMethodAuditView(next), invalidated_fee_choices: invalidated } : feeMethodAuditView(next),
    source: "admin",
  });
  await notifySuperadminsOfFeeCollectionChange(admin, { entityId: rowId, changes });
  return { ok: true, changed: true };
}

/**
 * Importa la cuenta de `payment_settings` (la única que existía antes de DR64) como el medio «Transferencia en pesos» (ARS), HABILITADO,
 * para que el fee se siga cobrando a esa cuenta. El CBU pasa por el servidor, nunca por el cliente ni por SQL. Si ya existe ese medio no
 * lo pisa. Si el texto no entra en 500 caracteres NO se recorta: se pide cargarlo a mano.
 */
export async function importFeeCollectionFromSettingsCore(admin: SupabaseClient, params: { actorUserId: string }): Promise<FeeCollectionSaveResult> {
  if (!(await isActiveSuperadmin(admin, params.actorUserId))) return { ok: false, error: NOT_SUPERADMIN };

  const loaded = await loadFeeCollectionMethods(admin);
  if (!loaded.ok) return { ok: false, error: GENERIC_ERROR };
  if (loaded.rows.some((r) => r.method_key === FEE_FALLBACK_METHOD_KEY)) {
    return { ok: false, error: "«Transferencia en pesos» ya está cargada. Editala desde la lista." };
  }
  const settings = await loadPaymentSettings(admin);
  if (!settings) return { ok: false, error: "No hay una cuenta cargada para importar. Cargá los datos de la cuenta primero." };

  const composed = validatePaymentDetails(composeSettingsDetails(settings), "Transferencia en pesos");
  if (!composed.ok) {
    return {
      ok: false,
      error: "Los datos de la cuenta actual no entran en un medio de cobro (máximo 500 caracteres). Cargalos a mano en «Transferencia en pesos» con las indicaciones más cortas.",
    };
  }

  const { data, error } = await admin
    .from("estured_fee_collection_methods")
    .insert({ method_key: FEE_FALLBACK_METHOD_KEY, method_label: null, details: composed.value, currency: "ARS", is_enabled: true, updated_by_user_id: params.actorUserId })
    .select("id")
    .single();
  if (error || !data) {
    if (error) console.error("[fee-collection] import failed:", error.code, error.message);
    return { ok: false, error: error && SCHEMA_MISSING.has(error.code ?? "") ? NOT_READY : GENERIC_ERROR };
  }

  const next = { method_key: FEE_FALLBACK_METHOD_KEY, method_label: null, currency: "ARS", is_enabled: true, details: composed.value };
  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "superadmin",
    action: "estured_fee_collection_method_imported",
    entityType: "estured_fee_collection_methods",
    entityId: data.id as string,
    newValue: { ...feeMethodAuditView(next), source: "payment_settings" },
    source: "admin",
  });
  await notifySuperadminsOfFeeCollectionChange(admin, { entityId: data.id as string, changes: describeFeeMethodChange(null, next) });
  return { ok: true, changed: true };
}
