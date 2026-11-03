import { formatShortName } from "@/lib/format/shortName";
import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ExpandableCard } from "@/components/ui/ExpandableCard";
import { FamilyLinkActions } from "@/app/students/FamilyLinkActions";
import { FamilyLinkCard } from "@/app/students/profile/FamilyLinkCard";
import { StartRenewalModal } from "@/app/students/renewals/StartRenewalModal";
import { ModuleCard } from "@/components/ui/ModuleCard";
import { PageHero } from "@/components/ui/PageHero";
import { MetricCard } from "@/components/ui/MetricCard";
import { ListRow } from "@/components/ui/ListRow";
import { Reveal } from "@/components/ui/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { NextStepCard } from "@/components/students/NextStepCard";
import { getNextStep } from "@/lib/students/journeyStage";
import { PhotoCarousel } from "@/components/students/PhotoCarousel";
import { ResidencePhoto } from "@/components/residences/ResidencePhoto";
import { getStudentProfileCompleteness } from "@/lib/students/profileCompleteness";
import { getCatalogResidences } from "@/lib/residences/catalog";
import { formatDateOnly } from "@/lib/students/contractEnd";
import { loadStudentContracts, type StudentContract } from "@/lib/students/loadStudentContracts";
import { GuidePicks } from "@/components/guides/GuidePicks";
import { todayIso } from "@/lib/applications/reservationMoney";
import { ArrivalCard } from "@/components/students/ArrivalCard";
import { daysUntil } from "@/lib/arrival/countdown";
import { loadCheckedItems } from "@/lib/arrival/loadChecklist";
import { resolveArrivalGuides } from "@/lib/arrival/guideLinks";
import { StayRateNote } from "@/components/students/StayRateNote";
import { GuardianConfirmCard } from "@/components/family/GuardianConfirmCard";
import { loadPendingForGuardian, type GuardianPendingCard } from "@/lib/residents/guardianConfirmation";
import { loadFamilyOverview, type FamilyStudentOverview } from "@/lib/family/loadFamilyOverview";
import { FamilyApplicationsList } from "@/components/students/FamilyApplicationsList";
import { FamilyStayChangeBlock } from "@/components/students/FamilyStayChangeBlock";
import { loadFamilyStayChange, type StudentStayChangeView } from "@/lib/stayChange/load";
import { getVisibleStatus } from "@/lib/applications/visibleStatus";
import { loadReservationInfoByApplication, type ReservationInfo } from "@/lib/applications/loadReservationInfo";
import { FeeUrgentBanner } from "@/components/applications/FeeUrgentBanner";
import { sortPendingFees } from "@/lib/payments/feeUrgentBanner";
import { pluralize } from "@/lib/format/plural";

export const metadata: Metadata = { title: "Tu espacio" };
export const dynamic = "force-dynamic";

interface StudentLinkRow {
  id: string;
  status: string;
  family_members: { first_name: string; last_name: string; relationship_type: string } | null;
}
interface FamilyLinkRow {
  id: string;
  status: string;
  student_profile_id: string;
  student_profiles: { first_name: string; last_initial: string } | null;
}
interface SentProposalRow {
  id: string;
  status: string;
  residences: { name: string } | null;
  student_profiles: { first_name: string; last_initial: string } | null;
}
type ApplicationSummaryRow = {
  id: string;
  status: string;
  created_at: string;
  residences: { name: string } | null;
  room_types: { name: string } | null;
};
type ReservationRow = {
  id: string;
  start_date: string;
  initial_duration_months: number;
  booking_receipt_id: string | null;
  residences: {
    id: string;
    name: string;
    public_area: string;
    slug: string;
    minimum_stay_months: number | null;
  } | null;
  room_types: { name: string } | null;
  application_snapshots: { monthly_price_usd: number } | null;
};
type FavoriteRow = {
  id: string;
  residence_id: string;
  added_by_role: "student" | "family_member";
};
type FavoritePreview = { slug: string; name: string; zone: string; photo: string | null; addedByFamily: boolean };

const PROPOSAL_STATUS_LABEL: Record<string, { label: string; tone: "amber" | "sage" | "neutral" }> = {
  pending_student_approval: { label: "Esperando respuesta", tone: "amber" },
  approved_by_student: { label: "Aprobada", tone: "sage" },
  rejected_by_student: { label: "Rechazada", tone: "neutral" },
  expired: { label: "Vencida", tone: "neutral" },
};

const RELATIONSHIP_LABEL: Record<string, string> = {
  padre: "Padre",
  madre: "Madre",
  tutor: "Tutor o tutora",
  familiar: "Familiar",
  otro: "Familiar",
};

/** Estados que ya no requieren seguimiento activo del estudiante en soporte. */
const SUPPORT_CLOSED_STATUSES = ["resolved_by_agreement", "closed_no_action", "closed_unresolved", "admin_action_taken"];

export default async function StudentDashboardPage() {
  const sessionUser = await getSessionUser();
  const supabase = await getSupabaseServer();
  const isFamilyMember = sessionUser?.roles.includes("family_member") ?? false;

  if (isFamilyMember) {
    const familyArrivalGuides = resolveArrivalGuides();
    let links: FamilyLinkRow[] = [];
    let sentProposals: SentProposalRow[] = [];
    const familyStayChanges = new Map<string, { view: StudentStayChangeView | null; residenceName: string | null }>();
    const overviewByLink = new Map<string, FamilyStudentOverview>();
    let guardianPending: GuardianPendingCard[] = [];
    if (supabase) {
      const { data } = await supabase
        .from("family_links")
        .select("id, status, student_profile_id")
        .order("created_at", { ascending: false });
      links = ((data ?? []) as unknown as Omit<FamilyLinkRow, "student_profiles">[]).map((l) => ({ ...l, student_profiles: null }));

      // Con RLS (migración 0046) el familiar solo lee `student_profiles` con vínculo ACTIVO; el nombre de quien tiene el
      // vínculo pendiente se lee por service role, acotado a los vínculos propios que devolvió la consulta de arriba.
      const nameAdmin = getSupabaseAdmin();
      if (nameAdmin && links.length > 0) {
        const { data: names } = await nameAdmin
          .from("student_profiles")
          .select("id, first_name, last_initial")
          .in("id", links.map((l) => l.student_profile_id));
        const byId = new Map((names ?? []).map((n) => [n.id as string, { first_name: n.first_name as string, last_initial: n.last_initial as string }]));
        links = links.map((l) => ({ ...l, student_profiles: byId.get(l.student_profile_id) ?? null }));
      }

      const { data: proposalData } = await supabase
        .from("family_application_proposals")
        .select("id, status, residences(name), student_profiles(first_name, last_initial)")
        .order("created_at", { ascending: false })
        .limit(5);
      sentProposals = (proposalData as unknown as SentProposalRow[]) ?? [];

      // "Quiero cambiar" (DR3): aviso de cada estudiante vinculado ACTIVO, en solo lectura y SIN su mensaje privado.
      const admin = getSupabaseAdmin();
      if (admin && sessionUser) {
        // DR32: pedidos de confirmación de estadía de un menor (solo estudiantes con vínculo ACTIVO).
        guardianPending = await loadPendingForGuardian(admin, sessionUser.id);
        // DR4: estado de las solicitudes/reserva de cada estudiante vinculado (solo lectura) y próxima acción del familiar.
        // Degrada sin tumbar el inicio: si algo falla, el familiar ve igual sus vínculos.
        try {
          for (const o of await loadFamilyOverview(admin, sessionUser.id)) overviewByLink.set(o.linkId, o);
        } catch (error) {
          console.error("[dashboard-familiar] no se pudo cargar el seguimiento:", error);
        }
        for (const l of links.filter((link) => link.status === "active")) {
          try {
            const view = await loadFamilyStayChange(admin, { familyUserId: sessionUser.id, studentProfileId: l.student_profile_id });
            let residenceName: string | null = null;
            if (view) {
              const { data: res } = await admin.from("residences").select("name").eq("id", view.currentResidenceId).maybeSingle();
              residenceName = (res?.name as string | undefined) ?? null;
            }
            familyStayChanges.set(l.id, { view, residenceName });
          } catch (error) {
            console.error("[dashboard-familiar] no se pudo cargar el aviso de cambio:", error);
          }
        }
      }
    }

    // Fee EstuRed con plazo vigente de cualquier estudiante vinculado: el que vence antes, arriba de todo.
    const familyFeeBanners = sortPendingFees(
      links.flatMap((l) => {
        const overview = overviewByLink.get(l.id);
        if (!overview || l.status !== "active") return [];
        return overview.applications.flatMap((a) =>
          a.nextAction?.kind === "pay_fee" || a.nextAction?.kind === "waiting_fee_payment"
            ? [
                {
                  applicationId: a.id,
                  residenceName: a.residenceName,
                  expiresAt: a.nextAction.expiresAt,
                  studentName: overview.studentFirstName,
                  payerView: a.nextAction.kind === "pay_fee" ? ("viewer_pays" as const) : a.nextAction.payerView,
                },
              ]
            : [],
        );
      }),
    );

    const activeLinksCount = links.filter((l) => l.status === "active").length;
    const proposalsWaiting = sentProposals.filter((p) => p.status === "pending_student_approval").length;

    return (
      <div className="tone-family mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <PageHero
          tone="family"
          eyebrow="Familia"
          eyebrowIcon="family_restroom"
          title="Tu espacio de familiar"
          subtitle="Acompañás, proponés residencias y seguís cómo avanza cada solicitud. Decide cada estudiante."
          glyph="family_restroom"
          status={
            <>
              <Badge tone={activeLinksCount > 0 ? "sage" : "neutral"}>
                <Icon name="link" className="text-sm" />
                {activeLinksCount === 0 ? "Sin vínculos activos" : pluralize(activeLinksCount, "vínculo activo", "vínculos activos")}
              </Badge>
              {proposalsWaiting > 0 && (
                <Badge tone="amber">
                  <Icon name="mail" className="text-sm" />
                  {pluralize(proposalsWaiting, "propuesta esperando respuesta", "propuestas esperando respuesta")}
                </Badge>
              )}
            </>
          }
          cta={{ label: "Proponer una residencia", href: "/search", note: "Es una propuesta, no una reserva" }}
        />

        {guardianPending.length > 0 && (
          <div className="mt-6 space-y-3">
            {guardianPending.map((g) => (
              <GuardianConfirmCard key={g.id} id={g.id} studentName={g.studentName} residenceName={g.residenceName} expiresLabel={formatDateOnly(g.expiresAt.slice(0, 10))} />
            ))}
          </div>
        )}

        {familyFeeBanners.map((b) => (
          <FeeUrgentBanner
            key={b.applicationId}
            audience="family"
            expiresAt={b.expiresAt}
            residenceName={b.residenceName}
            href={`/students/applications/${b.applicationId}/fee`}
            studentName={b.studentName}
            payerView={b.payerView}
          />
        ))}

        <div className="mt-8 space-y-4">
          {links.length === 0 ? (
            <Reveal>
              <EmptyState
                tone="family"
                icon="group_add"
                title="Todavía no tenés vínculos"
                description="Cuando un estudiante te invite y apruebe la vinculación, vas a verlo acá."
              />
            </Reveal>
          ) : (
            links.map((l, idx) => {
              const change = familyStayChanges.get(l.id);
              const studentFirstName = l.student_profiles?.first_name ?? "Tu familiar";
              const searching = !!change?.view && ["open_no_response", "open_responded", "open_expiring"].includes(change.view.ui.key);
              return (
                <Reveal key={l.id} delay={Math.min(idx, 5) as 0 | 1 | 2 | 3 | 4 | 5}>
                <Card className="border-l-[5px] border-l-(--tone) p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-(--tone-tint) font-display text-[15px] font-bold text-(--tone-700)">
                        {(l.student_profiles?.first_name ?? "?").charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-ink">
                          {formatShortName(l.student_profiles?.first_name, l.student_profiles?.last_initial)}
                        </p>
                        <p className="text-sm text-ink-soft">
                          {l.status === "pending_student_approval"
                            ? "Esperando que apruebe la vinculación"
                            : l.status === "active"
                              ? "Vínculo activo"
                              : "Vínculo no activo"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {searching && (
                        <Badge tone="amber">
                          <Icon name="swap_horiz" className="text-sm" /> Buscando un cambio
                        </Badge>
                      )}
                      <Badge tone={l.status === "active" ? "sage" : "amber"}>
                        {l.status === "pending_student_approval"
                          ? "Pendiente"
                          : l.status === "active"
                            ? "Activo"
                            : "Cerrado"}
                      </Badge>
                    </div>
                  </div>
                  {l.status === "active" && overviewByLink.get(l.id) && (
                    <div className="mt-4 border-t border-line pt-4">
                      <p className="mb-3 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted">
                        <Icon name="visibility" className="text-sm" /> Solicitudes y reserva · solo lectura
                      </p>
                      <FamilyApplicationsList
                        applications={overviewByLink.get(l.id)!.applications}
                        studentName={studentFirstName}
                        limit={3}
                      />
                      {overviewByLink.get(l.id)!.arrivals.map((a) => (
                        <div key={a.reservationId} className="mt-4">
                          <ArrivalCard
                            reservationId={a.reservationId}
                            residenceName={a.residenceName}
                            startDateLabel={formatDateOnly(a.startDate)}
                            daysLeft={a.daysLeft}
                            initialChecked={a.checkedKeys}
                            persistent={a.persistent}
                            readOnly
                            ownerName={studentFirstName}
                            {...familyArrivalGuides}
                          />
                        </div>
                      ))}
                      {overviewByLink.get(l.id)!.pendingProposals.length > 0 && (
                        <p className="mt-3 flex items-start gap-2 rounded-field bg-sand-100 px-4 py-3 text-xs text-ink-soft">
                          <Icon name="hourglass_top" className="mt-0.5 text-sm" />
                          <span>
                            Esperando que {studentFirstName} responda{" "}
                            {overviewByLink.get(l.id)!.pendingProposals.length === 1 ? "tu propuesta" : "tus propuestas"}:{" "}
                            {overviewByLink.get(l.id)!.pendingProposals.map((p) => p.residenceName).join(", ")}.
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                  {change && <FamilyStayChangeBlock view={change.view} studentName={studentFirstName} residenceName={change.residenceName} />}
                </Card>
                </Reveal>
              );
            })
          )}
        </div>

        <div className="mt-8">
          <Reveal>
            <ModuleCard
              href="/search"
              icon="search"
              title="Explorar residencias"
              cta={{ label: "Buscar residencia", href: "/search" }}
            >
              <p>Proponele opciones al estudiante que acompañás: él o ella decide si aprobarlas.</p>
            </ModuleCard>
          </Reveal>
        </div>

        {sentProposals.length > 0 && (
          <Reveal className="mt-6">
            <section aria-labelledby="propuestas-enviadas">
              <h2 id="propuestas-enviadas" className="mb-2 font-display text-lg font-bold text-ink">
                Propuestas que enviaste
              </h2>
              <Card className="p-1.5">
                <ul>
                  {sentProposals.map((p) => {
                    const status = PROPOSAL_STATUS_LABEL[p.status] ?? PROPOSAL_STATUS_LABEL.pending_student_approval;
                    return (
                      <ListRow
                        key={p.id}
                        avatar={(p.residences?.name ?? "?").charAt(0).toUpperCase()}
                        title={p.residences?.name ?? "Residencia"}
                        meta={`Para ${formatShortName(p.student_profiles?.first_name, p.student_profiles?.last_initial)}`}
                        status={<Badge tone={status.tone}>{status.label}</Badge>}
                      />
                    );
                  })}
                </ul>
              </Card>
            </section>
          </Reveal>
        )}

        <GuidePicks keys={["05", "03"]} variant="panel" title="Para leer con calma" className="mt-8" />
      </div>
    );
  }

  // Vista de estudiante (default) — 2 estados reales: en búsqueda vs. alojado.
  // Ciclo 40: el home deja de ser un resumen aislado y pasa a ser un hub —
  // cada sección del sidebar tiene su tarjeta de acceso rápido acá.
  let firstName: string | null = null;
  let isMinor = false;
  let studentLinks: StudentLinkRow[] = [];
  let pendingProposalsCount = 0;
  let reservation: ReservationRow | null = null;
  let contract: StudentContract | null = null;
  let renewalStatus: { label: string; tone: "amber" | "sage" | "neutral" | "danger" } | null = null;
  let completenessPercent = 100;
  let completenessMissing: string[] = [];
  let docsUploadedCount = 0;
  let favoritesPreview: FavoritePreview[] = [];
  let favoritesTotal = 0;
  let applications: ApplicationSummaryRow[] = [];
  let reservationInfoByAppId = new Map<string, ReservationInfo>();
  let waitlistCount = 0;
  let waitlistNeedsAction = false;
  let openSupportCount = 0;
  let familyActiveLink: { id: string; name: string; email: string | null } | null = null;
  let familyPendingInvitation: { id: string; email: string } | null = null;
  let residencePhotos: string[] = [];
  // Se pide en paralelo con el resto de las lecturas (favoritos y «residencias para mirar» lo reutilizan).
  const catalogPromise = getCatalogResidences();

  if (supabase && sessionUser) {
    const { data: profile } = await supabase
      .from("student_profiles")
      .select("id, first_name, is_minor")
      .eq("user_id", sessionUser.id)
      .maybeSingle();
    firstName = profile?.first_name ?? null;
    isMinor = profile?.is_minor ?? false;

    const admin = getSupabaseAdmin();
    if (admin) {
      const completeness = await getStudentProfileCompleteness(admin, sessionUser.id);
      if (completeness) {
        completenessPercent = completeness.percent;
        completenessMissing = completeness.missing.map((m) => m.label);
      }

      if (profile?.id) {
        const [{ data: docFiles }, { data: favoriteRows, count: favCount }, { data: activeLinkRow }, { data: pendingInvitationRow }, { count: supportCount }] =
          await Promise.all([
            admin
              .from("files")
              .select("document_type")
              .eq("related_entity_type", "student_profiles")
              .eq("related_entity_id", profile.id)
              .in("document_type", ["student_identity", "student_academic_proof"]),
            admin
              .from("student_favorites")
              .select("id, residence_id, added_by_role", { count: "exact" })
              .eq("student_profile_id", profile.id)
              .order("created_at", { ascending: false })
              .limit(3),
            admin
              .from("family_links")
              .select("id, family_members(first_name, last_name, users(email))")
              .eq("student_profile_id", profile.id)
              .eq("status", "active")
              .maybeSingle(),
            // pendingApprovalCount de family_links NO se pide acá — ese estado ya
            // tiene su propio banner con acciones reales (Aprobar/Rechazar) más
            // abajo en headerBanners; pasarle otro count a FamilyLinkCard acá
            // duplicaría el mensaje con un link circular "revisar en tu panel"
            // apuntando al panel en el que ya está parado.
            admin
              .from("family_invitations")
              .select("id, email")
              .eq("student_profile_id", profile.id)
              .eq("status", "pending")
              .maybeSingle(),
            admin
              .from("support_cases")
              .select("id", { count: "exact", head: true })
              .eq("opened_by_user_id", sessionUser.id)
              .not("status", "in", `(${SUPPORT_CLOSED_STATUSES.join(",")})`),
          ]);

        docsUploadedCount = new Set((docFiles ?? []).map((f) => f.document_type)).size;

        favoritesTotal = favCount ?? 0;
        const favRows = (favoriteRows ?? []) as FavoriteRow[];
        if (favRows.length > 0) {
          const allResidences = await catalogPromise;
          const { data: slugRows } = await admin
            .from("residences")
            .select("id, slug")
            .in("id", favRows.map((r) => r.residence_id));
          const slugById = new Map((slugRows ?? []).map((r) => [r.id, r.slug]));
          const residenceBySlug = new Map(allResidences.map((r) => [r.slug, r]));
          favoritesPreview = favRows
            .map((r): FavoritePreview | null => {
              const slug = slugById.get(r.residence_id);
              const residence = slug ? residenceBySlug.get(slug) : undefined;
              if (!residence) return null;
              return {
                slug: residence.slug,
                name: residence.name,
                zone: residence.zone,
                photo: residence.photos[0] ?? null,
                addedByFamily: r.added_by_role === "family_member",
              };
            })
            .filter((r): r is FavoritePreview => r !== null);
        }

        const activeLinkFamily = (
          activeLinkRow as unknown as {
            id: string;
            family_members: { first_name: string; last_name: string; users: { email: string } | null } | null;
          } | null
        )?.family_members;
        familyActiveLink =
          activeLinkRow && activeLinkFamily
            ? {
                id: (activeLinkRow as { id: string }).id,
                name: `${activeLinkFamily.first_name} ${activeLinkFamily.last_name}`,
                email: activeLinkFamily.users?.email ?? null,
              }
            : null;
        familyPendingInvitation = familyActiveLink ? null : ((pendingInvitationRow as { id: string; email: string } | null) ?? null);
        openSupportCount = supportCount ?? 0;
      }
    }

    // Lecturas independientes entre sí: en paralelo.
    const [
      { data },
      { count },
      { data: reservationData, error: reservationError },
      { data: appRows },
      { data: waitlistRows },
    ] = await Promise.all([
      supabase
        .from("family_links")
        .select("id, status, family_members(first_name, last_name, relationship_type)")
        .order("created_at", { ascending: false }),
      supabase
        .from("family_application_proposals")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending_student_approval")
        .gt("expires_at", new Date().toISOString()),
      supabase
        .from("reservations")
        .select(
          "id, start_date, initial_duration_months, booking_receipt_id, residences(id, name, public_area, slug, minimum_stay_months), room_types(name), application_snapshots(monthly_price_usd)",
        )
        .eq("status", "confirmed")
        .order("confirmed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("application_requests")
        .select("id, status, created_at, residences(name), room_types(name)")
        .order("created_at", { ascending: false }),
      supabase
        .from("waitlist_entries")
        .select("id, status")
        .in("status", ["active", "availability_notification_sent", "retention_check_sent"]),
    ]);
    studentLinks = (data as unknown as StudentLinkRow[]) ?? [];
    pendingProposalsCount = count ?? 0;
    if (reservationError) console.error("[students/dashboard] reservation lookup failed:", reservationError);
    reservation = reservationData as unknown as ReservationRow | null;

    if (reservation) {
      // H05: fin de contrato y tarifa vigentes (estadía → renovación → reserva).
      const contracts = await loadStudentContracts(supabase, [
        {
          id: reservation.id,
          start_date: reservation.start_date,
          initial_duration_months: reservation.initial_duration_months,
          snapshotRateUsd: reservation.application_snapshots?.monthly_price_usd ?? null,
        },
      ]);
      contract = contracts.get(reservation.id) ?? null;

      const [{ data: renewalRequest }, { data: renewalOffer }] = await Promise.all([
        supabase
          .from("renewal_requests")
          .select("id, status")
          .eq("reservation_id", reservation.id)
          .order("created_at", { ascending: false })
          .maybeSingle(),
        supabase
          .from("renewal_offers")
          .select("id, status")
          .eq("reservation_id", reservation.id)
          .order("created_at", { ascending: false })
          .maybeSingle(),
      ]);
      if (renewalOffer && ["sent", "viewed"].includes(renewalOffer.status)) {
        renewalStatus = { label: "La residencia te envió una oferta de renovación", tone: "amber" };
      } else if (
        renewalRequest &&
        (renewalRequest.status === "created_by_student" || renewalRequest.status === "notified_to_residence")
      ) {
        renewalStatus = { label: "Tu solicitud de renovación está esperando respuesta", tone: "amber" };
      } else if (renewalOffer?.status === "confirmed" || renewalOffer?.status === "receipt_issued") {
        renewalStatus = { label: "Ya renovaste tu estadía", tone: "sage" };
      }

      const admin2 = getSupabaseAdmin();
      if (admin2 && reservation.residences) {
        const { data: photoRows } = await admin2
          .from("files")
          .select("storage_path")
          .eq("related_entity_type", "residences")
          .eq("related_entity_id", reservation.residences.id)
          .eq("document_type", "residence_photo")
          .eq("status", "approved")
          .order("created_at", { ascending: true });
        residencePhotos = (photoRows ?? []).map(
          (p) => admin2.storage.from("public-residence-media").getPublicUrl(p.storage_path).data.publicUrl,
        );
      }
    }

    applications = (appRows as unknown as ApplicationSummaryRow[]) ?? [];
    // H01: estado visible = solicitud + reserva asociada (la reserva manda).
    reservationInfoByAppId = await loadReservationInfoByApplication(
      supabase,
      applications.filter((a) => a.status === "converted_to_reservation").map((a) => a.id),
    );

    waitlistCount = waitlistRows?.length ?? 0;
    waitlistNeedsAction = (waitlistRows ?? []).some((w) => w.status !== "active");
  }

  const pendingLinks = studentLinks.filter((l) => l.status === "pending_student_approval");
  const activeLink = studentLinks.find((l) => l.status === "active");
  const isHoused = reservation !== null;
  const residence = reservation?.residences ?? null;
  // DR29: «Tu llegada» con consulta aparte (no altera la reserva `confirmed` que alimenta el resto del panel): ingreso futuro y
  // estado confirmed / receipt_pending / receipt_issued, igual que el familiar y la action.
  let arrival: { id: string; start_date: string; residenceName: string } | null = null;
  if (supabase) {
    const { data: arrData } = await supabase
      .from("reservations")
      .select("id, start_date, residences(name)")
      .in("status", ["confirmed", "receipt_pending", "receipt_issued"])
      .gt("start_date", todayIso())
      .order("start_date", { ascending: true })
      .limit(1)
      .maybeSingle();
    const row = arrData as unknown as { id: string; start_date: string; residences: { name: string } | null } | null;
    if (row) arrival = { id: row.id, start_date: row.start_date, residenceName: row.residences?.name ?? "Residencia" };
  }
  const arrivalDays = arrival ? daysUntil(arrival.start_date, todayIso()) : null;
  const showArrival = arrival !== null && arrivalDays !== null;
  const arrivalChecked =
    showArrival && arrival && supabase ? await loadCheckedItems(supabase, [arrival.id]) : { persistent: false, byReservation: new Map<string, string[]>() };
  const arrivalGuides = showArrival ? resolveArrivalGuides() : null;
  const remaining = contract?.daysRemaining ?? 0;
  const contractEndLabel = contract ? formatDateOnly(contract.endDate) : "—";

  const visibleStatusOf = (a: ApplicationSummaryRow) =>
    getVisibleStatus({
      applicationStatus: a.status,
      reservation: reservationInfoByAppId.get(a.id),
      viewer: "student",
    });
  const applicationsActionNeeded = applications.filter((a) => visibleStatusOf(a).studentActionRequired);
  const primaryApplication = applicationsActionNeeded[0] ?? applications[0] ?? null;

  // «Tu próximo paso»: la solicitud vigente más relevante (con acción pendiente primero); las cerradas no cuentan.
  const activeApplication = applicationsActionNeeded[0] ?? applications.find((a) => !visibleStatusOf(a).isClosed) ?? null;
  const activeVisible = activeApplication ? visibleStatusOf(activeApplication) : null;
  const nextStep = getNextStep({
    profilePercent: completenessPercent,
    application:
      activeApplication && activeVisible
        ? {
            id: activeApplication.id,
            residenceName: activeApplication.residences?.name ?? "la residencia",
            statusKey: activeVisible.key,
            label: activeVisible.label,
            helper: activeVisible.helper,
            studentActionRequired: activeVisible.studentActionRequired,
          }
        : null,
    hadPreviousApplications: applications.length > 0,
  });
  // Residencias para mirar (solo mientras busca): primeras del catálogo real.
  const suggestedResidences = isHoused ? [] : (await catalogPromise).slice(0, 3);

  const heroAlerts: { icon: string; label: string; href: string }[] = [];
  if (renewalStatus) heroAlerts.push({ icon: "sync", label: renewalStatus.label, href: "/students/renewals" });
  if (docsUploadedCount < 2)
    heroAlerts.push({ icon: "folder_shared", label: "Documentación pendiente", href: "/students/profile" });

  // Fee EstuRed con plazo vigente (reserva en `pending_estured_fee`): se muestra arriba del hero, también para "alojado".
  const studentFeeBanners = sortPendingFees(
    applications.flatMap((a) => {
      const info = reservationInfoByAppId.get(a.id);
      return info?.status === "pending_estured_fee" && info.feePaymentStatus === "pending_payment_method"
        ? [{ applicationId: a.id, residenceName: a.residences?.name ?? "la residencia", expiresAt: info.feeExpiresAt }]
        : [];
    }),
  );

  const headerBanners = (
    <>
      {studentFeeBanners.map((b) => (
        <FeeUrgentBanner
          key={b.applicationId}
          audience="student"
          expiresAt={b.expiresAt}
          residenceName={b.residenceName}
          href={`/students/applications/${b.applicationId}/fee`}
        />
      ))}

      {pendingProposalsCount > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-card border-[1.5px] border-orange bg-gradient-to-b from-orange-tint to-paper to-80% p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-paper text-orange-700">
              <Icon name="mail" className="text-2xl" />
            </span>
            <div>
            <p className="font-semibold text-ink">
              {pendingProposalsCount === 1
                ? "Tu familiar te sugirió una residencia"
                : `Tu familiar te sugirió ${pendingProposalsCount} residencias`}
            </p>
            <p className="mt-1 text-sm text-ink-soft">Tenés 48 horas para aprobar o rechazar cada propuesta.</p>
            </div>
          </div>
          <Button href="/students/family-proposals" size="sm">
            Ver propuestas
          </Button>
        </div>
      )}

      {pendingLinks.map((link) => (
        <div
          key={link.id}
          className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-card border-[1.5px] border-orange bg-gradient-to-b from-orange-tint to-paper to-80% p-5"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-paper text-orange-700">
              <Icon name="family_restroom" className="text-2xl" />
            </span>
            <div>
            <p className="font-semibold text-ink">
              {RELATIONSHIP_LABEL[link.family_members?.relationship_type ?? "familiar"]}{" "}
              {link.family_members?.first_name} {link.family_members?.last_name} quiere
              vincularse a tu cuenta
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Va a poder ver tu búsqueda, sugerir residencias y ayudarte con pagos y
              documentación. Vos seguís decidiendo todo.
            </p>
            </div>
          </div>
          <FamilyLinkActions linkId={link.id} />
        </div>
      ))}

      {isMinor && !activeLink && (
        <div className="mt-6 rounded-card border border-orange bg-warning-bg p-5">
          <p className="font-semibold text-warning-fg">
            Sos menor de edad: vas a necesitar un familiar vinculado
          </p>
          <p className="mt-1 text-sm text-warning-fg">
            {familyPendingInvitation ? (
              <>
                Ya invitaste a <span className="font-semibold">{familyPendingInvitation.email}</span>. Cuando se
                registre, vas a aprobar la vinculación desde acá y vas a poder enviar solicitudes. Mientras tanto
                podés explorar y guardar residencias.
              </>
            ) : (
              <>
                Invitá a tu padre, madre o tutor por email: cuando se registre, vos aprobás la vinculación y ya
                podés enviar solicitudes. Mientras tanto podés explorar y guardar residencias.
              </>
            )}
          </p>
          {!familyPendingInvitation && (
            <a
              href="#vinculacion"
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-warning-fg underline underline-offset-2"
            >
              Invitar a un familiar
              <Icon name="arrow_downward" className="text-sm" />
            </a>
          )}
        </div>
      )}
    </>
  );

  // Módulos comunes a ambos estados — orden y children varían apenas según isHoused.
  const perfilCard = (
    <ModuleCard
      href="/students/profile"
      icon="person"
      title="Mi perfil"
      attention={completenessPercent < 100}
      badge={completenessPercent < 100 ? { label: `Falta ${100 - completenessPercent} %`, tone: "amber" } : undefined}
      cta={completenessPercent < 100 ? { label: "Completar perfil", href: "/students/profile" } : undefined}
    >
      <div className="flex items-center gap-3">
        <div
          className="relative flex size-11 shrink-0 items-center justify-center rounded-full text-xs font-bold text-forest-700"
          style={{ background: `conic-gradient(var(--color-forest-600) ${completenessPercent}%, var(--color-line-2) 0)` }}
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-paper">{completenessPercent}%</span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-ink">
            {completenessPercent >= 100 ? "Perfil completo" : "Completá tu perfil"}
          </p>
          <p className="truncate text-xs text-ink-faint">
            {completenessPercent >= 100
              ? `${docsUploadedCount} de 2 documentos`
              : `Falta: ${completenessMissing.slice(0, 2).join(", ")}${completenessMissing.length > 2 ? "…" : ""}`}
          </p>
        </div>
      </div>
    </ModuleCard>
  );

  const solicitudesCard = (
    <ModuleCard
      href="/students/applications"
      icon="description"
      title="Mis solicitudes"
      attention={applicationsActionNeeded.length > 0}
      badge={
        applicationsActionNeeded.length > 0
          ? { label: `${applicationsActionNeeded.length} pendiente${applicationsActionNeeded.length > 1 ? "s" : ""}`, tone: "amber" }
          : undefined
      }
      cta={
        applicationsActionNeeded.length > 0
          ? { label: "Continuar proceso", href: "/students/applications" }
          : applications.length === 0
            ? { label: "Buscar residencias", href: "/search" }
            : undefined
      }
    >
      {applications.length > 0 && primaryApplication ? (
        <>
          <p className="font-semibold text-ink">
            {applications.length} solicitud{applications.length === 1 ? "" : "es"}
          </p>
          <p className="mt-1 truncate text-xs text-ink-faint">
            {primaryApplication.residences?.name} — {visibleStatusOf(primaryApplication).label}
          </p>
        </>
      ) : (
        <p>Explorá el catálogo y dá el primer paso enviando tu primera solicitud.</p>
      )}
    </ModuleCard>
  );

  const favoritosCard = (
    <ModuleCard href="/students/favorites" icon="favorite" title="Favoritos">
      {favoritesTotal > 0 ? (
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {favoritesPreview.slice(0, 3).map((f) => (
              <div key={f.slug} className="relative size-9 shrink-0 overflow-hidden rounded-full bg-sand-200 ring-2 ring-paper">
                <ResidencePhoto src={f.photo} name={f.name} zone={f.zone} alt="" sizes="36px" variant="thumb" />
              </div>
            ))}
          </div>
          <p className="font-semibold text-ink">
            {favoritesTotal} guardad{favoritesTotal === 1 ? "a" : "as"}
          </p>
        </div>
      ) : (
        <p>Guardá residencias desde su ficha para compararlas después.</p>
      )}
    </ModuleCard>
  );

  const listaEsperaCard = (
    <ModuleCard
      href="/students/waitlist"
      icon="hourglass_top"
      title="Lista de espera"
      attention={waitlistNeedsAction}
      badge={waitlistNeedsAction ? { label: "¡Hay lugar!", tone: "amber" } : undefined}
    >
      {waitlistCount > 0 ? (
        <p className="font-semibold text-ink">
          En {pluralize(waitlistCount, "lista", "listas")} de espera
        </p>
      ) : (
        <p>Cuando una residencia no tenga lugar, vas a poder sumarte desde su ficha.</p>
      )}
    </ModuleCard>
  );

  const vinculacionCard = (
    <div id="vinculacion" className="h-full scroll-mt-24">
      <FamilyLinkCard activeLink={familyActiveLink} pendingApprovalCount={0} pendingInvitation={familyPendingInvitation} isMinor={isMinor} />
    </div>
  );

  const soporteCard = (
    <ModuleCard
      href="/students/support"
      icon="support_agent"
      title="Soporte"
      badge={openSupportCount > 0 ? { label: `${openSupportCount} en curso`, tone: "amber" } : undefined}
      cta={{ label: openSupportCount > 0 ? "Ver mis casos" : "Abrir un caso", href: "/students/support" }}
    >
      <p>
        {openSupportCount > 0
          ? "Tenés casos en seguimiento con EstuRed."
          : "¿Algo no salió como esperabas con una residencia? Estamos para ayudarte."}
      </p>
    </ModuleCard>
  );

  const greetName = firstName ? `Hola, ${firstName}.` : "Hola.";
  const heroTitle = isHoused
    ? `${greetName} Ya tenés tu lugar.`
    : activeApplication
      ? activeVisible?.studentActionRequired
        ? `${greetName} Tenés un paso por hacer.`
        : `${greetName} Tu solicitud sigue su camino.`
      : `${greetName} Armemos tu camino a la residencia.`;
  const heroSubtitle = isHoused
    ? "Tu estadía, tu comunidad y tus renovaciones, en un solo lugar."
    : activeApplication
      ? "Acá ves cómo va y qué sigue."
      : "Con el perfil completo, las residencias te conocen mejor.";

  return (
    <div className="tone-student mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <PageHero
        tone="student"
        eyebrow={isHoused ? "Tu casa" : "Tu camino"}
        eyebrowIcon="backpack"
        title={heroTitle}
        subtitle={heroSubtitle}
        glyph={isHoused ? "home_work" : activeApplication ? "hourglass_top" : "travel_explore"}
        status={
          isHoused ? (
            <>
              <Badge tone="sage">
                <Icon name="check_circle" className="text-sm" /> Estadía activa
              </Badge>
              {contract && <Badge tone="neutral">Hasta {contractEndLabel}</Badge>}
            </>
          ) : activeApplication && activeVisible ? (
            <Badge tone={activeVisible.tone}>
              <Icon name={activeVisible.studentActionRequired ? "priority_high" : "schedule"} className="text-sm" /> {activeVisible.label}
            </Badge>
          ) : (
            <Badge tone={completenessPercent >= 100 ? "sage" : "amber"}>
              <Icon name={completenessPercent >= 100 ? "check_circle" : "edit_note"} className="text-sm" />
              {completenessPercent >= 100 ? "Perfil completo" : `Perfil al ${completenessPercent} %`}
            </Badge>
          )
        }
        cta={
          isHoused
            ? { label: "Ir a mi residencia", href: "/students/residency" }
            : { ...nextStep.primary, note: activeApplication ? "Sujeta a confirmación" : "Sin compromiso" }
        }
      />

      {headerBanners}

      {!isHoused && (
        <Reveal delay={1} className="mt-6">
          <NextStepCard step={nextStep} />
        </Reveal>
      )}

      {showArrival && arrival && arrivalDays !== null && arrivalGuides && (
        <Reveal delay={1} className="mt-6">
          <ArrivalCard
            reservationId={arrival.id}
            residenceName={arrival.residenceName}
            startDateLabel={formatDateOnly(arrival.start_date)}
            daysLeft={arrivalDays}
            initialChecked={arrivalChecked.byReservation.get(arrival.id) ?? []}
            persistent={arrivalChecked.persistent}
            {...arrivalGuides}
          />
        </Reveal>
      )}

      {isHoused && reservation && residence && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Reveal delay={1} className="h-full">
              <MetricCard
                icon="event"
                label="Ingreso"
                value={formatDateOnly(reservation.start_date)}
                hint={reservation.room_types?.name ?? undefined}
                className="h-full"
              />
            </Reveal>
            <Reveal delay={2} className="h-full">
              <MetricCard
                icon="hourglass_bottom"
                label={contract?.renewedUntil ? "Renovada hasta" : "Fin de contrato"}
                value={contractEndLabel}
                hint={remaining > 0 ? `Faltan ${remaining} días` : "Contrato vencido"}
                className="h-full"
              />
            </Reveal>
            <Reveal delay={3} className="h-full">
              <MetricCard
                icon="payments"
                label="Valor mensual"
                value={`USD ${contract?.currentRateUsd ?? reservation.application_snapshots?.monthly_price_usd ?? "—"}`}
                hint="Se paga a la residencia"
                className="h-full"
              />
            </Reveal>
          </div>

          <Reveal delay={2} className="mt-6">
            <Card className="overflow-hidden p-0">
              <div className="grid grid-cols-1 lg:grid-cols-5">
                <div className="relative h-56 lg:col-span-2 lg:h-auto">
                  <PhotoCarousel photos={residencePhotos} alt={residence.name} zone={residence.public_area ?? undefined} />
                </div>
                <div className="flex flex-col justify-between gap-5 p-6 lg:col-span-3">
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-display text-xl font-bold text-ink md:text-2xl">{residence.name}</h2>
                        <p className="mt-1 flex items-center gap-1 text-sm text-ink-soft">
                          <Icon name="location_on" className="text-base" />
                          {residence.public_area}, CABA
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-forest-tint px-3 py-1 text-xs font-bold uppercase tracking-wide text-forest-700">
                        <span className="size-2 rounded-full bg-forest-600" /> Alojado
                      </span>
                    </div>
                    {contract?.differs && (
                      <StayRateNote
                        agreedRateUsd={contract.agreedRateUsd}
                        currentRateUsd={contract.currentRateUsd}
                        className="mt-4"
                      />
                    )}
                  </div>

                  {heroAlerts.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {heroAlerts.map((a) => (
                        <Link
                          key={a.label}
                          href={a.href}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-orange bg-orange-tint px-3 py-1.5 text-xs font-semibold text-orange-700 transition-colors hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
                        >
                          <Icon name={a.icon} className="text-sm" />
                          {a.label}
                        </Link>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <Button href="/students/residency" size="sm">
                      Ver residencia
                    </Button>
                    <Button href="/students/residency#comunidad" size="sm" variant="outline">
                      Ver comunidad
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </Reveal>
        </>
      )}

      <h2 className="mt-8 font-display text-lg font-bold text-ink">{isHoused ? "Tu espacio" : "Qué podés hacer ahora"}</h2>
      <div className="mt-3 grid grid-cols-1 items-stretch gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {!isHoused && (
          <Reveal delay={0} className="h-full">
            <ModuleCard
              href="/search"
              icon="search"
              title="Buscar residencias"
              cta={{ label: "Ver catálogo", href: "/search" }}
            >
              <p>Catálogo en CABA, con reglas, servicios y precios claros.</p>
            </ModuleCard>
          </Reveal>
        )}

        {isHoused && reservation && (
          <Reveal delay={0} className="h-full">
            <ExpandableCard
              tone="student"
              className="h-full"
              defaultOpen={Boolean(renewalStatus)}
              summary={
                <div className="flex items-center gap-3">
                  <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-[14px] ${
                      renewalStatus ? "bg-orange-tint text-orange-700" : "bg-forest-tint text-forest-700"
                    }`}
                  >
                    <Icon name="sync" className="text-2xl" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-display font-bold text-ink">Renovaciones</p>
                    <p className="break-words text-xs text-ink-faint">{renewalStatus ? renewalStatus.label : "Sin renovación en curso"}</p>
                  </div>
                </div>
              }
            >
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div className="min-w-0">
                  <dt className="text-xs text-ink-faint">{contract?.renewedUntil ? "Renovada hasta" : "Fin de contrato"}</dt>
                  <dd className="break-words font-semibold text-ink">{contractEndLabel}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-ink-faint">Restante</dt>
                  <dd className="font-semibold text-ink">{remaining > 0 ? `${remaining} días` : "Vencido"}</dd>
                </div>
              </dl>
              <div className="mt-4 border-t border-line pt-4">
                {renewalStatus ? (
                  <Link
                    href="/students/renewals"
                    className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border-[1.5px] border-line px-4 py-2 text-center text-sm font-semibold text-ink hover:border-forest hover:bg-forest-tint"
                  >
                    Ver renovaciones
                  </Link>
                ) : (
                  <StartRenewalModal
                    reservationId={reservation.id}
                    roomTypeName={reservation.room_types?.name ?? null}
                    currentEndDateLabel={contractEndLabel}
                    monthlyPriceUsd={contract?.currentRateUsd ?? reservation.application_snapshots?.monthly_price_usd ?? null}
                    minimumStayMonths={reservation.residences?.minimum_stay_months ?? null}
                    triggerLabel="Iniciar renovación"
                    triggerVariant="outline"
                  />
                )}
              </div>
            </ExpandableCard>
          </Reveal>
        )}

        <Reveal delay={1} className="h-full">{perfilCard}</Reveal>
        <Reveal delay={2} className="h-full">{solicitudesCard}</Reveal>
        <Reveal delay={3} className="h-full">{favoritosCard}</Reveal>
        <Reveal delay={4} className="h-full">{listaEsperaCard}</Reveal>
        <Reveal delay={5} className="h-full">{vinculacionCard}</Reveal>
        <Reveal delay={5} className="h-full">{soporteCard}</Reveal>
      </div>

      {suggestedResidences.length > 0 && (
        <section className="mt-10" aria-labelledby="residencias-para-mirar">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="residencias-para-mirar" className="font-display text-lg font-bold text-ink">
              Residencias verificadas para mirar
            </h2>
            <Link href="/search" className="inline-flex min-h-11 items-center text-sm font-bold text-forest-700 hover:underline">
              Ver todas
            </Link>
          </div>
          <ul className="grid gap-3.5 sm:grid-cols-3">
            {suggestedResidences.map((r, i) => (
              <li key={r.slug}>
                <Reveal delay={Math.min(i, 5) as 0 | 1 | 2 | 3 | 4 | 5} className="h-full">
                  <Link
                    href={`/residencias/${r.slug}`}
                    className="group relative grid h-full overflow-hidden rounded-card border-[1.5px] border-line bg-paper shadow-card transition-all duration-300 ease-bounce hover:-translate-y-1 hover:shadow-card-hover focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest"
                  >
                    <span className="relative block h-32 bg-sand-200">
                      <ResidencePhoto src={r.photos[0]} name={r.name} zone={r.zone} alt="" sizes="(max-width: 640px) 90vw, 30vw" variant="card" />
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-forest-tint px-2.5 py-1 text-xs font-semibold text-forest-700">
                        <Icon name="verified" className="text-sm" />
                        Verificada
                      </span>
                    </span>
                    <span className="grid px-3.5 pb-3 pt-2.5">
                      <b className="font-display text-[15px] font-bold text-ink">{r.name}</b>
                      <span className="text-[13px] text-ink-faint">
                        {r.zone}
                        {r.roomTypes.length > 0 && ` · ${Array.from(new Set(r.roomTypes.map((t) => t.type))).join(" · ")}`}
                      </span>
                    </span>
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Lectura (Centro de Guías): solo enlaces, según etapa. Con ingreso futuro la guía 02 ya va en «Tu llegada» (sin duplicar). */}
      <GuidePicks
        keys={!isHoused ? ["01", "02"] : ["04", "03"]}
        variant="panel"
        title={!isHoused ? "Para ir preparándote" : "Para leer con calma"}
        className="mt-10"
      />
    </div>
  );
}
