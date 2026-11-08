import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PageHero } from "@/components/ui/PageHero";
import { MetricCard } from "@/components/ui/MetricCard";
import { Badge } from "@/components/ui/Badge";
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
    <div className="p-4 sm:p-8">
      <PageHero
        tone="admin"
        eyebrow="Admin"
        eyebrowIcon="admin_panel_settings"
        title="Dashboard operativo"
        subtitle="Estado general de EstuRed al abrir esta página."
        glyph="admin_panel_settings"
        className="mb-6"
        status={
          stats.pendingValidations > 0 ? (
            <Badge tone="amber">{pluralize(stats.pendingValidations, "verificación pendiente", "verificaciones pendientes")}</Badge>
          ) : undefined
        }
        cta={stats.pendingValidations > 0 ? { label: "Revisar verificaciones", href: "/admin/verifications" } : undefined}
      />

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => (
          <MetricCard
            key={m.label}
            tone="admin"
            icon={m.tone === "amber" ? "priority_high" : "insights"}
            label={m.label}
            value={m.value}
            className={m.tone === "amber" ? "border-l-4 border-l-orange" : ""}
            hint={
              <>
                {m.note}
                {m.tone === "amber" && (
                  <span className="mt-1 block">
                    <AdminBadge tone="amber">Requiere acción</AdminBadge>
                  </span>
                )}
                {m.href && (
                  <Link href={m.href} className="mt-1 inline-flex min-h-11 items-center font-bold text-(--tone-700) hover:underline">
                    Ver detalle →
                  </Link>
                )}
              </>
            }
          />
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
              <li key={v.residenceId} className="flex items-center justify-between gap-3 py-1">
                <Link href={`/admin/residences/${v.residenceId}`} className="inline-flex min-h-11 items-center text-sm font-semibold hover:underline" style={{ color: cmd.primary }}>
                  {v.name}
                </Link>
                <span className="shrink-0 text-xs tabular-nums" style={{ color: cmd.outline }}>
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
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
                  <span className="font-semibold" style={{ color: cmd.onSurface }}>
                    {auditActorLabel(a.actor_role)}
                  </span>{" "}
                  {auditActionPhrase(a.action)}
                </p>
                <span className="shrink-0 text-xs tabular-nums" style={{ color: cmd.outline }}>
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
