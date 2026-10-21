import { formatDate } from "@/lib/dates/format";
import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { cmd } from "@/components/admin/ui/tokens";
import { UserBlockControl } from "@/app/admin/users/UserBlockControl";

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

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const admin = getSupabaseAdmin();

  let query = admin
    ? admin
        .from("users")
        .select("id, email, primary_role, is_active, is_blocked, blocked_reason, last_login_at, created_at")
        .order("created_at", { ascending: false })
        .limit(200)
    : null;
  if (query && q?.trim()) query = query.ilike("email", `%${q.trim()}%`);

  const { data, error } = query ? await query : { data: [], error: null };
  if (error) console.error("[admin/users] query failed:", error);
  const users = (data as unknown as UserRow[]) ?? [];
  const blockedCount = users.filter((u) => u.is_blocked).length;

  return (
    <div className="p-8">
      <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
        Usuarios
      </h1>
      <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
        {users.length} usuario(s){blockedCount > 0 && ` · ${blockedCount} bloqueado(s)`}. Edición de roles vía{" "}
        <code>scripts/create-admin.mjs</code> o Supabase por ahora.
      </p>

      <form method="get" className="mt-4">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por email…"
          className="w-72 rounded-full px-4 py-2 text-sm"
          style={{ border: `1.5px solid ${cmd.border}`, backgroundColor: cmd.surface, color: cmd.onSurface }}
        />
      </form>

      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead style={{ backgroundColor: cmd.surfaceContainerLow, borderBottom: `1px solid ${cmd.border}` }}>
            <tr>
              {["Email", "Rol", "Alta", "Último ingreso", "Estado", ""].map((h) => (
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
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                <td className="px-4 py-2.5 font-medium" style={{ color: cmd.onSurface }}>
                  {u.email}
                </td>
                <td className="px-4 py-2.5" style={{ color: cmd.onSurfaceVariant }}>
                  {ROLE_LABEL[u.primary_role] ?? u.primary_role}
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
                  <UserBlockControl userId={u.id} isBlocked={u.is_blocked} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {users.length === 0 && (
          <p className="p-6 text-sm" style={{ color: cmd.outline }}>
            {q ? "Ningún usuario coincide con esa búsqueda." : "Todavía no hay usuarios registrados."}
          </p>
        )}
      </AdminCard>
    </div>
  );
}
