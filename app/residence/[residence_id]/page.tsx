import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertResidenceAccess } from "@/lib/residences/access";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Panel de la residencia" };
export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, { label: string; tone: "amber" | "sage" | "neutral" }> = {
  submitted: { label: "Nueva", tone: "amber" },
  queued_for_place: { label: "En cola", tone: "neutral" },
  under_review: { label: "En revisión", tone: "amber" },
  contact_established: { label: "Contacto establecido", tone: "sage" },
  offer_pending_student_acceptance: { label: "Propuesta enviada", tone: "amber" },
  conditions_accepted: { label: "Condiciones aceptadas", tone: "sage" },
  residence_payment_pending: { label: "Esperando pago", tone: "amber" },
  residence_payment_reported: { label: "Pago recibido", tone: "sage" },
  converted_to_reservation: { label: "Reserva creada", tone: "sage" },
  paused_due_to_other_active_request: { label: "Pausada", tone: "neutral" },
  rejected: { label: "Rechazada", tone: "neutral" },
  expired_no_residence_response: { label: "Vencida", tone: "neutral" },
  expired_offer_no_response: { label: "Vencida (propuesta)", tone: "neutral" },
  cancelled_by_student: { label: "Cancelada", tone: "neutral" },
};

type RecentApplicationRow = {
  id: string;
  status: string;
  created_at: string;
  student_profiles: { first_name: string; last_initial: string } | null;
  room_types: { name: string } | null;
};

export default async function ResidenceOverviewPage({
  params,
}: {
  params: Promise<{ residence_id: string }>;
}) {
  const { residence_id: residenceId } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser) notFound();
  const admin = getSupabaseAdmin();
  if (!admin) notFound();

  const hasAccess = await assertResidenceAccess(admin, sessionUser.id, residenceId);
  if (!hasAccess) notFound();

  const { data: residence } = await admin
    .from("residences")
    .select("id, name, public_area, status, total_capacity")
    .eq("id", residenceId)
    .maybeSingle();
  if (!residence) notFound();

  const [
    { count: newApplicationsCount },
    { count: inProgressApplicationsCount },
    { count: occupiedCount },
    { count: pendingRenewalRequestsCount },
    { count: pendingRenewalOffersCount },
    { count: totalResidentsCount },
    { count: pendingActivationCount },
    { count: waitlistCount },
    { data: recentApplicationsData },
  ] = await Promise.all([
    admin.from("application_requests").select("*", { count: "exact", head: true }).eq("residence_id", residenceId).eq("status", "submitted"),
    admin.from("application_requests").select("*", { count: "exact", head: true }).eq("residence_id", residenceId).in("status", ["submitted", "under_review", "contact_established"]),
    admin.from("resident_stays").select("*", { count: "exact", head: true }).eq("residence_id", residenceId).eq("is_current", true),
    admin.from("renewal_requests").select("*", { count: "exact", head: true }).eq("residence_id", residenceId).eq("status", "notified_to_residence"),
    admin.from("renewal_offers").select("*", { count: "exact", head: true }).eq("residence_id", residenceId).in("status", ["sent", "viewed"]),
    admin.from("resident_stays").select("*", { count: "exact", head: true }).eq("residence_id", residenceId).eq("is_current", true),
    admin.from("resident_stays").select("*", { count: "exact", head: true }).eq("residence_id", residenceId).eq("is_current", true).in("status", ["pending_activation", "created_by_residence"]),
    admin.from("waitlist_entries").select("*", { count: "exact", head: true }).eq("residence_id", residenceId).in("status", ["active", "availability_notification_sent", "retention_check_sent"]),
    admin
      .from("application_requests")
      .select("id, status, created_at, student_profiles(first_name, last_initial), room_types(name)")
      .eq("residence_id", residenceId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const recentApplications = (recentApplicationsData as unknown as RecentApplicationRow[]) ?? [];
  const capacity = residence.total_capacity ?? 0;
  const occupancyPct = capacity > 0 ? Math.min(100, Math.round(((occupiedCount ?? 0) / capacity) * 100)) : 0;
  const renewalsNeedingAttention = (pendingRenewalRequestsCount ?? 0) + (pendingRenewalOffersCount ?? 0);

  const kpis = [
    {
      icon: "inbox",
      iconTone: "forest" as const,
      title: "Solicitudes",
      href: `/residence/${residenceId}/applications`,
      cta: "Revisar solicitudes",
      badge: (newApplicationsCount ?? 0) > 0 ? `${newApplicationsCount} nueva(s)` : null,
      body: (
        <p className="text-sm text-ink-soft">
          <span className="font-bold text-ink">{inProgressApplicationsCount ?? 0}</span> en curso ·{" "}
          <span className="font-bold text-ink">{newApplicationsCount ?? 0}</span> nuevas
        </p>
      ),
    },
    {
      icon: "bed",
      iconTone: "orange" as const,
      title: "Ocupación",
      href: `/residence/${residenceId}/availability`,
      cta: "Ver disponibilidad",
      badge: null,
      body: (
        <div>
          <p className="text-sm text-ink-soft">
            <span className="text-2xl font-bold text-ink">{occupiedCount ?? 0}</span>
            {capacity > 0 && <span> / {capacity} plazas</span>}
          </p>
          {capacity > 0 && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-cream-2">
              <div className="h-full rounded-full bg-forest" style={{ width: `${occupancyPct}%` }} />
            </div>
          )}
        </div>
      ),
    },
    {
      icon: "sync_alt",
      iconTone: "lilac" as const,
      title: "Renovaciones",
      href: `/residence/${residenceId}/renewals`,
      cta: "Ver renovaciones",
      badge: renewalsNeedingAttention > 0 ? `${renewalsNeedingAttention} por revisar` : null,
      body: <p className="text-sm text-ink-soft">{renewalsNeedingAttention} esperando tu respuesta</p>,
    },
    {
      icon: "groups",
      iconTone: "sky" as const,
      title: "Residentes",
      href: `/residence/${residenceId}/residents`,
      cta: "Ver residentes",
      badge: (pendingActivationCount ?? 0) > 0 ? `${pendingActivationCount} pendientes` : null,
      body: (
        <p className="text-sm text-ink-soft">
          <span className="font-bold text-ink">{totalResidentsCount ?? 0}</span> cargados ·{" "}
          <span className="font-bold text-ink">{waitlistCount ?? 0}</span> en lista de espera
        </p>
      ),
    },
  ];

  const iconTiles: Record<string, string> = {
    forest: "bg-forest-tint text-forest-700",
    orange: "bg-orange-tint text-orange-700",
    lilac: "bg-lilac text-lilac-fg",
    sky: "bg-sky text-sky-fg",
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink md:text-3xl">{residence.name}</h1>
          <p className="mt-1 flex items-center gap-1 text-sm text-ink-soft">
            <Icon name="location_on" className="text-base" />
            {residence.public_area}, CABA
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/residence/${residenceId}/support`}
            className="rounded-full border-[1.5px] border-line-2 bg-paper px-4 py-2 text-sm font-bold text-ink hover:border-forest hover:bg-forest-tint"
          >
            Soporte
          </Link>
          <Link
            href={`/residence/${residenceId}/profile`}
            className="rounded-full border-[1.5px] border-line-2 bg-paper px-4 py-2 text-sm font-bold text-ink hover:border-forest hover:bg-forest-tint"
          >
            Editar perfil
          </Link>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="flex flex-col justify-between p-5">
            <div>
              <div className="mb-4 flex items-start justify-between">
                <div className={`rounded-field p-2 ${iconTiles[kpi.iconTone]}`}>
                  <Icon name={kpi.icon} className="text-xl" />
                </div>
                {kpi.badge && <Badge tone="amber">{kpi.badge}</Badge>}
              </div>
              <h3 className="mb-1 text-lg font-bold text-ink">{kpi.title}</h3>
              {kpi.body}
            </div>
            <Link
              href={kpi.href}
              className="mt-4 rounded-full border-[1.5px] border-line-2 bg-paper py-2 text-center text-sm font-bold text-ink hover:border-forest hover:bg-forest-tint"
            >
              {kpi.cta}
            </Link>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <h3 className="text-lg font-bold text-ink">Solicitudes recientes</h3>
            <Link href={`/residence/${residenceId}/applications`} className="text-sm font-bold text-forest-700 hover:underline">
              Ver todas
            </Link>
          </div>
          {recentApplications.length === 0 ? (
            <p className="p-6 text-sm text-ink-soft">Todavía no llegó ninguna solicitud.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-cream-2 text-muted">
                  <tr>
                    <th className="px-6 py-3 text-xs font-extrabold uppercase tracking-wider">Estudiante</th>
                    <th className="px-6 py-3 text-xs font-extrabold uppercase tracking-wider">Habitación</th>
                    <th className="px-6 py-3 text-xs font-extrabold uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-3 text-xs font-extrabold uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {recentApplications.map((app) => {
                    const badge = STATUS_COPY[app.status] ?? { label: app.status, tone: "neutral" as const };
                    return (
                      <tr key={app.id} className="hover:bg-cream-2">
                        <td className="px-6 py-4 font-bold text-ink">
                          <Link href={`/residence/${residenceId}/applications/${app.id}`} className="hover:underline">
                            {app.student_profiles?.first_name} {app.student_profiles?.last_initial}.
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-ink-soft">{app.room_types?.name ?? "—"}</td>
                        <td className="px-6 py-4 text-ink-soft">{new Date(app.created_at).toLocaleDateString("es-AR")}</td>
                        <td className="px-6 py-4">
                          <Badge tone={badge.tone}>{badge.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
