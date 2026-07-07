import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { cmd } from "@/components/admin/ui/tokens";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  student_registered: "se registró como estudiante",
  residence_registered: "registró una residencia",
  residence_profile_submitted: "envió una residencia para revisión",
  residence_profile_saved_draft: "guardó cambios en una residencia",
  residence_verification_approved: "aprobó y publicó una residencia",
  residence_verification_rejected: "rechazó una residencia",
  residence_verification_needs_changes: "pidió cambios en una residencia",
  user_logged_out: "cerró sesión",
  admin_user_created: "creó un usuario admin",
  demo_user_seeded: "sembró un usuario demo",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

export default async function AdminDashboardPage() {
  const admin = getSupabaseAdmin();

  let stats = { activeResidences: 0, pendingValidations: 0, totalUsers: 0, waitlistLeads: 0 };
  let recentActivity: { id: string; action: string; created_at: string; actor_role: string }[] = [];

  if (admin) {
    const [active, pending, users, waitlist, activity] = await Promise.all([
      admin.from("residences").select("*", { count: "exact", head: true }).eq("status", "verified_active"),
      admin
        .from("residences")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending_verification", "verification_scheduled", "needs_changes"]),
      admin.from("users").select("*", { count: "exact", head: true }),
      admin.from("waitlist_signups").select("*", { count: "exact", head: true }),
      admin
        .from("audit_logs")
        .select("id, action, created_at, actor_role")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);
    stats = {
      activeResidences: active.count ?? 0,
      pendingValidations: pending.count ?? 0,
      totalUsers: users.count ?? 0,
      waitlistLeads: waitlist.count ?? 0,
    };
    recentActivity = activity.data ?? [];
  }

  const metrics = [
    { label: "Residencias activas", value: stats.activeResidences, tone: "neutral" as const },
    {
      label: "Validaciones pendientes",
      value: stats.pendingValidations,
      tone: stats.pendingValidations > 0 ? ("amber" as const) : ("emerald" as const),
    },
    { label: "Usuarios registrados", value: stats.totalUsers, tone: "neutral" as const },
    { label: "Leads en lista de espera", value: stats.waitlistLeads, tone: "neutral" as const },
  ];

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
            Dashboard operativo
          </h1>
          <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
            Estado general de EstuRed en tiempo real.
          </p>
        </div>
        {stats.pendingValidations > 0 && (
          <a
            href="/admin/verifications"
            className="rounded px-4 py-2 text-sm font-bold text-white"
            style={{ backgroundColor: cmd.primary }}
          >
            Revisar validaciones →
          </a>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {metrics.map((m) => (
          <AdminCard key={m.label} className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
              {m.label}
            </p>
            <p className="mt-2 text-[28px] font-bold" style={{ color: cmd.onSurface }}>
              {m.value}
            </p>
            {m.tone === "amber" && <AdminBadge tone="amber">Requiere acción</AdminBadge>}
          </AdminCard>
        ))}
      </div>

      <AdminCard className="mt-6 p-5">
        <h2 className="text-sm font-bold" style={{ color: cmd.onSurface }}>
          Actividad reciente
        </h2>
        {recentActivity.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: cmd.outline }}>
            Todavía no hay eventos registrados.
          </p>
        ) : (
          <ul className="mt-3 divide-y" style={{ borderColor: cmd.border }}>
            {recentActivity.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2.5">
                <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
                  <span className="font-semibold" style={{ color: cmd.onSurface }}>
                    {a.actor_role}
                  </span>{" "}
                  {ACTION_LABELS[a.action] ?? a.action}
                </p>
                <span className="text-xs" style={{ color: cmd.outline }}>
                  {timeAgo(a.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}
