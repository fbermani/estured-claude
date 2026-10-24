import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { cmd } from "@/components/admin/ui/tokens";
import { getStaleAvailabilityByResidence } from "@/lib/residences/staleAvailability";
import { loadRevocationRecords, summarizePendingRevocations } from "@/lib/revocations/loadRevocations";
import { pluralize } from "@/lib/format/plural";
import { auditActionPhrase, auditActorLabel } from "@/lib/format/auditActionLabels";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { ACTIONABLE_STATUSES, EXPIRY_WARNING_DAYS, WAITING_STATUS } from "@/lib/residences/verificationReview";
import { formatDate } from "@/lib/dates/format";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

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
  await requireAdmin();
  const admin = getSupabaseAdmin();

  let stats = {
    activeResidences: 0,
    pendingValidations: 0,
    waitingForResidence: 0,
    totalUsers: 0,
    waitlistLeads: 0,
    reservationsThisMonth: 0,
    feeCollectedThisMonthArs: 0,
    pendingProfileEdits: 0,
    unreviewedTariffAlerts: 0,
    staleAvailabilityResidences: 0,
    pendingRevocations: 0,
    oldestRevocationAgeDays: null as number | null,
  };
  let expiringVerifications: { residenceId: string; name: string; expiresAt: string }[] = [];
  let recentActivity: { id: string; action: string; created_at: string; actor_role: string }[] = [];

  if (admin) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const expiryLimit = new Date(Date.now() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const [active, pending, waiting, expiring, users, waitlist, activity, reservationsMonth, feePaymentsMonth, pendingProfileEdits, unreviewedTariffAlerts] = await Promise.all([
      admin.from("residences").select("*", { count: "exact", head: true }).eq("status", "verified_active"),
      admin
        .from("residences")
        .select("*", { count: "exact", head: true })
        .in("status", [...ACTIONABLE_STATUSES]),
      admin.from("residences").select("*", { count: "exact", head: true }).eq("status", WAITING_STATUS),
      admin
        .from("residence_verifications")
        .select("residence_id, expires_at, residences!inner(id, name, status)")
        .eq("status", "approved")
        .eq("residences.status", "verified_active")
        .gt("expires_at", new Date().toISOString())
        .lte("expires_at", expiryLimit)
        .order("expires_at", { ascending: true })
        .limit(10),
      admin.from("users").select("*", { count: "exact", head: true }),
      admin.from("waitlist_signups").select("*", { count: "exact", head: true }),
      admin
        .from("audit_logs")
        .select("id, action, created_at, actor_role")
        .order("created_at", { ascending: false })
        .limit(8),
      admin
        .from("reservations")
        .select("*", { count: "exact", head: true })
        .gte("confirmed_at", startOfMonth.toISOString()),
      admin
        .from("estured_fee_payments")
        .select("fee_amount_ars")
        .eq("status", "paid")
        .gte("paid_at", startOfMonth.toISOString()),
      admin.from("residence_profile_edits").select("*", { count: "exact", head: true }).eq("status", "pending_admin_review"),
      admin.from("tariff_change_logs").select("*", { count: "exact", head: true }).eq("alert_triggered", true).eq("admin_review_status", "new"),
    ]);
    const staleAvailability = await getStaleAvailabilityByResidence(admin);
    // Revocaciones sin resolver (DR6): nunca rompe el dashboard si la lectura falla.
    let revocationsSummary: { count: number; oldestAgeDays: number | null } = { count: 0, oldestAgeDays: null };
    try {
      revocationsSummary = summarizePendingRevocations((await loadRevocationRecords(admin)).records);
    } catch (e) {
      console.error("[admin-dashboard] revocations summary failed:", e);
    }
    stats = {
      pendingRevocations: revocationsSummary.count,
      oldestRevocationAgeDays: revocationsSummary.oldestAgeDays,
      staleAvailabilityResidences: staleAvailability.size,
      activeResidences: active.count ?? 0,
      pendingValidations: pending.count ?? 0,
      waitingForResidence: waiting.count ?? 0,
      totalUsers: users.count ?? 0,
      waitlistLeads: waitlist.count ?? 0,
      pendingProfileEdits: pendingProfileEdits.count ?? 0,
      unreviewedTariffAlerts: unreviewedTariffAlerts.count ?? 0,
      reservationsThisMonth: reservationsMonth.count ?? 0,
      feeCollectedThisMonthArs: (feePaymentsMonth.data ?? []).reduce(
        (sum, p) => sum + Number(p.fee_amount_ars),
        0,
      ),
    };
    recentActivity = activity.data ?? [];
    expiringVerifications = (expiring.data ?? []).map((v) => {
      const r = v.residences as unknown as { id: string; name: string };
      return { residenceId: r.id, name: r.name, expiresAt: v.expires_at as string };
    });
  }

  const metrics: { label: string; value: string | number; tone: "neutral" | "amber" | "emerald"; href?: string; note?: string }[] = [
    { label: "Residencias activas", value: stats.activeResidences, tone: "neutral" as const },
    {
      label: "Verificaciones pendientes",
      value: stats.pendingValidations,
      tone: stats.pendingValidations > 0 ? ("amber" as const) : ("emerald" as const),
      href: "/admin/verifications",
    },
    {
      label: "Esperando a la residencia",
      value: stats.waitingForResidence,
      tone: "neutral" as const,
      href: "/admin/verifications",
      note: "Pedimos cambios y esperamos que las corrijan y reenvíen.",
    },
    {
      label: "Residencias con disponibilidad vencida",
      value: stats.staleAvailabilityResidences,
      tone: stats.staleAvailabilityResidences > 0 ? ("amber" as const) : ("emerald" as const),
      href: "/admin/residences?filter=stale-availability",
    },
    {
      label: "Revocaciones sin resolver",
      value: stats.pendingRevocations,
      tone: stats.pendingRevocations > 0 ? ("amber" as const) : ("emerald" as const),
      href: "/admin/activity?tab=revocations",
      note:
        stats.oldestRevocationAgeDays !== null
          ? `La más vieja espera hace ${pluralize(stats.oldestRevocationAgeDays, "día", "días")}.`
          : undefined,
    },
    { label: "Usuarios registrados", value: stats.totalUsers, tone: "neutral" as const },
    {
      label: "Ediciones de perfil pendientes",
      value: stats.pendingProfileEdits,
      tone: stats.pendingProfileEdits > 0 ? ("amber" as const) : ("emerald" as const),
    },
    {
      label: "Alertas de tarifa sin revisar",
      value: stats.unreviewedTariffAlerts,
      tone: stats.unreviewedTariffAlerts > 0 ? ("amber" as const) : ("emerald" as const),
    },
    { label: "Leads en lista de espera", value: stats.waitlistLeads, tone: "neutral" as const },
    { label: "Reservas confirmadas (mes)", value: stats.reservationsThisMonth, tone: "neutral" as const },
    {
      label: "Fee cobrado (mes)",
      value: `ARS ${stats.feeCollectedThisMonthArs.toLocaleString("es-AR")}`,
      tone: "neutral" as const,
      href: "/admin/payments?tab=paid",
    },
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
            Revisar verificaciones →
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => (
          <AdminCard key={m.label} className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
              {m.label}
            </p>
            <p className="mt-2 text-[28px] font-bold" style={{ color: cmd.onSurface }}>
              {m.value}
            </p>
            {m.note && (
              <p className="mt-1 text-xs" style={{ color: cmd.outline }}>
                {m.note}
              </p>
            )}
            {m.tone === "amber" && <AdminBadge tone="amber">Requiere acción</AdminBadge>}
            {m.href && (
              <Link
                href={m.href}
                className="mt-2 block text-xs font-bold hover:underline"
                style={{ color: cmd.primary }}
              >
                Ver detalle →
              </Link>
            )}
          </AdminCard>
        ))}
      </div>

      <AdminCard className="mt-6 p-5">
        <h2 className="text-sm font-bold" style={{ color: cmd.onSurface }}>
          Verificaciones que vencen en {EXPIRY_WARNING_DAYS} días
        </h2>
        {expiringVerifications.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: cmd.outline }}>
            Ninguna verificación vence en los próximos {EXPIRY_WARNING_DAYS} días.
          </p>
        ) : (
          <ul className="mt-3 divide-y" style={{ borderColor: cmd.border }}>
            {expiringVerifications.map((v) => (
              <li key={v.residenceId} className="flex items-center justify-between py-2.5">
                <Link href={`/admin/residences/${v.residenceId}`} className="text-sm font-semibold hover:underline" style={{ color: cmd.primary }}>
                  {v.name}
                </Link>
                <span className="text-xs" style={{ color: cmd.outline }}>
                  vence el {formatDate(v.expiresAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

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
                    {auditActorLabel(a.actor_role)}
                  </span>{" "}
                  {auditActionPhrase(a.action)}
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
