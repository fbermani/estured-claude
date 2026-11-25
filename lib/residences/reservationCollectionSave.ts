import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import {
  maskPaymentDetails,
  normalizePaymentMethodKeys,
  paymentMethodInfo,
  paymentMethodLabel,
  validatePaymentDetails,
  validatePaymentLabel,
  type PaymentMethodKey,
} from "@/lib/payments/paymentMethods";
import { assertResidenceOwner } from "@/lib/residences/access";
import { normalizeReservationModes, type ReservationPaymentMode } from "@/lib/residences/reservationCollection";

/**
 * Guarda el «Cobro de la reserva» de una residencia (DR63 (b) y (j), `docs/07` §16.3): opciones activas, medios aceptados y datos de
 * cobro de cada medio. SOLO EL DUEÑO (`assertResidenceOwner`): ni el staff con `profile.edit` ni el staff de ningún tipo lo guarda, ve ni
 * lee. El rol sale de `residence_users` en el servidor, nunca del formulario.
 *
 * Reglas:
 *  - DR65 (c): EstuRed NO aprueba los datos de cobro. Se escriben directo en `details` (y el nombre de «Otro» en `method_label`) y
 *    quedan vigentes al guardar; cada residencia responde por los suyos. Las columnas `pending_*` se dejan en null (sin uso).
 *  - Con «Cobro con medios habilitados» activa hace falta al menos 1 medio y que CADA medio aceptado tenga datos cargados (los guardados
 *    o los que llegan en este mismo guardado) y, en «Otro», un nombre. Sin esa opción se guardan 0 medios aceptados (las filas
 *    de datos se conservan: reactivar la opción no obliga a cargarlos de nuevo).
 *  - Un valor igual al guardado no escribe nada.
 *  - Cada cambio se audita con los datos de cobro ENMASCARADOS (solo los últimos 4 caracteres; un valor corto no se muestra) y avisa al
 *    dueño, sin datos (control contra un cambio que no hizo él).
 */

export type SaveReservationCollectionInput = {
  actorUserId: string;
  residenceId: string;
  /** Opciones activas (`enabled_methods` y/o `whatsapp_direct`). */
  modes: unknown;
  /** Medios aceptados (claves del catálogo). Se ignora si `enabled_methods` no está activa. */
  methods: unknown;
  /**
   * Datos por medio. Solo trae los que el dueño tocó: un medio sin entrada conserva lo que ya tiene. `details` ausente = sin cambios;
   * `label` solo aplica a «Otro».
   */
  accounts: unknown;
};

export type SaveReservationCollectionResult =
  | { ok: true; modes: ReservationPaymentMode[]; methods: PaymentMethodKey[]; updatedAccounts: number }
  | { ok: false; error: string };

type ExistingAccount = {
  id: string;
  method_key: string;
  method_label: string | null;
  pending_method_label: string | null;
  details: string | null;
  pending_details: string | null;
};

const SCHEMA_MISSING_CODES = new Set(["42703", "42P01", "PGRST204", "PGRST205"]);
const GENERIC_ERROR = "No pudimos guardar el cobro de la reserva. Intentá de nuevo.";
const NOT_READY_ERROR = "El cobro de la reserva todavía no está disponible en este entorno.";

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const text = (s: string | null | undefined): string => (s ?? "").trim();

export async function saveReservationCollection(
  admin: SupabaseClient,
  params: SaveReservationCollectionInput,
): Promise<SaveReservationCollectionResult> {
  const access = await assertResidenceOwner(admin, params.actorUserId, params.residenceId);
  if (!access.ok) return { ok: false, error: access.error };

  const modes = normalizeReservationModes(params.modes);
  if (!modes.ok) return { ok: false, error: modes.error };
  const methodsCheck = normalizePaymentMethodKeys(params.methods);
  if (!methodsCheck.ok) return { ok: false, error: methodsCheck.error };
  const enabledMethods = modes.value.includes("enabled_methods");
  const methods: PaymentMethodKey[] = enabledMethods ? methodsCheck.value : [];
  if (enabledMethods && methods.length === 0) return { ok: false, error: "Elegí al menos un medio de cobro, o desactivá «Cobro con medios habilitados»." };

  const provided = params.accounts === undefined || params.accounts === null ? {} : params.accounts;
  if (!isRecord(provided)) return { ok: false, error: "Los datos de cobro no son válidos." };

  // Estado actual (una sola lectura, columnas explícitas), antes de escribir nada.
  const residenceRead = await admin
    .from("residences")
    .select("id, name, reservation_payment_modes, accepted_payment_methods")
    .eq("id", params.residenceId)
    .maybeSingle();
  if (residenceRead.error) {
    console.error("[reservation-collection] residence read failed:", residenceRead.error.code, residenceRead.error.message);
    return { ok: false, error: residenceRead.error.code && SCHEMA_MISSING_CODES.has(residenceRead.error.code) ? NOT_READY_ERROR : GENERIC_ERROR };
  }
  if (!residenceRead.data) return { ok: false, error: "No encontramos la residencia." };
  const previous = residenceRead.data as { name?: string | null; reservation_payment_modes: string[] | null; accepted_payment_methods: string[] | null };

  const accountsRead = await admin
    .from("residence_collection_accounts")
    .select("id, method_key, method_label, pending_method_label, details, pending_details")
    .eq("residence_id", params.residenceId);
  if (accountsRead.error) {
    console.error("[reservation-collection] accounts read failed:", accountsRead.error.code, accountsRead.error.message);
    return { ok: false, error: accountsRead.error.code && SCHEMA_MISSING_CODES.has(accountsRead.error.code) ? NOT_READY_ERROR : GENERIC_ERROR };
  }
  const existingByKey = new Map<string, ExistingAccount>();
  for (const row of (accountsRead.data ?? []) as ExistingAccount[]) existingByKey.set(row.method_key, row);

  // Validación COMPLETA antes de escribir: un solo error y no se guarda nada.
  type Plan = { key: PaymentMethodKey; existing: ExistingAccount | undefined; targetDetails: string; targetLabel: string | null; changed: boolean };
  const plans: Plan[] = [];
  for (const key of methods) {
    const info = paymentMethodInfo(key);
    const name = info?.label ?? key;
    const existing = existingByKey.get(key);
    const entry = provided[key];
    if (entry !== undefined && !isRecord(entry)) return { ok: false, error: `Los datos de cobro de ${name} no son válidos.` };
    const entryRecord = isRecord(entry) ? entry : {};

    // Un pendiente viejo (antes de DR65 (c)) cuenta como lo último que cargó el dueño; al guardar queda vigente.
    const currentDetails = text(existing?.pending_details) || text(existing?.details);
    const currentLabel = text(existing?.pending_method_label) || text(existing?.method_label);

    let targetDetails: string;
    if (entryRecord.details === undefined) {
      if (currentDetails === "") return { ok: false, error: `Cargá los datos de cobro de ${name}.` };
      targetDetails = currentDetails;
    } else {
      const checked = validatePaymentDetails(entryRecord.details, name);
      if (!checked.ok) return { ok: false, error: checked.error };
      targetDetails = checked.value;
    }

    let targetLabel: string | null = null;
    if (info?.requiresLabel) {
      if (entryRecord.label === undefined) {
        if (currentLabel === "") return { ok: false, error: "Escribí el nombre del medio «Otro»." };
        targetLabel = currentLabel;
      } else {
        const checked = validatePaymentLabel(entryRecord.label);
        if (!checked.ok) return { ok: false, error: checked.error };
        targetLabel = checked.value;
      }
    }

    const savedDetails = text(existing?.details);
    const savedLabel = text(existing?.method_label) || null;
    const hasStalePending = Boolean(text(existing?.pending_details) || text(existing?.pending_method_label));
    const changed = !existing || targetDetails !== savedDetails || targetLabel !== savedLabel || hasStalePending;
    plans.push({ key, existing, targetDetails, targetLabel, changed });
  }

  // Escritura de los datos de cobro: vigentes al guardar (DR65 (c)); `pending_*` siempre en null.
  const changedPlans = plans.filter((p) => p.changed);
  for (const plan of changedPlans) {
    // `approved_at` / `approved_by_user_id` = «vigente desde / guardado por» (la constraint de 0102 exige approved_at con datos).
    const values = {
      details: plan.targetDetails,
      method_label: plan.targetLabel,
      approved_at: new Date().toISOString(),
      approved_by_user_id: params.actorUserId,
      pending_details: null,
      pending_method_label: null,
      pending_submitted_at: null,
      updated_by_user_id: params.actorUserId,
    };
    const { error } = plan.existing
      ? await admin.from("residence_collection_accounts").update(values).eq("id", plan.existing.id)
      : await admin.from("residence_collection_accounts").insert({ residence_id: params.residenceId, method_key: plan.key, ...values });
    if (error) {
      console.error("[reservation-collection] account save failed:", error.code, error.message);
      return { ok: false, error: GENERIC_ERROR };
    }
  }

  // Opciones y medios aceptados (columnas públicas, sin datos de cobro).
  const modesChanged = JSON.stringify(previous.reservation_payment_modes ?? null) !== JSON.stringify(modes.value);
  const methodsChanged = JSON.stringify(previous.accepted_payment_methods ?? null) !== JSON.stringify(methods);
  if (modesChanged || methodsChanged) {
    const { error } = await admin
      .from("residences")
      .update({ reservation_payment_modes: modes.value, accepted_payment_methods: methods })
      .eq("id", params.residenceId);
    if (error) {
      console.error("[reservation-collection] residence save failed:", error.code, error.message);
      return { ok: false, error: GENERIC_ERROR };
    }
  }

  // Auditoría: una entrada por cambio, con los datos de cobro enmascarados (nunca el texto completo).
  if (modesChanged || methodsChanged) {
    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: access.actorRole,
      action: "residence_reservation_collection_updated",
      entityType: "residences",
      entityId: params.residenceId,
      oldValue: { modes: previous.reservation_payment_modes ?? null, methods: previous.accepted_payment_methods ?? null },
      newValue: { modes: modes.value, methods },
    });
  }
  for (const plan of changedPlans) {
    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: access.actorRole,
      action: "residence_collection_account_updated",
      entityType: "residences",
      entityId: params.residenceId,
      oldValue: {
        method_key: plan.key,
        details: plan.existing?.details ? maskPaymentDetails(plan.existing.details) : null,
      },
      newValue: {
        method_key: plan.key,
        method_label: plan.targetLabel,
        details: maskPaymentDetails(plan.targetDetails),
      },
    });
  }

  const updatedAccounts = changedPlans.length;
  if (updatedAccounts > 0) {
    // Aviso al dueño, sin datos de cobro: qué medios cambiaron (si no fue él, lo detecta).
    const names = changedPlans.map((p) => paymentMethodLabel(p.key, p.targetLabel));
    await createNotification(admin, {
      userId: params.actorUserId,
      title: "Actualizaste tus datos de cobro",
      body: `Guardamos los datos de cobro de ${names.join(", ")}. Ya rigen para las próximas solicitudes. Vos respondés por estos datos: revisalos.`,
      relatedEntityType: "residence_collection_accounts",
      relatedEntityId: params.residenceId,
    });
  }

  return { ok: true, modes: modes.value, methods, updatedAccounts };
}
