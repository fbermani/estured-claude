import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { formatDateTime } from "@/lib/dates/format";
import { loadPaymentSettings } from "@/lib/payments/paymentSettings";
import { maskTail } from "@/lib/payments/paymentSettingsValidation";
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

  let updatedBy: string | null = null;
  if (admin && settings?.updated_by_user_id) {
    const { data } = await admin.from("users").select("email").eq("id", settings.updated_by_user_id).maybeSingle();
    updatedBy = data?.email ?? null;
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <PaymentsTabs active="settings" />
      <p className="mt-3 text-sm" style={{ color: cmd.onSurfaceVariant }}>
        Cuenta a la que los estudiantes transfieren el fee EstuRed mientras el cobro automático no esté activo. Se
        muestra solo a quien tiene un fee pendiente de pago, junto con el monto exacto y su referencia.{" "}
        {canEdit
          ? "Cada cambio avisa a todos los superadmin."
          : "Solo un superadmin puede modificarla; acá ves un resumen con el CBU enmascarado."}
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
