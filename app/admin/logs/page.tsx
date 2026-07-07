import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { cmd } from "@/components/admin/ui/tokens";

export const metadata: Metadata = { title: "Logs de auditoría" };
export const dynamic = "force-dynamic";

const SOURCE_TONE: Record<string, "primary" | "neutral" | "violet" | "amber"> = {
  user: "primary",
  admin: "violet",
  system: "neutral",
  payment_provider: "amber",
};

export default async function AdminLogsPage() {
  const admin = getSupabaseAdmin();
  const logs = admin
    ? (
        await admin
          .from("audit_logs")
          .select("id, action, entity_type, entity_id, actor_role, source, created_at, reason_text")
          .order("created_at", { ascending: false })
          .limit(50)
      ).data ?? []
    : [];

  return (
    <div className="p-8">
      <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
        Logs de auditoría
      </h1>
      <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
        Últimos {logs.length} eventos registrados en el sistema. Append-only: nada acá se edita ni se borra.
      </p>

      <AdminCard className="mt-6 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead style={{ backgroundColor: cmd.surfaceContainerLow, borderBottom: `1px solid ${cmd.border}` }}>
            <tr>
              {["Fecha", "Actor", "Acción", "Entidad", "Origen"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide"
                  style={{ color: cmd.outline }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                <td className="px-4 py-2.5 whitespace-nowrap text-xs" style={{ color: cmd.outline }}>
                  {new Date(log.created_at).toLocaleString("es-AR")}
                </td>
                <td className="px-4 py-2.5 font-medium" style={{ color: cmd.onSurface }}>
                  {log.actor_role}
                </td>
                <td className="px-4 py-2.5" style={{ color: cmd.onSurfaceVariant }}>
                  {log.action}
                  {log.reason_text && (
                    <span className="block text-xs" style={{ color: cmd.outline }}>
                      {log.reason_text}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs" style={{ color: cmd.outline }}>
                  {log.entity_type}
                  {log.entity_id && `:${log.entity_id.slice(0, 8)}`}
                </td>
                <td className="px-4 py-2.5">
                  <AdminBadge tone={SOURCE_TONE[log.source] ?? "neutral"}>{log.source}</AdminBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && (
          <p className="p-6 text-sm" style={{ color: cmd.outline }}>
            Todavía no hay eventos.
          </p>
        )}
      </AdminCard>
    </div>
  );
}
