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
import { ModuleCard } from "@/components/students/ModuleCard";
import { PhotoCarousel } from "@/components/students/PhotoCarousel";
import { ResidencePhoto } from "@/components/residences/ResidencePhoto";
import { getStudentProfileCompleteness } from "@/lib/students/profileCompleteness";
import { getCatalogResidences } from "@/lib/residences/catalog";
import { formatDateOnly } from "@/lib/students/contractEnd";
import { loadStudentContracts, type StudentContract } from "@/lib/students/loadStudentContracts";
import { StayRateNote } from "@/components/students/StayRateNote";
import { getVisibleStatus } from "@/lib/applications/visibleStatus";
import { loadReservationInfoByApplication, type ReservationInfo } from "@/lib/applications/loadReservationInfo";

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
  tutor: "Tutor/a",
  familiar: "Familiar",
};

/** Estados que ya no requieren seguimiento activo del estudiante en soporte. */
const SUPPORT_CLOSED_STATUSES = ["resolved_by_agreement", "closed_no_action", "closed_unresolved", "admin_action_taken"];

export default async function StudentDashboardPage() {
  const sessionUser = await getSessionUser();
  const supabase = await getSupabaseServer();
  const isFamilyMember = sessionUser?.roles.includes("family_member") ?? false;

  if (isFamilyMember) {
    let links: FamilyLinkRow[] = [];
    let sentProposals: SentProposalRow[] = [];
    if (supabase) {
      const { data } = await supabase
        .from("family_links")
        .select("id, status, student_profiles(first_name, last_initial)")
        .order("created_at", { ascending: false });
      links = (data as unknown as FamilyLinkRow[]) ?? [];

      const { data: proposalData } = await supabase
        .from("family_application_proposals")
        .select("id, status, residences(name), student_profiles(first_name, last_initial)")
        .order("created_at", { ascending: false })
        .limit(5);
      sentProposals = (proposalData as unknown as SentProposalRow[]) ?? [];
    }

    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-3xl font-bold text-ink">Tu espacio de familiar</h1>
        <p className="mt-2 text-ink-soft">
          Acompañás a estos estudiantes en EstuRed. Solo ellos pueden decidir sobre sus
          solicitudes.
        </p>

        <div className="mt-8 space-y-4">
          {links.length === 0 ? (
            <Card className="p-6 text-sm text-ink-soft">
              Todavía no tenés vínculos registrados.
            </Card>
          ) : (
            links.map((l) => (
              <Card key={l.id} className="flex items-center justify-between p-6">
                <div>
                  <p className="font-bold text-ink">
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
                <Badge tone={l.status === "active" ? "sage" : "amber"}>
                  {l.status === "pending_student_approval"
                    ? "Pendiente"
                    : l.status === "active"
                      ? "Activo"
                      : "Cerrado"}
                </Badge>
              </Card>
            ))
          )}
        </div>

        <Card className="mt-8 flex flex-col p-6">
          <h2 className="font-bold text-ink">Explorar residencias</h2>
          <p className="mt-2 flex-1 text-sm text-ink-soft">
            Podés proponerle opciones al estudiante que acompañás — él o ella decide si aprobarlas.
          </p>
          <Button href="/search" size="sm" className="mt-4 self-start">
            Buscar residencia
          </Button>
        </Card>

        {sentProposals.length > 0 && (
          <Card className="mt-6 p-6">
            <h2 className="font-bold text-ink">Propuestas que enviaste</h2>
            <div className="mt-4 space-y-3">
              {sentProposals.map((p) => {
                const status = PROPOSAL_STATUS_LABEL[p.status] ?? PROPOSAL_STATUS_LABEL.pending_student_approval;
                return (
                  <div key={p.id} className="flex items-center justify-between border-b border-line pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-semibold text-ink">{p.residences?.name}</p>
                      <p className="text-xs text-ink-faint">
                        Para {formatShortName(p.student_profiles?.first_name, p.student_profiles?.last_initial)}
                      </p>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
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
          const allResidences = await getCatalogResidences();
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

    const { data } = await supabase
      .from("family_links")
      .select("id, status, family_members(first_name, last_name, relationship_type)")
      .order("created_at", { ascending: false });
    studentLinks = (data as unknown as StudentLinkRow[]) ?? [];

    const { count } = await supabase
      .from("family_application_proposals")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_student_approval")
      .gt("expires_at", new Date().toISOString());
    pendingProposalsCount = count ?? 0;

    const { data: reservationData, error: reservationError } = await supabase
      .from("reservations")
      .select(
        "id, start_date, initial_duration_months, booking_receipt_id, residences(id, name, public_area, slug, minimum_stay_months), room_types(name), application_snapshots(monthly_price_usd)",
      )
      .eq("status", "confirmed")
      .order("confirmed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
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

      const { data: renewalRequest } = await supabase
        .from("renewal_requests")
        .select("id, status")
        .eq("reservation_id", reservation.id)
        .order("created_at", { ascending: false })
        .maybeSingle();
      const { data: renewalOffer } = await supabase
        .from("renewal_offers")
        .select("id, status")
        .eq("reservation_id", reservation.id)
        .order("created_at", { ascending: false })
        .maybeSingle();
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

    const { data: appRows } = await supabase
      .from("application_requests")
      .select("id, status, created_at, residences(name), room_types(name)")
      .order("created_at", { ascending: false });
    applications = (appRows as unknown as ApplicationSummaryRow[]) ?? [];
    // H01: estado visible = solicitud + reserva asociada (la reserva manda).
    reservationInfoByAppId = await loadReservationInfoByApplication(
      supabase,
      applications.filter((a) => a.status === "converted_to_reservation").map((a) => a.id),
    );

    const { data: waitlistRows } = await supabase
      .from("waitlist_entries")
      .select("id, status")
      .in("status", ["active", "availability_notification_sent", "retention_check_sent"]);
    waitlistCount = waitlistRows?.length ?? 0;
    waitlistNeedsAction = (waitlistRows ?? []).some((w) => w.status !== "active");
  }

  const pendingLinks = studentLinks.filter((l) => l.status === "pending_student_approval");
  const activeLink = studentLinks.find((l) => l.status === "active");
  const isHoused = reservation !== null;
  const residence = reservation?.residences ?? null;
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

  const heroAlerts: { icon: string; label: string; href: string }[] = [];
  if (renewalStatus) heroAlerts.push({ icon: "sync", label: renewalStatus.label, href: "/students/renewals" });
  if (docsUploadedCount < 2)
    heroAlerts.push({ icon: "folder_shared", label: "Documentación pendiente", href: "/students/profile" });

  const headerBanners = (
    <>
      {pendingProposalsCount > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-card border border-line-2 bg-forest-tint p-5">
          <div>
            <p className="font-semibold text-ink">
              {pendingProposalsCount === 1
                ? "Tu familiar te sugirió una residencia"
                : `Tu familiar te sugirió ${pendingProposalsCount} residencias`}
            </p>
            <p className="mt-1 text-sm text-ink-soft">Tenés 48 horas para aprobar o rechazar cada propuesta.</p>
          </div>
          <Button href="/students/family-proposals" size="sm">
            Ver propuestas
          </Button>
        </div>
      )}

      {pendingLinks.map((link) => (
        <div
          key={link.id}
          className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-card border border-line-2 bg-forest-tint p-5"
        >
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
      cta={completenessPercent < 100 ? { label: "Completar perfil", href: "/students/profile" } : undefined}
      animationDelayMs={40}
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
      animationDelayMs={80}
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
    <ModuleCard href="/students/favorites" icon="favorite" title="Favoritos" animationDelayMs={120}>
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
      badge={waitlistNeedsAction ? { label: "¡Hay lugar!", tone: "amber" } : undefined}
      animationDelayMs={160}
    >
      {waitlistCount > 0 ? (
        <p className="font-semibold text-ink">
          En {waitlistCount} lista{waitlistCount > 1 ? "s" : ""} de espera
        </p>
      ) : (
        <p>Cuando una residencia no tenga lugar, vas a poder sumarte desde su ficha.</p>
      )}
    </ModuleCard>
  );

  const vinculacionCard = (
    <div id="vinculacion" className="benefit-fade-in scroll-mt-24" style={{ animationDelay: "200ms" }}>
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
      animationDelayMs={240}
    >
      <p>
        {openSupportCount > 0
          ? "Tenés casos en seguimiento con EstuRed."
          : "¿Algo no salió como esperabas con una residencia? Estamos para ayudarte."}
      </p>
    </ModuleCard>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-ink md:text-3xl">
          {isHoused ? "¡Ya estás alojado/a!" : firstName ? `¡Hola, ${firstName}!` : "¡Hola!"}
        </h1>
        <p className="max-w-3xl text-ink-soft">
          {isHoused
            ? "Todo lo que necesitás sobre tu estadía y tu cuenta, en un solo lugar."
            : "Tu centro de control en EstuRed — accedé rápido a cada sección de tu búsqueda."}
        </p>
      </div>

      {headerBanners}

      {isHoused && reservation && residence && (
        <Card className="mt-8 overflow-hidden p-0">
          <div className="grid grid-cols-1 lg:grid-cols-5">
            <div className="relative h-64 lg:col-span-2 lg:h-auto">
              <PhotoCarousel photos={residencePhotos} alt={residence.name} zone={residence.public_area ?? undefined} />
            </div>
            <div className="flex flex-col justify-between gap-5 p-6 lg:col-span-3">
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-ink md:text-2xl">{residence.name}</h2>
                    <p className="mt-1 flex items-center gap-1 text-sm text-ink-soft">
                      <Icon name="location_on" className="text-base" />
                      {residence.public_area}, CABA
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-forest-tint px-3 py-1 text-xs font-bold uppercase tracking-wide text-forest-700">
                    <span className="size-2 rounded-full bg-forest-600" /> Alojado
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-ink-faint">Habitación</p>
                    <p className="font-bold text-ink">{reservation.room_types?.name ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-faint">Valor mensual</p>
                    <p className="font-bold text-ink">
                      USD {contract?.currentRateUsd ?? reservation.application_snapshots?.monthly_price_usd ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-faint">Ingreso</p>
                    <p className="font-medium text-ink">{formatDateOnly(reservation.start_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-faint">{contract?.renewedUntil ? "Renovada hasta" : "Fin de contrato"}</p>
                    <p className="font-medium text-ink">{contractEndLabel}</p>
                  </div>
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
                      className="inline-flex items-center gap-1.5 rounded-full border border-line-2 bg-cream-2 px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:border-forest hover:bg-forest-tint hover:text-forest-700"
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
      )}

      <div className="mt-6 grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {!isHoused && (
          <ModuleCard
            href="/search"
            icon="search"
            iconTone="amber"
            title="Buscar residencias"
            className="border-dashed"
            cta={{ label: "Ver catálogo", href: "/search" }}
            animationDelayMs={0}
          >
            <p>Catálogo de residencias en CABA, con reglas, servicios y precios claros.</p>
          </ModuleCard>
        )}

        {isHoused && reservation && (
          <div className="benefit-fade-in" style={{ animationDelay: "0ms" }}>
            <ExpandableCard
              defaultOpen={Boolean(renewalStatus)}
              summary={
                <div className="flex items-center gap-3">
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                      renewalStatus ? "bg-orange-tint text-orange-700" : "bg-forest-tint text-forest-700"
                    }`}
                  >
                    <Icon name="sync" className="text-xl" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-ink">Renovaciones</p>
                    <p className="truncate text-xs text-ink-faint">{renewalStatus ? renewalStatus.label : "Sin renovación en curso"}</p>
                  </div>
                </div>
              }
            >
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-ink-faint">{contract?.renewedUntil ? "Renovada hasta" : "Fin de contrato"}</dt>
                  <dd className="font-semibold text-ink">{contractEndLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-faint">Restante</dt>
                  <dd className="font-semibold text-ink">{remaining > 0 ? `${remaining} días` : "Vencido"}</dd>
                </div>
              </dl>
              <div className="mt-4 border-t border-line pt-4">
                {renewalStatus ? (
                  <Link
                    href="/students/renewals"
                    className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-line px-4 py-2 text-sm font-semibold text-ink hover:border-forest hover:bg-forest-tint"
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
          </div>
        )}

        {perfilCard}
        {solicitudesCard}
        {favoritosCard}
        {listaEsperaCard}
        {vinculacionCard}
        {soporteCard}
      </div>
    </div>
  );
}
