import {
  auditActionOptions,
  auditActionPhrase,
  auditActorLabel,
  auditEntityLabel,
  auditEntityOptions,
  auditSourceLabel,
} from "@/lib/format/auditActionLabels";
import { formatShortName } from "@/lib/format/shortName";
import { formatDateTime } from "@/lib/dates/format";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { cmd } from "@/components/admin/ui/tokens";


const SOURCE_TONE: Record<string, "primary" | "neutral" | "violet" | "amber"> = {
  user: "primary",
  admin: "violet",
  system: "neutral",
  payment_provider: "amber",
};

const PAGE_SIZE = 50;
const NO_MATCH_UUID = "00000000-0000-0000-0000-000000000000";

type LogRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_user_id: string | null;
  actor_role: string;
  source: string;
  created_at: string;
  reason_text: string | null;
};

/** Texto + enlace opcional de la entidad de un evento. */
type EntityDisplay = { label: string; name: string | null; href: string | null };

const uniq = (ids: (string | null)[]): string[] => [...new Set(ids.filter((v): v is string => Boolean(v)))];

/** Escapa los comodines de ilike para que la búsqueda sea literal. */
const likeTerm = (raw: string) => `%${raw.trim().replace(/[%_\\,()]/g, " ")}%`;

export async function LogsView({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    source?: string;
    action?: string;
    entity?: string;
    actor?: string;
    page?: string;
  }>;
}) {
  const { from, to, source, action, entity, actor, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const admin = getSupabaseAdmin();

  let logs: LogRow[] = [];
  let totalCount = 0;
  const userEmails = new Map<string, string>();
  const entityDisplay = new Map<string, EntityDisplay>();

  if (admin) {
    let query = admin
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, actor_user_id, actor_role, source, created_at, reason_text", {
        count: "exact",
      })
      .order("created_at", { ascending: false });

    if (from) query = query.gte("created_at", `${from}T00:00:00`);
    if (to) query = query.lte("created_at", `${to}T23:59:59`);
    if (source) query = query.eq("source", source);
    if (action) query = query.eq("action", action);
    if (entity) query = query.eq("entity_type", entity);

    // Actor por email o nombre: se resuelve a ids de usuario (tope 200) y se filtra con `in`.
    if (actor?.trim()) {
      const term = likeTerm(actor);
      const [byEmail, byStudent, byFamily] = await Promise.all([
        admin.from("users").select("id").ilike("email", term).limit(200),
        admin.from("student_profiles").select("user_id").or(`first_name.ilike.${term},last_name.ilike.${term}`).limit(200),
        admin.from("family_members").select("user_id").or(`first_name.ilike.${term},last_name.ilike.${term}`).limit(200),
      ]);
      const ids = uniq([
        ...(byEmail.data ?? []).map((r) => r.id as string),
        ...(byStudent.data ?? []).map((r) => r.user_id as string),
        ...(byFamily.data ?? []).map((r) => r.user_id as string),
      ]);
      query = query.in("actor_user_id", ids.length > 0 ? ids : [NO_MATCH_UUID]);
    }

    const { data, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    logs = (data as LogRow[] | null) ?? [];
    totalCount = count ?? 0;

    // Una consulta por tipo de dato para toda la página (sin N+1).
    const idsOf = (type: string) => uniq(logs.filter((l) => l.entity_type === type).map((l) => l.entity_id));
    const userIds = uniq([...logs.map((l) => l.actor_user_id), ...idsOf("users")]);
    const [usersRes, residencesRes, applicationsRes, reservationsRes] = await Promise.all([
      userIds.length ? admin.from("users").select("id, email").in("id", userIds) : null,
      idsOf("residences").length ? admin.from("residences").select("id, name").in("id", idsOf("residences")) : null,
      idsOf("application_requests").length
        ? admin
            .from("application_requests")
            .select("id, residences(name), student_profiles(first_name, last_initial)")
            .in("id", idsOf("application_requests"))
        : null,
      idsOf("reservations").length
        ? admin
            .from("reservations")
            .select("id, residences(name), student_profiles(first_name, last_initial)")
            .in("id", idsOf("reservations"))
        : null,
    ]);

    for (const u of usersRes?.data ?? []) userEmails.set(u.id as string, u.email as string);
    for (const r of residencesRes?.data ?? []) {
      entityDisplay.set(`residences:${r.id}`, {
        label: auditEntityLabel("residences"),
        name: r.name as string,
        href: `/admin/residences/${r.id}`,
      });
    }
    for (const id of idsOf("users")) {
      const email = userEmails.get(id);
      entityDisplay.set(`users:${id}`, {
        label: auditEntityLabel("users"),
        name: email ?? null,
        href: email ? `/admin/users?q=${encodeURIComponent(email)}` : null,
      });
    }
    type WithContext = { id: string; residences: { name: string } | null; student_profiles: { first_name: string; last_initial: string } | null };
    for (const [type, rows] of [
      ["application_requests", applicationsRes?.data],
      ["reservations", reservationsRes?.data],
    ] as const) {
      for (const r of ((rows as unknown as WithContext[] | null) ?? [])) {
        const who = r.student_profiles ? formatShortName(r.student_profiles.first_name, r.student_profiles.last_initial) : "";
        entityDisplay.set(`${type}:${r.id}`, {
          label: auditEntityLabel(type),
          name: [who, r.residences?.name].filter(Boolean).join(" · ") || null,
          href: null,
        });
      }
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const buildHref = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams({ tab: "logs" });
    const merged = { from, to, source, action, entity, actor, page, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, String(value));
    }
    return `/admin/activity?${params.toString()}`;
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
          <input type="hidden" name="tab" value="logs" />
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
          <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: cmd.outline }}>
            Acción
            <select
              name="action"
              defaultValue={action ?? ""}
              className="max-w-[260px] rounded px-3 py-1.5 text-sm"
              style={{ border: `1px solid ${cmd.border}`, color: cmd.onSurface }}
            >
              <option value="">Todas</option>
              {auditActionOptions().map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: cmd.outline }}>
            Entidad
            <select
              name="entity"
              defaultValue={entity ?? ""}
              className="rounded px-3 py-1.5 text-sm"
              style={{ border: `1px solid ${cmd.border}`, color: cmd.onSurface }}
            >
              <option value="">Todas</option>
              {auditEntityOptions().map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: cmd.outline }}>
            Actor
            <input
              type="search"
              name="actor"
              defaultValue={actor ?? ""}
              placeholder="Email o nombre"
              className="w-48 rounded px-3 py-1.5 text-sm"
              style={{ border: `1px solid ${cmd.border}`, color: cmd.onSurface }}
            />
          </label>
          <button
            type="submit"
            className="rounded px-4 py-1.5 text-sm font-bold text-white"
            style={{ backgroundColor: cmd.primary }}
          >
            Aplicar filtros
          </button>
          {(from || to || source || action || entity || actor) && (
            <a href="/admin/activity?tab=logs" className="text-sm font-semibold" style={{ color: cmd.outline }}>
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
                  {formatDateTime(log.created_at)}
                </td>
                <td className="px-4 py-2.5" style={{ color: cmd.onSurface }}>
                  {log.actor_user_id && userEmails.get(log.actor_user_id) ? (
                    <>
                      <span className="block break-all font-medium">{userEmails.get(log.actor_user_id)}</span>
                      <span className="block text-[11px]" style={{ color: cmd.outline }}>
                        {auditActorLabel(log.actor_role)}
                      </span>
                    </>
                  ) : (
                    <span className="font-medium">
                      {log.actor_user_id ? `${auditActorLabel(log.actor_role)} (cuenta eliminada)` : "Sistema"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5" style={{ color: cmd.onSurfaceVariant }}>
                  <span title={log.action}>{auditActionPhrase(log.action)}</span>
                  {log.reason_text && (
                    <span className="block text-xs" style={{ color: cmd.outline }}>
                      {log.reason_text}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs" style={{ color: cmd.onSurfaceVariant }}>
                  {(() => {
                    const d = log.entity_id ? entityDisplay.get(`${log.entity_type}:${log.entity_id}`) : undefined;
                    const label = d?.label ?? auditEntityLabel(log.entity_type);
                    const text = d?.name ? `${label} · ${d.name}` : label;
                    return d?.href ? (
                      <a href={d.href} className="font-semibold underline" style={{ color: cmd.primary }} title={log.entity_id ?? undefined}>
                        {text}
                      </a>
                    ) : (
                      <span title={log.entity_id ?? undefined}>{text}</span>
                    );
                  })()}
                </td>
                <td className="px-4 py-2.5">
                  <AdminBadge tone={SOURCE_TONE[log.source] ?? "neutral"}>{auditSourceLabel(log.source)}</AdminBadge>
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
