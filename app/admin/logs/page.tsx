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

const PAGE_SIZE = 50;

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; source?: string; page?: string }>;
}) {
  const { from, to, source, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const admin = getSupabaseAdmin();

  let logs: {
    id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    actor_role: string;
    source: string;
    created_at: string;
    reason_text: string | null;
  }[] = [];
  let totalCount = 0;

  if (admin) {
    let query = admin
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, actor_role, source, created_at, reason_text", {
        count: "exact",
      })
      .order("created_at", { ascending: false });

    if (from) query = query.gte("created_at", `${from}T00:00:00`);
    if (to) query = query.lte("created_at", `${to}T23:59:59`);
    if (source) query = query.eq("source", source);

    const { data, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    logs = data ?? [];
    totalCount = count ?? 0;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const buildHref = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { from, to, source, page, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `/admin/logs?${qs}` : "/admin/logs";
  };

  return (
    <div className="p-8">
      <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
        Logs de auditoría
      </h1>
      <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
        {totalCount} eventos en total. Append-only: nada acá se edita ni se borra.
      </p>

      <AdminCard className="mt-6 p-4">
        <form method="get" className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: cmd.outline }}>
            Desde
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="rounded px-3 py-1.5 text-sm"
              style={{ border: `1px solid ${cmd.border}`, color: cmd.onSurface }}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: cmd.outline }}>
            Hasta
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="rounded px-3 py-1.5 text-sm"
              style={{ border: `1px solid ${cmd.border}`, color: cmd.onSurface }}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: cmd.outline }}>
            Origen
            <select
              name="source"
              defaultValue={source ?? ""}
              className="rounded px-3 py-1.5 text-sm"
              style={{ border: `1px solid ${cmd.border}`, color: cmd.onSurface }}
            >
              <option value="">Todos</option>
              <option value="user">Usuario</option>
              <option value="admin">Admin</option>
              <option value="system">Sistema</option>
              <option value="payment_provider">Proveedor de pago</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded px-4 py-1.5 text-sm font-bold text-white"
            style={{ backgroundColor: cmd.primary }}
          >
            Aplicar filtros
          </button>
          {(from || to || source) && (
            <a href="/admin/logs" className="text-sm font-semibold" style={{ color: cmd.outline }}>
              Limpiar
            </a>
          )}
        </form>
      </AdminCard>

      <AdminCard className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
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
        </div>
        {logs.length === 0 && (
          <p className="p-6 text-sm" style={{ color: cmd.outline }}>
            No hay eventos que coincidan con los filtros.
          </p>
        )}
      </AdminCard>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm" style={{ color: cmd.onSurfaceVariant }}>
          <p>
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <a
              href={page > 1 ? buildHref({ page: page - 1 }) : undefined}
              aria-disabled={page <= 1}
              className="rounded px-3 py-1.5 font-semibold"
              style={{
                border: `1px solid ${cmd.border}`,
                color: page <= 1 ? cmd.outline : cmd.onSurface,
                pointerEvents: page <= 1 ? "none" : "auto",
                opacity: page <= 1 ? 0.5 : 1,
              }}
            >
              ← Anterior
            </a>
            <a
              href={page < totalPages ? buildHref({ page: page + 1 }) : undefined}
              aria-disabled={page >= totalPages}
              className="rounded px-3 py-1.5 font-semibold"
              style={{
                border: `1px solid ${cmd.border}`,
                color: page >= totalPages ? cmd.outline : cmd.onSurface,
                pointerEvents: page >= totalPages ? "none" : "auto",
                opacity: page >= totalPages ? 0.5 : 1,
              }}
            >
              Siguiente →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
