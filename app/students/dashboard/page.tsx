import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { FamilyLinkActions } from "@/app/students/FamilyLinkActions";
import { getStudentProfileCompleteness } from "@/lib/students/profileCompleteness";
import { getCatalogResidences } from "@/lib/residences/catalog";

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
type ActiveApplicationRow = {
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
  residences: { name: string; public_area: string; slug: string } | null;
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

const APPLICATION_STATUS_LABEL: Record<string, { label: string; tone: "amber" | "sage" | "neutral" | "petrol" }> = {
  submitted: { label: "Enviada — esperando respuesta", tone: "amber" },
  queued_for_place: { label: "En cola", tone: "neutral" },
  under_review: { label: "En revisión", tone: "amber" },
  contact_established: { label: "Contacto establecido", tone: "sage" },
  offer_pending_student_acceptance: { label: "Te propusieron un ajuste", tone: "amber" },
  conditions_accepted: { label: "Condiciones aceptadas", tone: "sage" },
  residence_payment_pending: { label: "Pagá a la residencia", tone: "amber" },
  residence_payment_reported: { label: "Pago informado", tone: "sage" },
  paused_due_to_other_active_request: { label: "Pausada", tone: "neutral" },
};

const RELATIONSHIP_LABEL: Record<string, string> = {
  padre: "Padre",
  madre: "Madre",
  tutor: "Tutor/a",
  familiar: "Familiar",
};

/**
 * `dateStr` es una columna `date` (sin hora) — parsear con `new Date(dateStr)`
 * la interpreta como medianoche UTC, y formatear después en un huso horario
 * negativo (Argentina) corre el día mostrado uno para atrás. Se arma y se
 * formatea todo en UTC para que el cálculo de fecha no dependa del huso del
 * usuario.
 */
function addMonthsDateOnly(dateStr: string, months: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1 + months, day));
  return result.toLocaleDateString("es-AR", { timeZone: "UTC" });
}

function daysRemaining(startDateStr: string, months: number): number {
  const [year, month, day] = startDateStr.split("-").map(Number);
  const end = new Date(Date.UTC(year, month - 1 + months, day));
  return Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

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
                    {l.student_profiles?.first_name} {l.student_profiles?.last_initial}
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
                        Para {p.student_profiles?.first_name} {p.student_profiles?.last_initial}
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
  let firstName: string | null = null;
  let isMinor = false;
  let studentLinks: StudentLinkRow[] = [];
  let pendingProposalsCount = 0;
  let reservation: ReservationRow | null = null;
  let latestApplication: ActiveApplicationRow | null = null;
  let waitlistCount = 0;
  let renewalStatus: { label: string; tone: "amber" | "sage" | "neutral" | "danger" } | null = null;
  let completenessPercent = 100;
  let completenessMissing: string[] = [];
  let docsUploadedCount = 0;
  let favoritesPreview: FavoritePreview[] = [];
  let favoritesTotal = 0;

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
        const { data: docFiles } = await admin
          .from("files")
          .select("document_type")
          .eq("related_entity_type", "student_profiles")
          .eq("related_entity_id", profile.id)
          .in("document_type", ["student_identity", "student_academic_proof"]);
        docsUploadedCount = new Set((docFiles ?? []).map((f) => f.document_type)).size;

        const { data: favoriteRows, count } = await admin
          .from("student_favorites")
          .select("id, residence_id, added_by_role", { count: "exact" })
          .eq("student_profile_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(3);
        favoritesTotal = count ?? 0;
        const rows = (favoriteRows ?? []) as FavoriteRow[];
        if (rows.length > 0) {
          const allResidences = await getCatalogResidences();
          const { data: slugRows } = await admin
            .from("residences")
            .select("id, slug")
            .in("id", rows.map((r) => r.residence_id));
          const slugById = new Map((slugRows ?? []).map((r) => [r.id, r.slug]));
          const residenceBySlug = new Map(allResidences.map((r) => [r.slug, r]));
          favoritesPreview = rows
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

    const { data: reservationData } = await supabase
      .from("reservations")
      .select(
        "id, start_date, initial_duration_months, booking_receipt_id, residences(name, public_area, slug), room_types(name), application_snapshots(monthly_price_usd)",
      )
      .eq("status", "confirmed")
      .order("confirmed_at", { ascending: false })
      .maybeSingle();
    reservation = reservationData as unknown as ReservationRow | null;

    if (reservation) {
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
      } else if (renewalRequest && renewalRequest.status === "notified_to_residence") {
        renewalStatus = { label: "Tu solicitud de renovación está esperando respuesta", tone: "amber" };
      } else if (renewalOffer?.status === "confirmed" || renewalOffer?.status === "receipt_issued") {
        renewalStatus = { label: "Ya renovaste tu estadía", tone: "sage" };
      }
    } else {
      const { data: appData } = await supabase
        .from("application_requests")
        .select("id, status, created_at, residences(name), room_types(name)")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      latestApplication = appData as unknown as ActiveApplicationRow | null;
    }

    const { count: waitlistActiveCount } = await supabase
      .from("waitlist_entries")
      .select("*", { count: "exact", head: true })
      .in("status", ["active", "availability_notification_sent", "retention_check_sent"]);
    waitlistCount = waitlistActiveCount ?? 0;
  }

  const pendingLinks = studentLinks.filter((l) => l.status === "pending_student_approval");
  const activeLink = studentLinks.find((l) => l.status === "active");
  const isHoused = reservation !== null;

  const headerBanners = (
    <>
      {isHoused && completenessPercent < 100 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-card border border-line-2 bg-cream-2 p-5">
          <div>
            <p className="font-semibold text-ink">Tu perfil está {completenessPercent}% completo</p>
            <p className="mt-1 text-sm text-ink-soft">
              Completá {completenessMissing.join(", ")} para aumentar tus probabilidades de ser aceptado.
            </p>
          </div>
          <Button href="/students/profile" size="sm" variant="outline">
            Completar perfil
          </Button>
        </div>
      )}

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
            Para poder enviar solicitudes de reserva, un padre, madre o familiar debe crear su cuenta en la
            sección <span className="font-semibold">Crear cuenta → Familiar</span> y vos aprobar la vinculación
            acá. Mientras tanto podés explorar y guardar
            residencias.
          </p>
        </div>
      )}
    </>
  );

  const sidebar = (
    <div className="flex flex-col gap-5">
      {isHoused && (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Documentación de tu estadía</p>
            <Icon name="folder_shared" className="text-lg text-muted" />
          </div>
          <p className="text-sm font-bold text-ink">{docsUploadedCount} de 2 documentos cargados</p>
          <p className="mt-1 text-xs text-ink-soft">
            {docsUploadedCount >= 2
              ? "Documentación al día."
              : "DNI/pasaporte y comprobante de estudio, para tu perfil ante la residencia."}
          </p>
          {docsUploadedCount < 2 && (
            <Link href="/students/profile" className="mt-3 inline-block text-sm font-semibold text-forest-700 hover:underline">
              Completar documentación →
            </Link>
          )}
        </Card>
      )}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Vinculación familiar</p>
          <Icon name="link" className="text-lg text-muted" />
        </div>
        {activeLink ? (
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-forest-tint p-2">
              <Icon name="verified_user" className="text-lg text-forest-700" />
            </div>
            <div>
              <p className="text-sm font-bold text-ink">Cuenta vinculada</p>
              <p className="text-xs text-ink-faint">
                {RELATIONSHIP_LABEL[activeLink.family_members?.relationship_type ?? "familiar"]}{" "}
                {activeLink.family_members?.first_name}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Sin familiar vinculado todavía.</p>
        )}
      </Card>
      {waitlistCount > 0 && (
        <Link
          href="/students/waitlist"
          className="flex items-center gap-3 rounded-card border-[1.5px] border-line bg-paper px-4 py-3 text-sm font-semibold text-ink-soft hover:bg-cream-2"
        >
          <Icon name="hourglass_top" className="text-lg text-orange-700" />
          En {waitlistCount} lista{waitlistCount > 1 ? "s" : ""} de espera
          <Icon name="chevron_right" className="ml-auto text-lg" />
        </Link>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-ink md:text-3xl">
          {isHoused
            ? "¡Ya estás alojado/a!"
            : firstName
              ? `¡Hola, ${firstName}!`
              : "¡Hola!"}
        </h1>
        <p className="max-w-3xl text-ink-soft">
          {isHoused
            ? "Acá vas a ver tu estadía y todo lo necesario para tu convivencia."
            : "Tu cuenta está lista. Desde acá vas a seguir toda tu búsqueda."}
        </p>
      </div>

      {headerBanners}

      {!isHoused && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link
            href="/students/profile"
            className="group flex flex-col gap-3 rounded-card border-[1.5px] border-line bg-paper p-5 transition-colors hover:border-forest hover:bg-forest-tint"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Tu perfil</p>
              <div
                className="relative flex size-11 shrink-0 items-center justify-center rounded-full text-xs font-bold text-forest-700"
                style={{
                  background: `conic-gradient(var(--color-forest-600) ${completenessPercent}%, var(--color-line-2) 0)`,
                }}
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-paper">
                  {completenessPercent}%
                </span>
              </div>
            </div>
            <p className="text-sm font-semibold text-ink">
              {completenessPercent >= 100 ? "Perfil completo" : "Completá tu perfil"}
            </p>
            <p className="text-xs text-ink-soft">
              {completenessPercent >= 100
                ? "Las residencias ven tu solicitud como más seria."
                : `Falta: ${completenessMissing.slice(0, 2).join(", ")}${completenessMissing.length > 2 ? "…" : ""}`}
            </p>
          </Link>

          <Link
            href="/students/profile"
            className="group flex flex-col gap-3 rounded-card border-[1.5px] border-line bg-paper p-5 transition-colors hover:border-forest hover:bg-forest-tint"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Documentación</p>
              <Icon
                name={docsUploadedCount >= 2 ? "task_alt" : "folder_shared"}
                className={`text-xl ${docsUploadedCount >= 2 ? "text-forest-700" : "text-ink-faint"}`}
              />
            </div>
            <p className="text-sm font-semibold text-ink">{docsUploadedCount} de 2 documentos</p>
            <p className="text-xs text-ink-soft">
              {docsUploadedCount >= 2 ? "Documentación al día." : "DNI/pasaporte y comprobante de estudio."}
            </p>
          </Link>

          <Link
            href="/search"
            className="group flex flex-col gap-3 rounded-card border-[1.5px] border-dashed border-line-2 bg-cream-2 p-5 transition-colors hover:border-forest hover:bg-forest-tint"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Mi residencia</p>
              <Icon name="apartment" className="text-xl text-ink-faint" />
            </div>
            <p className="text-sm font-semibold text-ink">Todavía no tenés residencia</p>
            <p className="text-xs text-ink-soft">Acá vas a ver tu estadía en cuanto confirmes una reserva.</p>
          </Link>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {isHoused && reservation ? (
            <>
              <Card className="overflow-hidden p-0">
                <div className="flex items-start justify-between border-b border-line p-6">
                  <div>
                    <h2 className="text-xl font-bold text-ink">Mi residencia</h2>
                    <p className="mt-1 flex items-center gap-1 text-sm text-ink-soft">
                      <Icon name="location_on" className="text-base" />
                      {reservation.residences?.name} · {reservation.residences?.public_area}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-forest-tint px-3 py-1 text-xs font-bold uppercase tracking-wide text-forest-700">
                    <span className="size-2 rounded-full bg-forest-600" /> Alojado
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Tu estadía</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-ink-faint">Tipo de habitación</p>
                        <p className="font-bold text-ink">{reservation.room_types?.name ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-ink-faint">Valor mensual</p>
                        <p className="font-bold text-ink">
                          USD {reservation.application_snapshots?.monthly_price_usd ?? "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-ink-faint">Fecha de ingreso</p>
                        <p className="font-medium text-ink">{reservation.start_date}</p>
                      </div>
                      <div>
                        <p className="text-xs text-ink-faint">Fin estimado</p>
                        <p className="font-medium text-ink">
                          {addMonthsDateOnly(reservation.start_date, reservation.initial_duration_months)}
                        </p>
                        {(() => {
                          const remaining = daysRemaining(reservation.start_date, reservation.initial_duration_months);
                          if (remaining <= 0) return null;
                          return (
                            <p className="mt-0.5 text-xs text-ink-faint">
                              {remaining < 60 ? `Quedan ${remaining} días` : `Quedan ~${Math.round(remaining / 30)} meses`}
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {renewalStatus && (
                      <div className="flex items-start gap-3 rounded-field border border-line-2 bg-orange-tint p-3">
                        <Icon name="notifications_active" className="mt-0.5 text-lg text-orange-700" />
                        <div>
                          <p className="text-sm font-bold text-orange-700">{renewalStatus.label}</p>
                          <Link href="/students/renewals" className="mt-0.5 text-xs font-semibold text-orange-700 underline">
                            Ver renovaciones →
                          </Link>
                        </div>
                      </div>
                    )}
                    <Link
                      href={`/residencias/${reservation.residences?.slug}/comunidad`}
                      className="flex items-center gap-3 rounded-field border border-line p-3 text-sm font-semibold text-ink hover:border-forest hover:bg-forest-tint"
                    >
                      <Icon name="groups" className="text-lg text-forest-700" /> Ver comunidad de la residencia
                    </Link>
                    {reservation.booking_receipt_id && (
                      <Link
                        href={`/students/receipts/${reservation.booking_receipt_id}`}
                        className="flex items-center gap-3 rounded-field border border-line p-3 text-sm font-semibold text-ink hover:border-forest hover:bg-forest-tint"
                      >
                        <Icon name="receipt_long" className="text-lg text-forest-700" /> Ver comprobante de reserva
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
              {!renewalStatus && (
                <div className="rounded-card border border-dashed border-line-2 bg-cream-2 p-5 text-sm text-ink-soft">
                  ¿Se acerca el fin de tu estadía?{" "}
                  <Link href="/students/renewals" className="font-semibold text-forest-700 hover:underline">
                    Solicitá tu renovación
                  </Link>
                  , sin plazos mínimos de anticipación.
                </div>
              )}
            </>
          ) : (
            <section>
              <h2 className="mb-4 text-xl font-bold text-ink">Solicitud activa</h2>
              {latestApplication ? (
                <Card className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-ink">{latestApplication.residences?.name}</p>
                    <p className="text-sm text-ink-soft">{latestApplication.room_types?.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={APPLICATION_STATUS_LABEL[latestApplication.status]?.tone ?? "neutral"}>
                      {APPLICATION_STATUS_LABEL[latestApplication.status]?.label ?? latestApplication.status}
                    </Badge>
                    <Button href="/students/applications" size="sm" variant="outline">
                      Ver todas
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line-2 bg-cream-2 p-8 text-center">
                  <div className="mb-4 rounded-full bg-paper p-4 shadow-sm">
                    <Icon name="travel_explore" className="text-4xl text-forest-700" />
                  </div>
                  <h3 className="text-lg font-bold text-ink">No tenés solicitudes pendientes</h3>
                  <p className="mt-2 max-w-md text-ink-soft">
                    Explorá el catálogo y enviá tu primera solicitud para asegurar tu lugar.
                  </p>
                  <Button href="/search" size="md" className="mt-6">
                    Buscar residencias ahora
                  </Button>
                </div>
              )}
            </section>
          )}

          {favoritesPreview.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-ink">Favoritos recientes</h2>
                <Link href="/students/favorites" className="text-sm font-semibold text-forest-700 hover:underline">
                  Ver los {favoritesTotal} →
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {favoritesPreview.map((f) => (
                  <Link
                    key={f.slug}
                    href={`/residencias/${f.slug}`}
                    className="group overflow-hidden rounded-card border-[1.5px] border-line bg-paper transition-colors hover:border-forest"
                  >
                    <div className="relative h-28 w-full overflow-hidden bg-sand-200">
                      {f.photo && (
                        <Image
                          src={f.photo}
                          alt={`Foto de ${f.name}`}
                          fill
                          sizes="(max-width: 640px) 100vw, 33vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      )}
                      {f.addedByFamily && (
                        <span className="absolute left-2 top-2 rounded-full bg-paper/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                          Sugerido
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-bold text-ink">{f.name}</p>
                      <p className="truncate text-xs text-ink-faint">{f.zone}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {!isHoused && (
            <Card className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-forest-tint p-3">
                  <Icon name="search" className="text-2xl text-forest-700" />
                </div>
                <div>
                  <h2 className="font-bold text-ink">Buscar residencias</h2>
                  <p className="text-sm text-ink-soft">Catálogo de residencias en CABA, con reglas, servicios y precios claros.</p>
                </div>
              </div>
              <Button href="/search" size="sm" className="shrink-0">
                Ver catálogo
              </Button>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1">{sidebar}</div>
      </div>

      <p className="mt-8 text-xs text-ink-faint">
        ¿Dudas o problemas con tu cuenta?{" "}
        <Link href="/students/support" className="text-forest-700 hover:underline">
          Escribinos
        </Link>
        .
      </p>
    </div>
  );
}
