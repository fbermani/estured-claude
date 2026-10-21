import { formatDate } from "@/lib/dates/format";
import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cmd } from "@/components/admin/ui/tokens";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { ReviewButton } from "@/app/admin/pricing/ReviewButton";

export const metadata: Metadata = { title: "Administración de tarifas" };
export const dynamic = "force-dynamic";

const FIELD_LABELS: Record<string, string> = {
  monthly_price: "Tarifa mensual",
  enrollment_fee: "Matrícula",
  deposit: "Depósito",
  adjustment_policy: "Política de ajuste",
};

const REVIEW_LABELS: Record<string, { label: string; tone: "amber" | "emerald" | "neutral" | "rose" }> = {
  new: { label: "Sin revisar", tone: "amber" },
  reviewed: { label: "Revisado", tone: "emerald" },
  ignored: { label: "Ignorado", tone: "neutral" },
  flagged: { label: "Marcado", tone: "rose" },
};

type LogRow = {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  currency_code: string | null;
  variation_percent: number | null;
  alert_triggered: boolean;
  admin_review_status: string;
  created_at: string;
  residences: { name: string; public_area: string | null } | null;
  room_types: { name: string } | null;
  users: { email: string } | null;
};

function formatValue(fieldName: string, value: string | null, currency: string | null) {
  if (value === null) return "—";
  if (fieldName === "adjustment_policy") return value;
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return `${currency ?? ""} ${num.toLocaleString("es-AR")}`.trim();
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ alert?: string }>;
}) {
  const { alert } = await searchParams;
  const onlyAlerts = alert === "1";
  const admin = getSupabaseAdmin();

  let logs: LogRow[] = [];
  let alertCount = 0;
  if (admin) {
    let query = admin
      .from("tariff_change_logs")
      .select(
        "id, field_name, old_value, new_value, currency_code, variation_percent, alert_triggered, admin_review_status, created_at, residences(name, public_area), room_types(name), users!tariff_change_logs_changed_by_fkey(email)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (onlyAlerts) query = query.eq("alert_triggered", true);
    const [{ data }, { count }] = await Promise.all([
      query,
      admin.from("tariff_change_logs").select("*", { count: "exact", head: true }).eq("alert_triggered", true).eq("admin_review_status", "new"),
    ]);
    logs = (data as unknown as LogRow[]) ?? [];
    alertCount = count ?? 0;
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
            Administración de Tarifas
          </h1>
          <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
            Monitoreo de cambios de precio, matrícula, depósito y política de ajuste — no requiere aprobación previa.
          </p>
        </div>
        {alertCount > 0 && <AdminBadge tone="rose">{alertCount} alerta(s) sin revisar</AdminBadge>}
      </div>

      <div className="mb-4 flex gap-2">
        <Link
          href="/admin/pricing"
          className="rounded px-4 py-2 text-xs font-bold"
          style={!onlyAlerts ? { backgroundColor: cmd.primary, color: "#fff" } : { backgroundColor: "#fff", color: cmd.onSurfaceVariant, border: `1px solid ${cmd.outline}` }}
        >
          Todos los cambios
        </Link>
        <Link
          href="/admin/pricing?alert=1"
          className="rounded px-4 py-2 text-xs font-bold"
          style={onlyAlerts ? { backgroundColor: cmd.primary, color: "#fff" } : { backgroundColor: "#fff", color: cmd.onSurfaceVariant, border: `1px solid ${cmd.outline}` }}
        >
          Solo con alerta (±15%)
        </Link>
      </div>

      <AdminCard className="overflow-hidden p-0">
        {logs.length === 0 ? (
          <p className="p-6 text-sm" style={{ color: cmd.outline }}>
            {onlyAlerts ? "No hay cambios con alerta." : "Todavía no hay cambios de tarifa registrados."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead style={{ backgroundColor: cmd.surfaceContainer }}>
                <tr>
                  {["Residencia", "Campo", "Antes", "Después", "Variación", "Fecha", "Usuario", "Estado", ""].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: cmd.outline }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: cmd.border }}>
                {logs.map((log) => {
                  const review = REVIEW_LABELS[log.admin_review_status] ?? REVIEW_LABELS.new;
                  return (
                    <tr key={log.id}>
                      <td className="whitespace-nowrap px-4 py-3 font-bold" style={{ color: cmd.onSurface }}>
                        {log.residences?.name ?? "—"}
                        {log.room_types?.name && <span className="ml-1 font-normal" style={{ color: cmd.outline }}>· {log.room_types.name}</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3" style={{ color: cmd.onSurfaceVariant }}>
                        {FIELD_LABELS[log.field_name] ?? log.field_name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3" style={{ color: cmd.onSurfaceVariant }}>
                        {formatValue(log.field_name, log.old_value, log.currency_code)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-bold" style={{ color: cmd.onSurface }}>
                        {formatValue(log.field_name, log.new_value, log.currency_code)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {log.variation_percent !== null ? (
                          <AdminBadge tone={log.alert_triggered ? "rose" : "neutral"}>
                            {log.variation_percent > 0 ? "+" : ""}
                            {log.variation_percent}%
                          </AdminBadge>
                        ) : log.alert_triggered ? (
                          <AdminBadge tone="rose">Alerta</AdminBadge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3" style={{ color: cmd.outline }}>
                        {formatDate(log.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3" style={{ color: cmd.outline }}>
                        {log.users?.email ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <AdminBadge tone={review.tone}>{review.label}</AdminBadge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {log.admin_review_status === "new" && <ReviewButton logId={log.id} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </div>
  );
}
