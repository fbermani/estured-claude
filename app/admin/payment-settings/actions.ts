"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSuperadminSession } from "@/lib/auth/requireAdmin";
import { formatDateTime } from "@/lib/dates/format";
import { createAuditLog } from "@/lib/audit";
import {
  changedPaymentSettingsFields,
  notifySuperadminsOfPaymentSettingsChange,
} from "@/lib/payments/notifyPaymentSettingsChange";
import { loadPaymentSettings, type PaymentSettingsRow } from "@/lib/payments/paymentSettings";
import {
  maskTail,
  parsePaymentSettingsInput,
  type PaymentSettingsErrors,
  type PaymentSettingsInput,
} from "@/lib/payments/paymentSettingsValidation";

export type SavePaymentSettingsState = {
  status: "idle" | "error" | "saved";
  message?: string;
  errors?: PaymentSettingsErrors;
  /** Lo tipeado, para no perder el formulario cuando hay errores. */
  values?: Record<string, string>;
};

const FIELD_NAMES = ["account_holder", "alias", "cbu", "bank_name", "holder_cuit", "instructions"] as const;

/** Versión auditable: el CBU y el CUIT van enmascarados (solo los últimos 4). */
function auditView(input: PaymentSettingsInput | PaymentSettingsRow | null) {
  if (!input) return null;
  const v =
    "accountHolder" in input
      ? input
      : {
          accountHolder: input.account_holder,
          alias: input.alias,
          cbu: input.cbu,
          bankName: input.bank_name,
          holderCuit: input.holder_cuit,
          instructions: input.instructions,
        };
  return {
    account_holder: v.accountHolder,
    alias: v.alias,
    cbu: maskTail(v.cbu),
    bank_name: v.bankName,
    holder_cuit: v.holderCuit ? maskTail(v.holderCuit) : null,
    has_instructions: Boolean(v.instructions),
  };
}

/**
 * D2 / H02 — el admin carga o edita los datos de cobro del fee (una sola
 * fila vigente). SOLO superadmin (decisión del dueño); validación server-side; auditoría
 * con valor anterior y nuevo (CBU/CUIT enmascarados).
 */
export async function savePaymentSettings(
  _prev: SavePaymentSettingsState,
  formData: FormData,
): Promise<SavePaymentSettingsState> {
  const sessionUser = await getSuperadminSession();
  if (!sessionUser) {
    return { status: "error", message: "Solo un superadmin puede modificar los datos de cobro." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const values: Record<string, string> = {};
  for (const name of FIELD_NAMES) values[name] = String(formData.get(name) ?? "");

  const parsed = parsePaymentSettingsInput(formData);
  if (!parsed.ok) {
    return { status: "error", message: "Revisá los campos marcados.", errors: parsed.errors, values };
  }

  const existing = await loadPaymentSettings(admin);
  const payload = {
    account_holder: parsed.values.accountHolder,
    alias: parsed.values.alias,
    cbu: parsed.values.cbu,
    bank_name: parsed.values.bankName,
    holder_cuit: parsed.values.holderCuit,
    instructions: parsed.values.instructions,
    updated_by_user_id: sessionUser.id,
  };

  let savedId = existing?.id ?? null;
  let error: unknown = null;
  if (existing) {
    ({ error } = await admin.from("payment_settings").update(payload).eq("id", existing.id));
  } else {
    const inserted = await admin.from("payment_settings").insert(payload).select("id").single();
    error = inserted.error;
    savedId = inserted.data?.id ?? null;
  }
  if (error) {
    console.error("[payment-settings] save failed:", error);
    return { status: "error", message: "No pudimos guardar los datos de cobro. Intentá de nuevo.", values };
  }

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: "superadmin",
    action: "payment_settings_updated",
    entityType: "payment_settings",
    entityId: savedId,
    oldValue: auditView(existing),
    newValue: auditView(parsed.values),
    source: "admin",
  });

  await notifySuperadminsOfPaymentSettingsChange(admin, {
    settingsId: savedId,
    isFirstLoad: !existing,
    changedFields: changedPaymentSettingsFields(
      existing
        ? {
            account_holder: existing.account_holder,
            alias: existing.alias,
            cbu: existing.cbu,
            bank_name: existing.bank_name,
            holder_cuit: existing.holder_cuit,
            instructions: existing.instructions,
          }
        : null,
      payload,
    ),
  });

  revalidatePath("/admin/payment-settings");
  revalidatePath("/admin/payments");
  return {
    status: "saved",
    message: `Datos actualizados el ${formatDateTime(new Date())}. Ya se muestran a quienes tienen un fee por pagar.`,
  };
}
