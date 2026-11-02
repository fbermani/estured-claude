import { ScrollTable } from "@/components/ui/ScrollTable";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { formatDate } from "@/lib/dates/format";
import { formatShortName } from "@/lib/format/shortName";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getResidenceMembership } from "@/lib/residences/access";
import { can } from "@/lib/residences/permissions";
import { StaffPermissionsSummary } from "@/components/residences/StaffPermissionsSummary";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { GuidePicks } from "@/components/guides/GuidePicks";
import { getStaleAvailabilityByResidence, staleAvailabilityMessage } from "@/lib/residences/staleAvailability";
import { getVisibleStatus } from "@/lib/applications/visibleStatus";
import { loadReservationInfoByApplication } from "@/lib/applications/loadReservationInfo";
import { countUnansweredStayChanges } from "@/lib/stayChange/load";
import { PremiumTag } from "@/components/residences/PremiumLock";
import { hasOperationalManagementAccess } from "@/lib/residences/operationalAccess";
import { PREMIUM_FEATURES } from "@/lib/residences/planFeatures";
import { OnboardingBanner } from "@/components/residences/OnboardingBanner";
import { buildOnboardingChecklist, getOnboardingBanner } from "@/lib/residences/onboardingStatus";
import { loadChangesMessage } from "@/lib/residences/loadChangesMessage";
import { computeProfileStrength } from "@/lib/residences/profileStrength";

export const metadata: Metadata = { title: "Panel de la residencia" };
export const dynamic = "force-dynamic";

type RecentApplicationRow = {
  id: string;
  status: string;
  created_at: string;
  student_profiles: { first_name: string; last_initial: string } | null;
  room_types: { name: string } | null;
};

type MovementRow = {
  id: string;
  status: string;
  invite_email: string | null;
  start_date: string | null;
  expected_end_date: string | null;
  student_profiles: { first_name: string; last_initial: string } | null;
  rooms: { id: string; label: string } | null;
};

const CONFIRMED_STAY_STATUSES = ["active", "visibility_limited", "hidden_by_user"];

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

  const membership = await getResidenceMembership(admin, sessionUser.id, residenceId);
  if (!membership) notFound();
  // DR11: el staff ve el Panel completo; editar el perfil requiere `profile.edit` y la verificación la gestiona siempre el dueño.
  const isOwner = membership.role === "owner";
  const canEditProfile = can(membership, "profile.edit");

  const { data: residence } = await admin
    .from("residences")
    .select("id, name, public_area, status")
    .eq("id", residenceId)
    .maybeSingle();
  if (!residence) notFound();
  // Lecturas independientes entre sí: en paralelo.
  const [hasPremium, changesMessage, { data: activeRooms }, staleAvailabilityMap] = await Promise.all([
    hasOperationalManagementAccess(admin, residenceId),
    residence.status === "needs_changes" ? loadChangesMessage(admin, residenceId) : Promise.resolve(null),
    admin.from("rooms").select("id").eq("residence_id", residenceId).eq("is_active", true),
    getStaleAvailabilityByResidence(admin, [residenceId]),
  ]);

  // Onboarding (Ciclo 65): banner + checklist solo si la residencia no está publicada.
  const onboardingCopy = getOnboardingBanner(residence.status, { changesMessage });
  let onboardingChecklist: ReturnType<typeof buildOnboardingChecklist> = [];
  if (onboardingCopy) {
    const [{ data: full }, { data: sections }, { data: roomTypes }, { count: photoCount }, { data: rulesFile }, { data: verification }] =
      await Promise.all([
        admin.from("residences").select("tagline, description").eq("id", residenceId).maybeSingle(),
        admin.from("residence_profile_sections").select("section_type, content").eq("residence_id", residenceId),
        admin.from("room_types").select("monthly_price_usd").eq("residence_id", residenceId).eq("is_active", true),
        admin
          .from("files")
          .select("id", { count: "exact", head: true })
          .eq("related_entity_type", "residences")
          .eq("related_entity_id", residenceId)
          .eq("document_type", "residence_photo")
          .neq("status", "rejected"),
        admin
          .from("files")
          .select("id")
          .eq("related_entity_type", "residences")
          .eq("related_entity_id", residenceId)
          .eq("document_type", "residence_rules_document")
          .limit(1)
          .maybeSingle(),
        admin.from("residence_verifications").select("status, scheduled_at").eq("residence_id", residenceId).maybeSingle(),
      ]);
    const sectionMap = Object.fromEntries((sections ?? []).map((s) => [s.section_type, s.content as Record<string, unknown>]));
    const itemsLen = (key: string) => (Array.isArray(sectionMap[key]?.items) ? (sectionMap[key].items as unknown[]).length : 0);
    const rulesSummary = typeof sectionMap.rules?.summary === "string" ? (sectionMap.rules.summary as string) : "";
    const strength = computeProfileStrength({
      tagline: full?.tagline ?? "",
      description: full?.description ?? "",
      services: itemsLen("services"),
      commonAreas: itemsLen("common_areas"),
      rulesSummary,
      nearUniversities: itemsLen("near_universities"),
      photos: photoCount ?? 0,
      roomTypesOk: (roomTypes ?? []).length > 0 && (roomTypes ?? []).every((rt) => Number(rt.monthly_price_usd) > 0),
    });
    onboardingChecklist = buildOnboardingChecklist({
      profileGapsCount: strength.gaps.length,
      photos: photoCount ?? 0,
      hasRules: rulesSummary.trim().length > 0 || !!rulesFile,
      verificationStatus: verification?.status ?? null,
      scheduledAt: verification?.scheduled_at ?? null,
      scheduledAtLabel: verification?.scheduled_at ? formatDate(verification.scheduled_at) : null,
    });
  }

  const roomIds = (activeRooms ?? []).map((room) => room.id);

  const [
    { count: newApplicationsCount },
    { count: inProgressApplicationsCount },
    { count: capacityCount },
    { count: occupiedCount },
    { count: outOfServiceBedsCount },
    { count: pendingRenewalRequestsCount },
    { count: pendingRenewalOffersCount },
    { count: totalResidentsCount },
    { count: pendingActivationCount },
    { count: waitlistCount },
    { data: recentApplicationsData },
  ] = await Promise.all([
    admin.from("application_requests").select("*", { count: "exact", head: true }).eq("residence_id", residenceId).eq("status", "submitted"),
    admin.from("application_requests").select("*", { count: "exact", head: true }).eq("residence_id", residenceId).in("status", ["submitted", "under_review", "contact_established"]),
    roomIds.length > 0
      ? admin.from("beds").select("*", { count: "exact", head: true }).in("room_id", roomIds).eq("status", "active")
      : Promise.resolve({ count: 0 }),
    admin.from("resident_stays").select("*", { count: "exact", head: true }).eq("residence_id", residenceId).eq("is_current", true).not("bed_id", "is", null),
    roomIds.length > 0
      ? admin.from("beds").select("*", { count: "exact", head: true }).in("room_id", roomIds).eq("status", "out_of_service")
      : Promise.resolve({ count: 0 }),
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

  // "Quiero cambiar" (DR3): residentes que avisaron que buscan otro lugar (lecturas degradables: ante un error, la línea no aparece).
  const [{ count: seekingChangeCount }, unansweredChangeCount] = await Promise.all([
    admin.from("stay_change_intents").select("*", { count: "exact", head: true }).eq("current_residence_id", residenceId).eq("status", "open"),
    countUnansweredStayChanges(admin, residenceId),
  ]);

  const recentApplications = (recentApplicationsData as unknown as RecentApplicationRow[]) ?? [];
  // H01: estado visible = solicitud + reserva asociada (la reserva manda).
  const recentReservations = await loadReservationInfoByApplication(
    admin,
    recentApplications.filter((a) => a.status === "converted_to_reservation").map((a) => a.id),
  );
  // H23: aviso cuando hay tipos de habitación con disponibilidad vencida u ocultos de las búsquedas.
  const staleAvailability = staleAvailabilityMap.get(residenceId);
  const availabilityNotice = staleAvailabilityMessage(staleAvailability);
  const capacity = capacityCount ?? 0;
  const outOfServiceCount = outOfServiceBedsCount ?? 0;
  const occupancyPct = capacity > 0 ? Math.min(100, Math.round(((occupiedCount ?? 0) / capacity) * 100)) : 0;
  const renewalsNeedingAttention = (pendingRenewalRequestsCount ?? 0) + (pendingRenewalOffersCount ?? 0);

  // Próximos ingresos y salidas (Ciclo 41) — mismo criterio de ventana
  // de 30 días que ya usan rooms/page.tsx y residents/page.tsx para sus
  // KPIs de "movimientos próximos"; acá se listan en detalle.
  const today = new Date();
  const in30 = new Date(today.getTime() + 30 * 24 * 3600 * 1000);
  const todayStr = today.toISOString().slice(0, 10);
  const in30Str = in30.toISOString().slice(0, 10);

  const stayMovementSelect = "id, status, invite_email, start_date, expected_end_date, student_profiles(first_name, last_initial), rooms(id, label)";
  const [{ data: arrivalsData }, { data: departuresData }] = await Promise.all([
    admin
      .from("resident_stays")
      .select(stayMovementSelect)
      .eq("residence_id", residenceId)
      .eq("is_current", true)
      .gte("start_date", todayStr)
      .lte("start_date", in30Str)
      .order("start_date", { ascending: true })
      .limit(8),
    admin
      .from("resident_stays")
      .select(stayMovementSelect)
      .eq("residence_id", residenceId)
      .eq("is_current", true)
      .not("expected_end_date", "is", null)
      .gte("expected_end_date", todayStr)
      .lte("expected_end_date", in30Str)
      .order("expected_end_date", { ascending: true })
      .limit(8),
  ]);

  const movementName = (m: MovementRow) =>
    m.student_profiles ? `${formatShortName(m.student_profiles.first_name, m.student_profiles.last_initial)}` : "Residente sin activar";

  const movements = [
    ...((arrivalsData as unknown as MovementRow[]) ?? []).map((m) => ({
      key: `in-${m.id}`,
      kind: "ingreso" as const,
      name: movementName(m),
      date: m.start_date as string,
      room: m.rooms?.label ?? null,
      confirmed: CONFIRMED_STAY_STATUSES.includes(m.status),
      stayId: m.id,
      roomId: m.rooms?.id ?? null,
    })),
    ...((departuresData as unknown as MovementRow[]) ?? []).map((m) => ({
      key: `out-${m.id}`,
      kind: "egreso" as const,
      name: movementName(m),
      date: m.expected_end_date as string,
      room: m.rooms?.label ?? null,
      confirmed: CONFIRMED_STAY_STATUSES.includes(m.status),
      stayId: m.id,
      roomId: m.rooms?.id ?? null,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const kpis = [
    {
      icon: "inbox",
      iconTone: "forest" as const,
      premium: false,
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
      premium: false,
      title: "Ocupación",
      href: `/residence/${residenceId}/availability`,
      cta: "Ver disponibilidad",
      badge: null,
      body: (
        <div>
          <p className="text-sm text-ink-soft">
            <span className="text-2xl font-bold text-ink">{occupiedCount ?? 0}</span>
            {capacity > 0 && <span> / {capacity} plazas operativas</span>}
          </p>
          {outOfServiceCount > 0 && (
            <p className="mt-1 text-xs text-ink-faint">
              {capacity} operativas ({outOfServiceCount} fuera de servicio)
            </p>
          )}
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
      premium: true,
      title: "Renovaciones",
      href: `/residence/${residenceId}/renewals`,
      cta: "Ver renovaciones",
      badge: renewalsNeedingAttention > 0 ? `${renewalsNeedingAttention} por revisar` : null,
      body: <p className="text-sm text-ink-soft">{renewalsNeedingAttention} esperando tu respuesta</p>,
    },
    {
      icon: "groups",
      iconTone: "sky" as const,
      premium: true,
      title: "Residentes",
      href: `/residence/${residenceId}/residents`,
      cta: "Ver residentes",
      badge: (pendingActivationCount ?? 0) > 0 ? `${pendingActivationCount} pendientes` : null,
      body: (
        <p className="text-sm text-ink-soft">
          <span className="font-bold text-ink">{totalResidentsCount ?? 0}</span> cargados ·{" "}
          <span className="font-bold text-ink">{waitlistCount ?? 0}</span> en lista de espera
          {(seekingChangeCount ?? 0) > 0 && (
            <Link
              href={`/residence/${residenceId}/residents?filtro=buscan-cambiar`}
              className="mt-2 flex items-center gap-1.5 rounded-field bg-orange-tint px-2.5 py-1.5 text-xs font-bold text-orange-700 hover:underline"
            >
              <Icon name="swap_horiz" className="text-base" />
              {seekingChangeCount === 1 ? "1 residente busca cambiar" : `${seekingChangeCount} residentes buscan cambiar`}
              {unansweredChangeCount > 0 ? ` · ${unansweredChangeCount} sin responder` : ""}
            </Link>
          )}
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
            {canEditProfile ? "Editar perfil" : "Ver perfil"}
          </Link>
        </div>
      </div>

      {!isOwner && <StaffPermissionsSummary permissions={membership.permissions} />}

      {onboardingCopy && (
        <OnboardingBanner copy={onboardingCopy} checklist={onboardingChecklist} residenceId={residenceId} ownerOnlyNote={!isOwner} />
      )}

      {availabilityNotice && (
        <Link
          href={`/residence/${residenceId}/availability`}
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-card border-[1.5px] border-warning-fg/30 bg-warning-bg p-4 text-sm text-warning-fg hover:border-warning-fg/60"
        >
          <Icon name="warning" className="mt-0.5 shrink-0 text-xl" />
          <span>
            <span className="font-bold">Tu disponibilidad necesita una actualización. </span>
            {availabilityNotice} <span className="font-bold underline">Ir a disponibilidad</span>
          </span>
        </Link>
      )}

      {!hasPremium && (
        <section className="mt-8 rounded-card border-[1.5px] border-orange/30 bg-orange-tint p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-extrabold text-orange-700">
                <Icon name="lock" className="text-lg" />
                Función Premium · hoy bonificada
              </p>
              <p className="mt-1 text-sm text-orange-700">
                Tu residencia tiene el Perfil Verificado (gratuito). La Gestión Operativa es parte del Plan Premium.
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {PREMIUM_FEATURES.map((f) => (
                  <li key={f.label} className="flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 text-xs font-bold text-ink-soft">
                    <Icon name="lock" className="text-sm text-orange-700" />
                    {f.label}
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href={`/residence/${residenceId}/plan`}
              className="shrink-0 rounded-full bg-forest px-4 py-2 text-sm font-bold text-white hover:bg-forest-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              Ver planes
            </Link>
          </div>
        </section>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="flex flex-col justify-between p-5">
            <div>
              <div className="mb-4 flex items-start justify-between">
                <div className={`rounded-field p-2 ${iconTiles[kpi.iconTone]}`}>
                  <Icon name={kpi.icon} className="text-xl" />
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {!hasPremium && kpi.premium && <PremiumTag />}
                  {kpi.badge && <Badge tone="amber">{kpi.badge}</Badge>}
                </div>
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
            <h3 className="text-lg font-bold text-ink">Próximos ingresos y salidas</h3>
            <Link href={`/residence/${residenceId}/residents`} className="text-sm font-bold text-forest-700 hover:underline">
              Ver residentes
            </Link>
          </div>
          {movements.length === 0 ? (
            <p className="p-6 text-sm text-ink-soft">Sin movimientos en los próximos 30 días.</p>
          ) : (
            <div className="divide-y divide-line">
              {movements.map((m) => (
                <Link
                  key={m.key}
                  href={`/residence/${residenceId}/residents?stay=${m.stayId}`}
                  className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-cream-2"
                >
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                      m.kind === "ingreso" ? "bg-forest-tint text-forest-700" : "bg-orange-tint text-orange-700"
                    }`}
                  >
                    <Icon name={m.kind === "ingreso" ? "login" : "logout"} className="text-lg" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink">{m.name}</p>
                    <p className="truncate text-xs text-ink-faint">
                      {m.kind === "ingreso" ? "Ingreso" : "Egreso"} · {m.room ?? "Sin habitación"} ·{" "}
                      {formatDateOnly(m.date)}
                    </p>
                  </div>
                  <Badge tone={m.confirmed ? "sage" : "amber"}>{m.confirmed ? "Confirmado" : "Pendiente"}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>
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
            <>
              <ul className="divide-y divide-line md:hidden" aria-label="Solicitudes recientes">
                {recentApplications.map((app) => {
                  const badge = getVisibleStatus({
                    applicationStatus: app.status,
                    reservation: recentReservations.get(app.id),
                    viewer: "residence",
                  });
                  return (
                    <li key={app.id} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <Link
                          href={`/residence/${residenceId}/applications?app=${app.id}`}
                          className="inline-flex min-h-11 items-center font-bold text-ink hover:underline"
                        >
                          {formatShortName(app.student_profiles?.first_name, app.student_profiles?.last_initial)}
                        </Link>
                        <p className="-mt-2 text-sm text-ink-soft">
                          {app.room_types?.name ?? "—"} · {formatDate(app.created_at)}
                        </p>
                      </div>
                      <span className="mt-2.5 shrink-0">
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="hidden md:block">
                <ScrollTable label="Solicitudes recientes">
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
                    const badge = getVisibleStatus({
                      applicationStatus: app.status,
                      reservation: recentReservations.get(app.id),
                      viewer: "residence",
                    });
                    return (
                      <tr key={app.id} className="hover:bg-cream-2">
                        <td className="px-6 py-4 font-bold text-ink">
                          <Link href={`/residence/${residenceId}/applications?app=${app.id}`} className="hover:underline">
                            {formatShortName(app.student_profiles?.first_name, app.student_profiles?.last_initial)}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-ink-soft">{app.room_types?.name ?? "—"}</td>
                        <td className="px-6 py-4 text-ink-soft">{formatDate(app.created_at)}</td>
                        <td className="px-6 py-4">
                          <Badge tone={badge.tone}>{badge.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
                </ScrollTable>
              </div>
            </>
          )}
        </Card>
      </div>

      <GuidePicks keys={["R01", "04"]} variant="panel" title="Guías para tu equipo" className="mt-8" />
    </div>
  );
}
