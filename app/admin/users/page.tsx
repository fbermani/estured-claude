import { formatDate } from "@/lib/dates/format";
import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { ScrollTable } from "@/components/ui/ScrollTable";
import { cmd } from "@/components/admin/ui/tokens";
import { UserBlockControl } from "@/app/admin/users/UserBlockControl";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { canBlockUser } from "@/lib/users/blockPermissions";
import { formatShortName } from "@/lib/format/shortName";

export const metadata: Metadata = { title: "Usuarios" };
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  guest: "Invitado",
  registered_user: "Registrado",
  student: "Estudiante",
  family_member: "Familiar",
  residence_owner: "Dueño de residencia",
  residence_staff: "Staff de residencia",
  admin: "Admin",
  superadmin: "Superadmin",
  system: "Sistema",
};

const PAGE_SIZE = 25;

/** Filtro de rol: solo los que tienen sentido en una cuenta real. */
const ROLE_FILTERS = [
  "student",
  "family_member",
  "residence_owner",
  "residence_staff",
  "registered_user",
  "admin",
  "superadmin",
] as const;

const STATUS_FILTERS: Record<string, string> = {
  active: "Activo",
  blocked: "Bloqueado",
  inactive: "Inactivo",
};

type UserRow = {
  id: string;
  email: string;
  primary_role: string;
  is_active: boolean;
  is_blocked: boolean;
  blocked_reason: string | null;
  last_login_at: string | null;
  created_at: string;
};

const NO_MATCH_UUID = "00000000-0000-0000-0000-000000000000";
const uniq = (ids: string[]) => [...new Set(ids)];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }>;
}) {
  const sessionUser = await requireAdmin();
  const { q, role: roleParam, status: statusParam, page: pageParam } = await searchParams;
  const role = (ROLE_FILTERS as readonly string[]).includes(roleParam ?? "") ? roleParam : undefined;
  const status = statusParam && statusParam in STATUS_FILTERS ? statusParam : undefined;
  const page = Math.max(1, Number(pageParam) || 1);
  const admin = getSupabaseAdmin();

  let users: UserRow[] = [];
  let totalCount = 0;
  let blockedTotal = 0;
  const names = new Map<string, string>();
  const rolesByUser = new Map<string, Set<string>>();
  const residencesByUser = new Map<string, string[]>();

  if (admin) {
    let query = admin
      .from("users")
      .select("id, email, primary_role, is_active, is_blocked, blocked_reason, last_login_at, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false });

    if (role) query = query.eq("primary_role", role);
    if (status === "blocked") query = query.eq("is_blocked", true);
    if (status === "active") query = query.eq("is_blocked", false).eq("is_active", true);
    if (status === "inactive") query = query.eq("is_blocked", false).eq("is_active", false);

    const term = q?.trim().replace(/[%_\\,()]/g, " ").trim();
    if (term) {
      const like = `%${term}%`;
      const [byStudent, byFamily] = await Promise.all([
        admin.from("student_profiles").select("user_id").or(`first_name.ilike.${like},last_name.ilike.${like}`).limit(200),
        admin.from("family_members").select("user_id").or(`first_name.ilike.${like},last_name.ilike.${like}`).limit(200),
      ]);
      const ids = uniq([
        ...(byStudent.data ?? []).map((r) => r.user_id as string),
        ...(byFamily.data ?? []).map((r) => r.user_id as string),
      ]);
      query = query.or(`email.ilike.${like},id.in.(${ids.length > 0 ? ids.join(",") : NO_MATCH_UUID})`);
    }

    const { data, count, error } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (error) console.error("[admin/users] query failed:", error);
    users = (data as unknown as UserRow[]) ?? [];
    totalCount = count ?? 0;

    const { count: blockedCount } = await admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("is_blocked", true);
    blockedTotal = blockedCount ?? 0;

    // Una consulta por tabla para toda la página (sin N+1).
    const ids = users.map((u) => u.id);
    if (ids.length > 0) {
      const [studentsRes, familyRes, rolesRes, staffRes] = await Promise.all([
        admin.from("student_profiles").select("user_id, first_name, last_name").in("user_id", ids),
        admin.from("family_members").select("user_id, first_name, last_name").in("user_id", ids),
        admin.from("user_roles").select("user_id, role").in("user_id", ids),
        admin
          .from("residence_users")
          .select("user_id, residences(name)")
          .in("user_id", ids)
          .eq("is_active", true),
      ]);
      for (const r of [...(studentsRes.data ?? []), ...(familyRes.data ?? [])]) {
        names.set(r.user_id as string, formatShortName(r.first_name as string, r.last_name as string));
      }
      for (const r of rolesRes.data ?? []) {
        const set = rolesByUser.get(r.user_id as string) ?? new Set<string>();
        set.add(r.role as string);
        rolesByUser.set(r.user_id as string, set);
      }
      for (const r of (staffRes.data as unknown as { user_id: string; residences: { name: string } | null }[] | null) ?? []) {
        if (!r.residences?.name) continue;
        residencesByUser.set(r.user_id, [...(residencesByUser.get(r.user_id) ?? []), r.residences.name]);
      }
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasFilters = Boolean(q?.trim() || role || status);
  const buildHref = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q, role, status, page, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `/admin/users?${qs}` : "/admin/users";
  };

  const selectStyle = { border: `1px solid ${cmd.border}`, backgroundColor: cmd.surface, color: cmd.onSurface };

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
        Usuarios
      </h1>
      <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
        {totalCount} {totalCount === 1 ? "usuario" : "usuarios"}
        {hasFilters ? " con estos filtros" : ""}
        {blockedTotal > 0 && ` · ${blockedTotal} ${blockedTotal === 1 ? "bloqueado" : "bloqueados"} en total`}.
      </p>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por email o nombre…"
          aria-label="Buscar por email o nombre"
          className="w-full rounded-full px-4 py-2 text-sm sm:w-72"
          style={{ border: `1.5px solid ${cmd.border}`, backgroundColor: cmd.surface, color: cmd.onSurface }}
        />
        <select name="role" defaultValue={role ?? ""} aria-label="Filtrar por rol" className="rounded-full px-3 py-2 text-sm" style={selectStyle}>
          <option value="">Todos los roles</option>
          {ROLE_FILTERS.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status ?? ""} aria-label="Filtrar por estado" className="rounded-full px-3 py-2 text-sm" style={selectStyle}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_FILTERS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-full px-4 py-2 text-sm font-bold text-white" style={{ backgroundColor: cmd.primary }}>
          Filtrar
        </button>
        {hasFilters && (
          <a href="/admin/users" className="py-2 text-sm font-semibold" style={{ color: cmd.outline }}>
            Limpiar
          </a>
        )}
      </form>

      <AdminCard className="mt-6 overflow-hidden">
        <ul className="divide-y md:hidden" style={{ borderColor: cmd.border }} aria-label="Usuarios">
          {users.map((u) => {
            const roles = [u.primary_role, ...[...(rolesByUser.get(u.id) ?? [])].filter((r) => r !== u.primary_role)];
            const decision = canBlockUser({
              actorUserId: sessionUser.id,
              actorRoles: sessionUser.roles,
              targetUserId: u.id,
              targetRoles: roles,
            });
            const name = names.get(u.id);
            const residences = residencesByUser.get(u.id);
            return (
              <li key={u.id} className="p-4 [&_button]:min-h-11 [&_button]:px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-medium" style={{ color: cmd.onSurface }}>{name ?? u.email}</p>
                    {name && (
                      <p className="break-all text-xs" style={{ color: cmd.outline }}>
                        {u.email}
                      </p>
                    )}
                    {residences && residences.length > 0 && (
                      <p className="text-xs" style={{ color: cmd.outline }}>
                        {residences.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {u.is_blocked ? (
                      <AdminBadge tone="rose">Bloqueado</AdminBadge>
                    ) : u.is_active ? (
                      <AdminBadge tone="emerald">Activo</AdminBadge>
                    ) : (
                      <AdminBadge tone="neutral">Inactivo</AdminBadge>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {roles.map((r) => (
                    <AdminBadge key={r} tone={r === "admin" || r === "superadmin" ? "violet" : "neutral"}>
                      {ROLE_LABEL[r] ?? r}
                    </AdminBadge>
                  ))}
                </div>
                <p className="mt-2 text-xs" style={{ color: cmd.outline }}>
                  Alta {formatDate(u.created_at)} · Último ingreso {u.last_login_at ? formatDate(u.last_login_at) : "Nunca"}
                </p>
                {u.is_blocked && u.blocked_reason && (
                  <p className="mt-1 text-xs" style={{ color: cmd.outline }}>
                    {u.blocked_reason}
                  </p>
                )}
                <div className="mt-3 flex justify-end">
                  {decision.allowed ? (
                    <UserBlockControl userId={u.id} isBlocked={u.is_blocked} />
                  ) : (
                    <p className="text-xs" style={{ color: cmd.outline }}>
                      {decision.reason}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="hidden md:block">
          <ScrollTable label="Usuarios">
        <table className="w-full text-left text-sm">
          <thead style={{ backgroundColor: cmd.surfaceContainerLow, borderBottom: `1px solid ${cmd.border}` }}>
            <tr>
              {["Usuario", "Rol", "Alta", "Último ingreso", "Estado", ""].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide"
                  style={{ color: cmd.outline }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const roles = [u.primary_role, ...[...(rolesByUser.get(u.id) ?? [])].filter((r) => r !== u.primary_role)];
              const decision = canBlockUser({
                actorUserId: sessionUser.id,
                actorRoles: sessionUser.roles,
                targetUserId: u.id,
                targetRoles: roles,
              });
              const name = names.get(u.id);
              const residences = residencesByUser.get(u.id);
              return (
                <tr key={u.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                  <td className="px-4 py-2.5" style={{ color: cmd.onSurface }}>
                    <span className="block font-medium">{name ?? u.email}</span>
                    {name && (
                      <span className="block break-all text-xs" style={{ color: cmd.outline }}>
                        {u.email}
                      </span>
                    )}
                    {residences && residences.length > 0 && (
                      <span className="block text-xs" style={{ color: cmd.outline }}>
                        {residences.join(", ")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {roles.map((r) => (
                        <AdminBadge key={r} tone={r === "admin" || r === "superadmin" ? "violet" : "neutral"}>
                          {ROLE_LABEL[r] ?? r}
                        </AdminBadge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: cmd.outline }}>
                    {formatDate(u.created_at)}
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: cmd.outline }}>
                    {u.last_login_at ? formatDate(u.last_login_at) : "Nunca"}
                  </td>
                  <td className="px-4 py-2.5">
                    {u.is_blocked ? (
                      <div>
                        <AdminBadge tone="rose">Bloqueado</AdminBadge>
                        {u.blocked_reason && (
                          <p className="mt-1 max-w-[220px] text-xs" style={{ color: cmd.outline }}>
                            {u.blocked_reason}
                          </p>
                        )}
                      </div>
                    ) : u.is_active ? (
                      <AdminBadge tone="emerald">Activo</AdminBadge>
                    ) : (
                      <AdminBadge tone="neutral">Inactivo</AdminBadge>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {decision.allowed ? (
                      <UserBlockControl userId={u.id} isBlocked={u.is_blocked} />
                    ) : (
                      <p className="max-w-[200px] text-right text-xs" style={{ color: cmd.outline }}>
                        {decision.reason}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
          </ScrollTable>
        </div>
        {users.length === 0 && (
          <p className="p-6 text-sm" style={{ color: cmd.outline }}>
            {hasFilters ? "Ningún usuario coincide con esos filtros." : "Todavía no hay usuarios registrados."}
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
