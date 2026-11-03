import { amenityDisplayName, normalizeAmenityLists, parseAmenityDetails } from "@/lib/residences/amenityDetails";
import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHero } from "@/components/ui/PageHero";
import { LinkRequestSection, type MyLinkRequest } from "@/components/students/LinkRequestSection";
import { ActivateResidentStayButton } from "@/app/students/residency/ResidencyActions";
import { StartRenewalModal } from "@/app/students/renewals/StartRenewalModal";
import { AmenityGrid } from "@/components/residences/AmenityGrid";
import { RulesHighlight } from "@/components/residences/RulesHighlight";
import { CommunityBrowser } from "@/components/residences/CommunityBrowser";
import { ReservationSelectionProvider } from "@/components/residences/reservationSelection";
import { getServiceIcon, getCommonAreaIcon } from "@/lib/residences/amenityIcons";
import { getCommunityVisibility } from "@/lib/residents/communityVisibility";
import { loadPendingConfirmationOfStudent } from "@/lib/residents/guardianConfirmation";
import { getIsHoused } from "@/lib/students/isHoused";
import { formatDateOnly } from "@/lib/students/contractEnd";
import { loadStudentContracts } from "@/lib/students/loadStudentContracts";
import { StayRateNote } from "@/components/students/StayRateNote";
import { StayChangeCard, StayChangeTopNotices } from "@/components/students/StayChangeCard";
import { ExitStudentNoteForm } from "@/components/students/StayChangeInlineActions";
import { loadStudentStayChange, type StudentStayChangeView } from "@/lib/stayChange/load";
import { getApprovedCustomAmenities } from "@/lib/residences/customAmenitiesDb";
import { loadStayChangeEligibility } from "@/lib/stayChange/eligibility";
import { RoomChangeCard } from "@/components/students/RoomChangeCard";
import { loadStudentRoomChange, type StudentRoomChangeView } from "@/lib/roomChange/load";
import { STAY_CHANGE_ADVANCE_HOURS } from "@/lib/stayChange/advanceGate";
import { DEPOSIT_STATUS_LABELS, UNPAID_DISCLAIMER, type DepositReturnStatus } from "@/lib/stayChange/copy";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await getSupabaseServer();
  const isHoused = supabase ? await getIsHoused(supabase) : false;
  return { title: isHoused ? "Mi residencia" : "Mi estadía" };
}

type StayRow = {
  id: string;
  status: string;
  invite_email: string | null;
  residences: { name: string; slug: string } | null;
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
    description: string | null;
    minimum_stay_months: number | null;
  } | null;
  room_types: { name: string } | null;
  application_snapshots: { monthly_price_usd: number } | null;
};

/**
 * Activación de residente pendiente (`resident_stays`, invitación de
 * la residencia) — bloque intacto desde la versión original de esta
 * pantalla, ahora incrustado dentro del hub. Ya no ofrece un toggle de
 * "ocultarme de la comunidad" (decisión del dueño, Ciclo 39): el
 * perfil siempre es visible una vez que la cuenta está activada, sin
 * paso de visibilidad separado. No tocar la lógica de queries/acciones
 * acá (docs/05 §15.1).
 */
function PendingActivationBlock({ pending }: { pending: StayRow[] }) {
  if (pending.length === 0) return null;
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon name="how_to_reg" className="text-xl text-forest-700" />
        <h2 className="font-bold text-ink">Activá tu cuenta de residente</h2>
      </div>
      <p className="text-xs text-ink-soft">Tu residencia te cargó como residente — activá tu cuenta para sumarte a la comunidad visible.</p>
      <div className="mt-4 space-y-3">
        {pending.map((stay) => (
          <div key={stay.id} className="rounded-field border border-line-2 bg-forest-tint p-4">
            <p className="text-sm font-semibold text-ink">{stay.residences?.name} te cargó como residente</p>
            <p className="mt-0.5 text-xs text-ink-faint">{stay.room_types?.name ?? "Sin tipo asignado"}</p>
            <ActivateResidentStayButton residentStayId={stay.id} />
          </div>
        ))}
      </div>
    </Card>
  );
}

export default async function StudentResidencyPage({ searchParams }: { searchParams?: Promise<{ pendiente?: string; aviso?: string }> }) {
  const sp = await searchParams;
  const pendingNotice = sp?.pendiente === "1";
  const registerNoticeFailed = sp?.aviso === "error";
  const sessionUser = await getSessionUser();
  const supabase = await getSupabaseServer();
  const admin = getSupabaseAdmin();

  let pending: StayRow[] = [];
  let mine: StayRow[] = [];
  // DR32: el menor ve que su estadía espera a su tutor (no se vincula hasta que confirme).
  let awaitingGuardian: { residenceName: string; expiresAt: string } | null = null;

  if (sessionUser && admin) {
    // Docs/05 §15.1: la invitación pendiente todavía no tiene
    // student_profile_id, así que la política RLS "es mío" no la cubre
    // todavía — se busca por email con el cliente admin (server-side,
    // filtrado explícito por el propio email de la sesión).
    const { data: user } = await admin.from("users").select("email").eq("id", sessionUser.id).maybeSingle();
    if (user?.email) {
      const { data } = await admin
        .from("resident_stays")
        .select("id, status, invite_email, residences(name, slug), room_types(name)")
        .eq("invite_email", user.email.toLowerCase())
        .is("student_profile_id", null)
        .eq("is_current", true);
      pending = (data as unknown as StayRow[]) ?? [];
    }
  }

  if (sessionUser && admin) {
    const { data: profile } = await admin.from("student_profiles").select("id").eq("user_id", sessionUser.id).maybeSingle();
    const waiting = profile ? await loadPendingConfirmationOfStudent(admin, (profile as { id: string }).id) : null;
    if (waiting && new Date(waiting.expires_at).getTime() > Date.now()) {
      const { data: res } = await admin.from("residences").select("name").eq("id", waiting.residence_id).maybeSingle();
      awaitingGuardian = { residenceName: (res as { name?: string } | null)?.name ?? "tu residencia", expiresAt: waiting.expires_at };
    }
  }

  if (supabase) {
    const { data, error } = await supabase
      .from("resident_stays")
      .select("id, status, invite_email, residences(name, slug), room_types(name)")
      .eq("is_current", true)
      .in("status", ["active", "visibility_limited", "hidden_by_user"]);
    if (error) console.error("[students/residency] query failed:", error);
    mine = (data as unknown as StayRow[]) ?? [];
  }

  let reservation: ReservationRow | null = null;
  if (supabase) {
    const { data, error: reservationError } = await supabase
      .from("reservations")
      .select(
        "id, start_date, initial_duration_months, booking_receipt_id, residences(id, name, public_area, slug, description, minimum_stay_months), room_types(name), application_snapshots(monthly_price_usd)",
      )
      .eq("status", "confirmed")
      .order("confirmed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (reservationError) console.error("[students/residency] reservation lookup failed:", reservationError);
    reservation = data as unknown as ReservationRow | null;
  }

  // Salida anticipada ya registrada por la residencia (DR3): el estudiante ve el estado del depósito y puede dejar su nota.
  type EarlyExitRow = {
    resident_stay_id: string;
    exit_date: string;
    deposit_status: DepositReturnStatus;
    residence_note: string | null;
    student_note: string | null;
    residences: { name: string } | null;
  };
  let earlyExit: EarlyExitRow | null = null;
  if (!reservation && admin && sessionUser?.roles.includes("student")) {
    const { data: profile } = await admin.from("student_profiles").select("id").eq("user_id", sessionUser.id).maybeSingle();
    if (profile?.id) {
      const { data, error: exitError } = await admin
        .from("stay_early_exits")
        .select("resident_stay_id, exit_date, deposit_status, residence_note, student_note, residences(name)")
        .eq("student_profile_id", profile.id)
        .order("exit_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      // Tabla de la migración 0044: si todavía no existe, la pantalla sigue como siempre.
      if (exitError && exitError.code !== "42P01" && exitError.code !== "PGRST205") console.error("[students/residency] early exit lookup failed:", exitError);
      earlyExit = (data as unknown as EarlyExitRow | null) ?? null;
    }
  }

  // DR19: estudiante sin estadía que se registró solo — residencias donde pedir el vínculo y sus solicitudes (tolerante a la 0064 sin aplicar).
  let linkResidences: { id: string; name: string; area: string | null }[] = [];
  let myLinkRequests: MyLinkRequest[] = [];
  const canRequestLink = !reservation && mine.length === 0 && !earlyExit && !!sessionUser?.roles.includes("student");
  if (canRequestLink && admin && sessionUser) {
    const [{ data: residenceRows }, { data: profileRow }] = await Promise.all([
      admin.from("residences").select("id, name, public_area").eq("status", "verified_active").order("name", { ascending: true }),
      admin.from("student_profiles").select("id").eq("user_id", sessionUser.id).maybeSingle(),
    ]);
    linkResidences = ((residenceRows ?? []) as { id: string; name: string; public_area: string | null }[]).map((r) => ({ id: r.id, name: r.name, area: r.public_area }));
    if (profileRow?.id) {
      const { data: requestRows, error: requestError } = await admin
        .from("resident_link_requests")
        .select("id, status, created_at, residences(name)")
        .eq("student_profile_id", profileRow.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (requestError && requestError.code !== "42P01" && requestError.code !== "PGRST205") console.error("[students/residency] link requests lookup failed:", requestError);
      myLinkRequests = ((requestRows ?? []) as unknown as { id: string; status: MyLinkRequest["status"]; created_at: string; residences: { name: string } | null }[]).map((r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.created_at,
        residenceName: r.residences?.name ?? "Residencia",
      }));
    }
  }

  // Estudiante sin reserva confirmada: la pantalla original, intacta —
  // activación de visibilidad o estado vacío. "Mi residencia" solo se
  // convierte en hub completo cuando hay una reserva confirmada
  // (docs/04 §7) de la que colgar dirección, servicios y comunidad real.
  if (!reservation) {
    return (
      <div className="tone-student mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <PageHero
          tone="student"
          eyebrow="Tu estadía"
          eyebrowIcon="home_work"
          title="Mi estadía"
          subtitle="Si tu residencia te cargó como residente, activá tu cuenta con el enlace personal que te mandó o con un código a tu mail."
          glyph="home_work"
        />

        {registerNoticeFailed && (
          <p role="alert" className="mt-6 rounded-field bg-warning-bg px-4 py-3 text-sm font-medium text-warning-fg">
            Tu cuenta está creada, pero no pudimos registrar tu residencia. Podés hacerlo desde acá, en «¿Ya vivís en una residencia?».
          </p>
        )}

        {pendingNotice && (
          <p role="status" className="mt-6 rounded-field bg-info-bg px-4 py-3 text-sm font-medium text-info-fg">
            Verificamos tu código. Tu residencia tiene que confirmar que sos vos: te avisamos apenas lo haga.
          </p>
        )}

        {awaitingGuardian && (
          <Card className="mt-6 flex items-start gap-3 p-4 sm:p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-soft-100 text-amber-soft-700">
              <Icon name="hourglass_top" className="text-xl" />
            </span>
            <div className="min-w-0">
              <h2 className="font-bold text-ink">Esperando la confirmación de tu familiar</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Tu estadía en {awaitingGuardian.residenceName} se vincula apenas la confirme. Tiene hasta el {formatDateOnly(awaitingGuardian.expiresAt.slice(0, 10))}.
              </p>
            </div>
          </Card>
        )}

        {earlyExit && (
          <Card className="mt-6 p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Icon name="logout" className="text-xl text-forest-700" />
              <h2 className="font-bold text-ink">Tu salida de {earlyExit.residences?.name ?? "tu residencia"}</h2>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ink-faint">Fecha de salida</dt>
                <dd className="font-bold text-ink">{formatDateOnly(earlyExit.exit_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Depósito</dt>
                <dd className="font-bold text-ink">{DEPOSIT_STATUS_LABELS[earlyExit.deposit_status] ?? "—"}</dd>
              </div>
            </dl>
            {earlyExit.residence_note && (
              <blockquote className="mt-4 border-l-4 border-forest pl-4 text-sm leading-relaxed text-ink">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">Nota de la residencia</span>
                {earlyExit.residence_note}
              </blockquote>
            )}
            <div className="mt-5 border-t border-line pt-4">
              <ExitStudentNoteForm residentStayId={earlyExit.resident_stay_id} initialNote={earlyExit.student_note} />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-ink-faint">
              Esta información la carga tu residencia y no modifica ningún contrato; ante dudas, escribí a Soporte. {UNPAID_DISCLAIMER}
            </p>
          </Card>
        )}

        {pending.length > 0 ? (
          <div className="mt-6">
            <PendingActivationBlock pending={pending} />
          </div>
        ) : mine.length > 0 ? (
          <div className="mt-6 flex items-center gap-3 rounded-card border border-line-2 bg-forest-tint p-5">
            <Icon name="verified_user" className="text-2xl text-forest-700" />
            <p className="text-sm font-semibold text-ink">Ya estás activo en la comunidad de tu residencia.</p>
          </div>
        ) : earlyExit ? null : canRequestLink ? (
          <div className="mt-6">
            <LinkRequestSection residences={linkResidences} requests={myLinkRequests} />
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState
              tone="student"
              icon="apartment"
              title="Sin estadías cargadas"
              description="Cuando la residencia donde vivís te cargue como residente, vas a poder activar tu cuenta acá."
            />
          </div>
        )}
      </div>
    );
  }

  const residence = reservation.residences;
  let docsUploadedCount = 0;
  let renewalStatus: { label: string; tone: "amber" | "sage" | "neutral" | "danger" } | null = null;
  let services: string[] = [];
  let commonAreas: string[] = [];
  let amenityDetails: ReturnType<typeof parseAmenityDetails> = {};
  let rulesSummary = "";
  let rulesPdfUrl: string | null = null;
  let community: Awaited<ReturnType<typeof getCommunityVisibility>> | null = null;

  if (admin && residence) {
    const [{ data: renewalRequest }, { data: renewalOffer }, { data: sections }, { data: rulesFile }] = await Promise.all([
      admin
        .from("renewal_requests")
        .select("id, status")
        .eq("reservation_id", reservation.id)
        .order("created_at", { ascending: false })
        .maybeSingle(),
      admin
        .from("renewal_offers")
        .select("id, status")
        .eq("reservation_id", reservation.id)
        .order("created_at", { ascending: false })
        .maybeSingle(),
      admin.from("residence_profile_sections").select("section_type, content").eq("residence_id", residence.id),
      admin
        .from("files")
        .select("storage_path")
        .eq("related_entity_type", "residences")
        .eq("related_entity_id", residence.id)
        .eq("document_type", "residence_rules_document")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(1)
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

    const sectionMap = Object.fromEntries((sections ?? []).map((s) => [s.section_type, s.content]));
    // DR18 t4: se suman los ítems «Otro» aprobados por EstuRed (pendientes y rechazados nunca se muestran).
    const approvedCustom = await getApprovedCustomAmenities(admin, residence.id);
    ({ services, commonAreas } = normalizeAmenityLists({
      services: [...((sectionMap.services as { items?: string[] } | undefined)?.items ?? []), ...approvedCustom.services],
      commonAreas: [...((sectionMap.common_areas as { items?: string[] } | undefined)?.items ?? []), ...approvedCustom.areas],
    }));
    // 0073: si la columna aún no existe la consulta devuelve error y se muestra sin detalles.
    const { data: detailsRow } = await admin.from("residences").select("amenity_details").eq("id", residence.id).maybeSingle();
    amenityDetails = parseAmenityDetails((detailsRow as { amenity_details?: unknown } | null)?.amenity_details);
    rulesSummary = (sectionMap.rules as { summary?: string } | undefined)?.summary ?? "";

    if (rulesFile?.storage_path) {
      const { data: signed } = await admin.storage
        .from("private-residence-documents")
        .createSignedUrl(rulesFile.storage_path, 3600);
      rulesPdfUrl = signed?.signedUrl ?? null;
    }

    if (sessionUser) {
      const { data: profile } = await admin
        .from("student_profiles")
        .select("id")
        .eq("user_id", sessionUser.id)
        .maybeSingle();
      if (profile?.id) {
        const { data: docFiles } = await admin
          .from("files")
          .select("document_type")
          .eq("related_entity_type", "student_profiles")
          .eq("related_entity_id", profile.id)
          .in("document_type", ["student_identity", "student_academic_proof"]);
        docsUploadedCount = new Set((docFiles ?? []).map((f) => f.document_type)).size;
      }
    }

    community = await getCommunityVisibility(admin, residence.id, "registered");
  }

  // H05: fin de contrato y tarifa vigentes (estadía vinculada → renovación → reserva).
  const contract = supabase
    ? (
        await loadStudentContracts(supabase, [
          {
            id: reservation.id,
            start_date: reservation.start_date,
            initial_duration_months: reservation.initial_duration_months,
            snapshotRateUsd: reservation.application_snapshots?.monthly_price_usd ?? null,
          },
        ])
      ).get(reservation.id)
    : undefined;
  // "Quiero cambiar" (DR3, Ciclo 60): solo el estudiante (el familiar lo ve en su Inicio). Lecturas degradables: si fallan,
  // la pantalla sigue sin el bloque.
  let stayChange: {
    view: StudentStayChangeView | null;
    familyName: string | null;
    isMinor: boolean;
    renewalLock: boolean;
    advanceAtIso: string | null;
  } | null = null;
  if (admin && sessionUser?.roles.includes("student")) {
    const { data: profile } = await admin.from("student_profiles").select("id, is_minor").eq("user_id", sessionUser.id).maybeSingle();
    if (profile?.id) {
      const [view, eligibility, familyLink] = await Promise.all([
        loadStudentStayChange(admin, profile.id as string),
        loadStayChangeEligibility(admin, profile.id as string),
        admin
          .from("family_links")
          .select("family_members(first_name)")
          .eq("student_profile_id", profile.id)
          .eq("status", "active")
          .maybeSingle(),
      ]);
      let advanceAtIso: string | null = null;
      if (view && (view.ui.key === "open_no_response" || view.ui.key === "open_responded" || view.ui.key === "open_expiring")) {
        const { data: intentRow } = await admin.from("stay_change_intents").select("payment_unlocked_at").eq("id", view.id).maybeSingle();
        advanceAtIso = (intentRow?.payment_unlocked_at as string | null) ?? null;
      }
      stayChange = {
        view,
        familyName: (familyLink.data?.family_members as unknown as { first_name: string } | null)?.first_name ?? null,
        isMinor: !!profile.is_minor,
        renewalLock: !eligibility.ok && eligibility.reason === "renewal_in_progress",
        advanceAtIso,
      };
    }
  }
  // Cambio de habitación (DR34): solo el estudiante, con estadía activa. Degrada a `null` (sin bloque) si falta la migración 0076.
  let roomChange: StudentRoomChangeView | null = null;
  if (admin && sessionUser?.roles.includes("student")) {
    const { data: profile } = await admin.from("student_profiles").select("id").eq("user_id", sessionUser.id).maybeSingle();
    if (profile?.id) roomChange = await loadStudentRoomChange(admin, profile.id as string);
  }
  const searchingChange =
    !!stayChange?.view && ["open_no_response", "open_responded", "open_expiring"].includes(stayChange.view.ui.key);
  const remaining = contract?.daysRemaining ?? 0;
  const contractEndLabel = contract ? formatDateOnly(contract.endDate) : "—";
  const monthlyRate = contract?.currentRateUsd ?? reservation.application_snapshots?.monthly_price_usd ?? null;

  return (
    <div className="tone-student mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <PageHero
        tone="student"
        eyebrow="Tu casa"
        eyebrowIcon="home_work"
        title="Mi residencia"
        subtitle={`${residence?.name ?? ""} · ${residence?.public_area ?? ""}, CABA`}
        glyph="home_work"
        status={
          <>
            <Badge tone="sage">
              <Icon name="check_circle" className="text-sm" /> Alojado
            </Badge>
            {searchingChange && (
              <Badge tone="amber">
                <Icon name="swap_horiz" className="text-sm" /> Buscando un cambio
              </Badge>
            )}
          </>
        }
      />

      {stayChange && (
        <div className="mt-6 empty:hidden">
          <StayChangeTopNotices view={stayChange.view} residenceName={residence?.name ?? "tu residencia"} contractEndLabel={contractEndLabel} />
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <Card className="p-6">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted">Tu estadía</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-ink-faint">Habitación</p>
                {/* La estadía vigente manda: asignar una cama o resolver un cambio de habitación actualiza `resident_stays`, no la reserva. */}
                <p className="font-bold text-ink">{roomChange?.currentTypeName ?? reservation.room_types?.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-ink-faint">Valor mensual</p>
                <p className="font-bold text-ink">USD {monthlyRate ?? "—"}</p>
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
            {contract?.renewedUntil && (
              <p className="mt-2 text-xs text-ink-faint">
                Tu contrato original terminaba el {formatDateOnly(contract.originalEndDate)}; lo renovaste.
              </p>
            )}
            {remaining > 0 && (
              <p className="mt-3 text-sm font-semibold text-forest-700">
                {remaining < 60 ? `Quedan ${remaining} días de tu estadía actual` : `Quedan ~${Math.round(remaining / 30)} meses de tu estadía actual`}
              </p>
            )}
            {contract?.differs && (
              <StayRateNote agreedRateUsd={contract.agreedRateUsd} currentRateUsd={contract.currentRateUsd} className="mt-3" />
            )}
            <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-4">
              {reservation.booking_receipt_id && (
                <Link
                  href={`/students/receipts/${reservation.booking_receipt_id}`}
                  className="flex items-center gap-2 rounded-full border-[1.5px] border-line px-4 py-2 text-sm font-semibold text-ink hover:border-forest hover:bg-forest-tint"
                >
                  <Icon name="receipt_long" className="text-base text-forest-700" /> Comprobante de reserva
                </Link>
              )}
              <Link
                href="/students/applications"
                className="flex items-center gap-2 rounded-full border-[1.5px] border-line px-4 py-2 text-sm font-semibold text-ink hover:border-forest hover:bg-forest-tint"
              >
                <Icon name="description" className="text-base text-forest-700" /> Solicitudes relacionadas
              </Link>
            </div>
          </Card>

          <Card className={`flex flex-wrap items-center justify-between gap-4 p-5 ${renewalStatus ? "border-orange/40 bg-warning-bg" : ""}`}>
            <div className="flex items-center gap-3">
              <Icon name="sync" className={`text-2xl ${renewalStatus ? "text-orange-700" : "text-forest-700"}`} />
              <div>
                <p className="font-bold text-ink">{renewalStatus ? renewalStatus.label : "¿Se acerca el fin de tu estadía?"}</p>
                <p className="text-sm text-ink-soft">
                  {renewalStatus ? "Revisá el estado de tu renovación." : "Solicitá tu renovación, sin plazos mínimos de anticipación."}
                </p>
              </div>
            </div>
            {renewalStatus ? (
              <Button href="/students/renewals" size="sm" variant="primary" className="shrink-0">
                Ver renovaciones
              </Button>
            ) : (
              <StartRenewalModal
                reservationId={reservation.id}
                roomTypeName={reservation.room_types?.name ?? null}
                currentEndDateLabel={contractEndLabel}
                monthlyPriceUsd={monthlyRate}
                minimumStayMonths={residence?.minimum_stay_months ?? null}
                triggerVariant="outline"
                triggerClassName="shrink-0"
              />
            )}
          </Card>

          {stayChange && (
            <StayChangeCard
              view={stayChange.view}
              residenceName={residence?.name ?? "tu residencia"}
              contractEndLabel={contractEndLabel}
              contractEndDate={contract?.endDate ?? null}
              familyName={stayChange.familyName}
              isMinor={stayChange.isMinor}
              renewalLock={stayChange.renewalLock}
              conditionsHref={reservation.booking_receipt_id ? `/students/receipts/${reservation.booking_receipt_id}` : "/students/applications"}
              advanceAtIso={stayChange.advanceAtIso}
              advanceHours={STAY_CHANGE_ADVANCE_HOURS}
              now={new Date()}
            />
          )}

          {roomChange && <RoomChangeCard view={roomChange} />}

          {residence?.description && (
            <section>
              <h2 className="text-xl font-bold text-ink">Sobre tu residencia</h2>
              <p className="mt-3 leading-relaxed text-ink-soft">{residence.description}</p>
            </section>
          )}

          {services.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-ink">Servicios incluidos</h2>
              <div className="mt-4">
                <AmenityGrid items={services.map((s) => ({ name: amenityDisplayName(s, amenityDetails), ...getServiceIcon(s) }))} />
              </div>
            </section>
          )}

          {commonAreas.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-ink">Áreas comunes</h2>
              <div className="mt-4">
                <AmenityGrid items={commonAreas.map((a) => ({ name: amenityDisplayName(a, amenityDetails), ...getCommonAreaIcon(a) }))} />
              </div>
            </section>
          )}

          {(rulesSummary || rulesPdfUrl) && (
            <section>
              <h2 className="text-xl font-bold text-ink">Reglas de convivencia</h2>
              <div className="mt-4">
                <RulesHighlight rulesSummary={rulesSummary} pdfUrl={rulesPdfUrl} />
              </div>
            </section>
          )}

        </div>

        <div className="flex flex-col gap-5 lg:col-span-1">
          <PendingActivationBlock pending={pending} />

          {/* La documentación vive en la ficha del estudiante (/students/profile); el
              familiar no tiene una (la ruta da 404 y el conteo sería un falso "0 de 2"). */}
          {sessionUser?.roles.includes("student") && (
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Documentación de tu estadía</p>
                <Icon name="folder_shared" className="text-lg text-muted" />
              </div>
              <p className="text-sm font-bold text-ink">{docsUploadedCount} de 2 documentos cargados</p>
              <p className="mt-1 text-xs text-ink-soft">DNI/pasaporte y comprobante de estudio.</p>
              {docsUploadedCount < 2 && (
                <Link href="/students/profile" className="mt-3 inline-block text-sm font-semibold text-forest-700 hover:underline">
                  Completar documentación →
                </Link>
              )}
            </Card>
          )}

          {searchingChange && stayChange?.familyName && (
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Tu familiar vinculado</p>
                <Icon name="family_restroom" className="text-lg text-muted" />
              </div>
              <p className="text-sm leading-relaxed text-ink-soft">
                {stayChange.familyName} ve que avisaste y la respuesta de tu residencia, y puede proponerte opciones. No ve tu mensaje. La decisión es tuya.
              </p>
            </Card>
          )}

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Contacto y soporte</p>
              <Icon name="support_agent" className="text-lg text-muted" />
            </div>
            <p className="text-sm text-ink-soft">
              Para cualquier consulta sobre tu estadía o tu cambio, escribinos a Soporte.
            </p>
            <Button href="/students/support" size="sm" variant="outline" className="mt-3">
              Ir a Soporte
            </Button>
          </Card>
        </div>
      </div>

      {/* Ancho completo, fuera de la grilla de 2 columnas — CommunityBrowser
          usa columnas CSS con breakpoints de viewport (lg:/xl:columns-2)
          que rompen mal si el contenedor real es más angosto que el
          viewport, como pasaba acá dentro de la columna principal. */}
      {community && (community.totalResidents > 0 || community.totalAvailable > 0) && residence && (
        <section id="comunidad" className="mt-8 scroll-mt-24">
          <h2 className="text-xl font-bold text-ink">Comunidad actual</h2>
          <p className="mt-2 text-sm text-ink-soft">Tus compañeros de residencia — cada uno decide qué mostrar.</p>
          <div className="mt-4">
            <ReservationSelectionProvider>
              <CommunityBrowser summary={community} slug={residence.slug} isGuest={false} allowSelection={false} />
            </ReservationSelectionProvider>
          </div>
        </section>
      )}
    </div>
  );
}
