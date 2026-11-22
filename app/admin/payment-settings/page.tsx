import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { formatDateTime } from "@/lib/dates/format";
import { loadPaymentSettings } from "@/lib/payments/paymentSettings";
import { maskTail } from "@/lib/payments/paymentSettingsValidation";
import { loadFeeCollectionMethods } from "@/lib/payments/feeCollectionMethods";
import { FEE_FALLBACK_METHOD_KEY } from "@/lib/payments/feeCollection";
import { PAYMENT_METHODS, maskPaymentDetails, paymentMethodLabel } from "@/lib/payments/paymentMethods";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { FeeCollectionMethodForm, ImportFeeCollectionButton } from "@/app/admin/payment-settings/FeeCollectionMethodForm";
import { cmd } from "@/components/admin/ui/tokens";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { PaymentsTabs } from "@/app/admin/payments/PaidFeesView";
import { PaymentSettingsForm } from "@/app/admin/payment-settings/PaymentSettingsForm";

export const metadata: Metadata = { title: "Datos de cobro" };
export const dynamic = "force-dynamic";

export default async function PaymentSettingsPage() {
  const sessionUser = await requireAdmin();
  const canEdit = sessionUser.roles.includes("superadmin");

  const admin = getSupabaseAdmin();
  const settings = admin ? await loadPaymentSettings(admin) : null;

  const methodsLoad = admin ? await loadFeeCollectionMethods(admin) : { ok: false as const };
  const methodRows = methodsLoad.ok ? methodsLoad.rows : [];
  const rowByKey = new Map(methodRows.map((r) => [r.method_key, r]));
  const anyEnabled = methodRows.some((r) => r.is_enabled);
  const canImport = canEdit && !!settings && !rowByKey.has(FEE_FALLBACK_METHOD_KEY);

  let updatedBy: string | null = null;
  if (admin && settings?.updated_by_user_id) {
    const { data } = await admin.from("users").select("email").eq("id", settings.updated_by_user_id).maybeSingle();
    updatedBy = data?.email ?? null;
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <PaymentsTabs active="settings" />
      <h2 className="mt-4 text-lg font-bold" style={{ color: cmd.onSurface }}>
        Medios de cobro del fee
      </h2>
      <p className="mt-1 text-sm" style={{ color: cmd.onSurfaceVariant }}>
        Medios con los que quien paga el fee EstuRed elige cómo hacerlo. Cada medio tiene su moneda y sus datos de cobro, que se
        muestran solo a quien tiene un fee por pagar, junto con el monto exacto y su referencia.{" "}
        {canEdit
          ? "Cada cambio se audita y avisa a todos los superadmin."
          : "Solo un superadmin puede modificarlos; acá ves un resumen con los datos enmascarados."}
      </p>

      {!methodsLoad.ok && (
        <AdminCard className="mt-4 p-4">
          <p role="alert" className="text-sm font-semibold" style={{ color: cmd.rose }}>
            No pudimos leer los medios de cobro. Recargá la página.
          </p>
        </AdminCard>
      )}

      {methodsLoad.ok && !anyEnabled && (
        <AdminCard className="mt-4 p-4">
          <p role="status" className="text-sm font-semibold" style={{ color: cmd.amber }}>
            Todavía no hay medios habilitados. Se usa la cuenta de transferencia anterior.
          </p>
          <p className="mt-1 text-sm" style={{ color: cmd.onSurfaceVariant }}>
            Mientras no habilites ninguno, el fee se paga por transferencia a la cuenta de más abajo. Podés importarla como el medio
            «Transferencia en pesos» y sumar otros.
          </p>
          {canImport && <ImportFeeCollectionButton />}
        </AdminCard>
      )}

      {methodsLoad.ok && canEdit && (
        <div className="mt-4 space-y-2">
          {PAYMENT_METHODS.map((m) => {
            const row = rowByKey.get(m.key);
            return (
              <AdminCard key={m.key} className="px-4 py-3">
                <details>
                  <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color: cmd.onSurface }}>
                    <span>{row ? paymentMethodLabel(m.key, row.method_label) : m.label}</span>
                    <span className="flex items-center gap-2">
                      {row && <span className="text-xs font-normal" style={{ color: cmd.outline }}>{row.currency}</span>}
                      <AdminBadge tone={row?.is_enabled ? "emerald" : "neutral"}>{row ? (row.is_enabled ? "Habilitado" : "Deshabilitado") : "Sin cargar"}</AdminBadge>
                    </span>
                  </summary>
                  <FeeCollectionMethodForm
                    defaults={{
                      key: m.key,
                      label: m.label,
                      hint: m.detailsHint,
                      requiresLabel: m.requiresLabel,
                      customLabel: row?.method_label ?? "",
                      details: row?.details ?? "",
                      currency: row?.currency ?? (m.key === "transfer_usd" || m.key === "paypal" || m.key === "airtm" || m.key === "western_union" ? "USD" : "ARS"),
                      isEnabled: row?.is_enabled ?? false,
                    }}
                  />
                </details>
              </AdminCard>
            );
          })}
        </div>
      )}

      {methodsLoad.ok && !canEdit && methodRows.length > 0 && (
        <AdminCard className="mt-4 p-4">
          <ul className="divide-y text-sm" style={{ borderColor: cmd.border }}>
            {methodRows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-semibold" style={{ color: cmd.onSurface }}>
                  {paymentMethodLabel(r.method_key, r.method_label)} · {r.currency} · {maskPaymentDetails(r.details)}
                </span>
                <AdminBadge tone={r.is_enabled ? "emerald" : "neutral"}>{r.is_enabled ? "Habilitado" : "Deshabilitado"}</AdminBadge>
              </li>
            ))}
          </ul>
        </AdminCard>
      )}

      <h2 className="mt-10 text-lg font-bold" style={{ color: cmd.onSurface }}>
        Cuenta de transferencia anterior
      </h2>
      <p className="mt-1 text-sm" style={{ color: cmd.onSurfaceVariant }}>
        Cuenta a la que se transfiere el fee mientras no haya ningún medio habilitado arriba (respaldo).{" "}
        {canEdit ? "Cada cambio avisa a todos los superadmin." : "Solo un superadmin puede modificarla; acá ves un resumen con el CBU enmascarado."}
      </p>

      {!settings && (
        <AdminCard className="mt-6 p-4">
          <p role="status" className="text-sm font-semibold" style={{ color: cmd.amber }}>
            Todavía no se cargaron los datos de cobro.
          </p>
          <p className="mt-1 text-sm" style={{ color: cmd.onSurfaceVariant }}>
            Hasta que se carguen, los estudiantes con un fee por pagar ven un aviso para escribir a Soporte en vez de
            la cuenta de destino.
            {!canEdit && " Pedile a un superadmin que los cargue."}
          </p>
        </AdminCard>
      )}

      {canEdit ? (
        <PaymentSettingsForm
          defaults={{
            account_holder: settings?.account_holder ?? "",
            alias: settings?.alias ?? "",
            cbu: settings?.cbu ?? "",
            bank_name: settings?.bank_name ?? "",
            holder_cuit: settings?.holder_cuit ?? "",
            instructions: settings?.instructions ?? "",
          }}
        />
      ) : (
        settings && (
          <AdminCard className="mt-6 p-6">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {[
                ["Titular", settings.account_holder],
                ["Banco", settings.bank_name],
                ["Alias", settings.alias],
                ["CBU", maskTail(settings.cbu)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt style={{ color: cmd.outline }}>{label}</dt>
                  <dd className="font-semibold" style={{ color: cmd.onSurface }}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </AdminCard>
        )
      )}

      {settings && (
        <p className="mt-3 text-xs" style={{ color: cmd.outline }}>
          Datos actualizados el {formatDateTime(settings.updated_at)}
          {updatedBy ? ` · ${updatedBy}` : ""}. El historial de cambios queda en el registro de auditoría (con el CBU
          enmascarado).
        </p>
      )}
    </div>
  );
}
