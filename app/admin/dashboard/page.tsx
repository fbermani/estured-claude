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
import { groupConsecutiveActivity } from "@/lib/format/groupActivity";

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
    oldestProfileEditAgeDays: null as number | null,
  };
  let expiringVerifications: { residenceId: string; name: string; expiresAt: string }[] = [];
  let recentActivity: { id: string; action: string; created_at: string; actor_role: string }[] = [];

  if (admin) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const expiryLimit = new Date(Date.now() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const [active, pending, waiting, expiring, users, waitlist, activity, reservationsMonth, feePaymentsMonth, pendingProfileEdits, unreviewedTariffAlerts, oldestProfileEdit] = await Promise.all([
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
        .limit(40),
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
      admin
        .from("residence_profile_edits")
        .select("created_at")
        .eq("status", "pending_admin_review")
        .order("created_at", { ascending: true })
        .limit(1),
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
      oldestProfileEditAgeDays: oldestProfileEdit.data?.[0]?.created_at
        ? Math.max(0, Math.floor((Date.now() - new Date(oldestProfileEdit.data[0].created_at as string).getTime()) / 86_400_000))
        : null,
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

  // Pendientes: cada tarjeta lleva a su lista filtrada. Solo se muestran las que tienen algo por hacer.
  const pendingItems: { label: string; value: number; href: string; note?: string }[] = [
    { label: "Verificaciones pendientes", value: stats.pendingValidations, href: "/admin/verifications" },
    {
      label: "Revocaciones sin resolver",
      value: stats.pendingRevocations,
      href: "/admin/activity?tab=revocations",
      note:
        stats.oldestRevocationAgeDays !== null
          ? `La más vieja espera hace ${pluralize(stats.oldestRevocationAgeDays, "día", "días")}.`
          : undefined,
    },
    {
      label: "Ediciones de perfil pendientes",
      value: stats.pendingProfileEdits,
      href: "/admin/profile-edits",
      note:
        stats.oldestProfileEditAgeDays !== null
          ? `La más vieja espera hace ${pluralize(stats.oldestProfileEditAgeDays, "día", "días")}.`
          : undefined,
    },
    { label: "Alertas de tarifa sin revisar", value: stats.unreviewedTariffAlerts, href: "/admin/pricing" },
    {
      label: "Residencias con disponibilidad vencida",
      value: stats.staleAvailabilityResidences,
      href: "/admin/residences?filter=stale-availability",
    },
  ].filter((i) => i.value > 0);

  const metrics: { label: string; value: string | number; href?: string; note?: string }[] = [
    { label: "Residencias activas", value: stats.activeResidences },
    {
      label: "Esperando a la residencia",
      value: stats.waitingForResidence,
      href: "/admin/verifications",
      note: "Pedimos cambios y esperamos que las corrijan y reenvíen.",
    },
    { label: "Usuarios registrados", value: stats.totalUsers },
    { label: "Leads en lista de espera", value: stats.waitlistLeads },
    { label: "Reservas confirmadas (mes)", value: stats.reservationsThisMonth },
    {
      label: "Fee cobrado (mes)",
      value: `ARS ${stats.feeCollectedThisMonthArs.toLocaleString("es-AR")}`,
      href: "/admin/payments?tab=paid",
    },
  ];
  const activityGroups = groupConsecutiveActivity(recentActivity).slice(0, 8);

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

      <section aria-labelledby="dash-pendientes">
        <h2 id="dash-pendientes" className="mb-3 text-sm font-bold" style={{ color: cmd.onSurface }}>
          Requiere acción
        </h2>
        {pendingItems.length === 0 ? (
          <p className="text-sm" style={{ color: cmd.outline }}>
            No hay nada pendiente por revisar.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {pendingItems.map((m) => (
              <MetricCard
                key={m.label}
                tone="admin"
                icon="priority_high"
                label={m.label}
                value={m.value}
                className="border-l-4 border-l-orange"
                hint={
                  <>
                    {m.note}
                    <span className="mt-1 block">
                      <AdminBadge tone="amber">Requiere acción</AdminBadge>
                    </span>
                    <Link href={m.href} className="mt-1 inline-flex min-h-11 items-center font-bold text-(--tone-700) hover:underline">
                      Ver detalle →
                    </Link>
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="dash-metricas" className="mt-6">
        <h2 id="dash-metricas" className="mb-3 text-sm font-bold" style={{ color: cmd.onSurface }}>
          Métricas generales
        </h2>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((m) => (
            <MetricCard
              key={m.label}
              tone="admin"
              icon="insights"
              label={m.label}
              value={m.value}
              hint={
                <>
                  {m.note}
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
      </section>

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
            {activityGroups.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
                  <span className="font-semibold" style={{ color: cmd.onSurface }}>
                    {auditActorLabel(a.actor_role)}
                  </span>{" "}
                  {auditActionPhrase(a.action)}
                  {a.count > 1 && (
                    <span className="font-semibold tabular-nums" style={{ color: cmd.onSurface }}>
                      {" "}
                      ({a.count} veces)
                    </span>
                  )}
                </p>
                <span className="shrink-0 text-xs tabular-nums" style={{ color: cmd.outline }}>
                  {timeAgo(a.latest)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}
