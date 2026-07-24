import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActivateResidentStayButton, ToggleResidentVisibilityButton } from "@/app/students/residency/ResidencyActions";
import { AmenityGrid } from "@/components/residences/AmenityGrid";
import { RulesHighlight } from "@/components/residences/RulesHighlight";
import { CommunityBrowser } from "@/components/residences/CommunityBrowser";
import { ReservationSelectionProvider } from "@/components/residences/reservationSelection";
import { getServiceIcon, getCommonAreaIcon } from "@/lib/residences/amenityIcons";
import { getCommunityVisibility } from "@/lib/residents/communityVisibility";
import { getIsHoused } from "@/lib/students/isHoused";
import { addMonthsDateOnly, daysRemaining } from "@/lib/students/stayDates";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await getSupabaseServer();
  const isHoused = supabase ? await getIsHoused(supabase) : false;
  return { title: isHoused ? "Mi residencia" : "Mi estadía" };
}

const STATUS_COPY: Record<string, { label: string; tone: "amber" | "sage" | "neutral" }> = {
  active: { label: "Visible en la comunidad", tone: "sage" },
  visibility_limited: { label: "Visible — visibilidad limitada", tone: "sage" },
  hidden_by_user: { label: "Oculto de la comunidad", tone: "neutral" },
};

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
  residences: { id: string; name: string; public_area: string; slug: string; description: string | null } | null;
  room_types: { name: string } | null;
  application_snapshots: { monthly_price_usd: number } | null;
};

/**
 * Visibilidad en la comunidad (`resident_stays`, activación por
 * invitación de la residencia) — bloque intacto desde la versión
 * original de esta pantalla, ahora incrustado dentro del hub en vez de
 * ser toda la página. No tocar la lógica de queries/acciones acá
 * (docs/05 §15.1).
 */
function VisibilityBlock({ pending, mine }: { pending: StayRow[]; mine: StayRow[] }) {
  if (pending.length === 0 && mine.length === 0) return null;
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon name="visibility" className="text-xl text-forest-700" />
        <h2 className="font-bold text-ink">Tu visibilidad en la comunidad</h2>
      </div>
      <p className="text-xs text-ink-soft">
        Vos decidís si aparecer en la comunidad visible de tu residencia — podés ocultarte cuando quieras.
      </p>
      <div className="mt-4 space-y-3">
        {pending.map((stay) => (
          <div key={stay.id} className="rounded-field border border-line-2 bg-forest-tint p-4">
            <p className="text-sm font-semibold text-ink">{stay.residences?.name} te cargó como residente</p>
            <p className="mt-0.5 text-xs text-ink-faint">{stay.room_types?.name ?? "Sin tipo asignado"}</p>
            <ActivateResidentStayButton residentStayId={stay.id} />
          </div>
        ))}
        {mine.map((stay) => {
          const badge = STATUS_COPY[stay.status] ?? { label: stay.status, tone: "neutral" as const };
          return (
            <div key={stay.id} className="flex items-start justify-between gap-3 rounded-field border border-line p-4">
              <div>
                <p className="text-sm font-semibold text-ink">Estado</p>
                <Badge tone={badge.tone}>{badge.label}</Badge>
              </div>
              <ToggleResidentVisibilityButton residentStayId={stay.id} hidden={stay.status === "hidden_by_user"} />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default async function StudentResidencyPage() {
  const sessionUser = await getSessionUser();
  const supabase = await getSupabaseServer();
  const admin = getSupabaseAdmin();

  let pending: StayRow[] = [];
  let mine: StayRow[] = [];

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
    const { data } = await supabase
      .from("reservations")
      .select(
        "id, start_date, initial_duration_months, booking_receipt_id, residences(id, name, public_area, slug, description), room_types(name), application_snapshots(monthly_price_usd)",
      )
      .eq("status", "confirmed")
      .order("confirmed_at", { ascending: false })
      .maybeSingle();
    reservation = data as unknown as ReservationRow | null;
  }

  // Estudiante sin reserva confirmada: la pantalla original, intacta —
  // activación de visibilidad o estado vacío. "Mi residencia" solo se
  // convierte en hub completo cuando hay una reserva confirmada
  // (docs/04 §7) de la que colgar dirección, servicios y comunidad real.
  if (!reservation) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-2xl font-bold text-ink">Mi estadía</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Si tu residencia te cargó como residente, activá tu cuenta para aparecer en la comunidad visible — vos
          decidís si aparecer o no.
        </p>

        {pending.length === 0 && mine.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon="apartment"
              title="Sin estadías cargadas"
              description="Cuando la residencia donde vivís te cargue como residente, vas a poder activar tu cuenta acá."
            />
          </div>
        ) : (
          <div className="mt-6">
            <VisibilityBlock pending={pending} mine={mine} />
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
    } else if (renewalRequest && renewalRequest.status === "notified_to_residence") {
      renewalStatus = { label: "Tu solicitud de renovación está esperando respuesta", tone: "amber" };
    } else if (renewalOffer?.status === "confirmed" || renewalOffer?.status === "receipt_issued") {
      renewalStatus = { label: "Ya renovaste tu estadía", tone: "sage" };
    }

    const sectionMap = Object.fromEntries((sections ?? []).map((s) => [s.section_type, s.content]));
    services = (sectionMap.services as { items?: string[] } | undefined)?.items ?? [];
    commonAreas = (sectionMap.common_areas as { items?: string[] } | undefined)?.items ?? [];
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

  const remaining = daysRemaining(reservation.start_date, reservation.initial_duration_months);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink md:text-3xl">Mi residencia</h1>
          <p className="mt-1 flex items-center gap-1 text-ink-soft">
            <Icon name="location_on" className="text-base" />
            {residence?.name} · {residence?.public_area}, CABA
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-forest-tint px-3 py-1 text-xs font-bold uppercase tracking-wide text-forest-700">
          <span className="size-2 rounded-full bg-forest-600" /> Alojado
        </span>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <Card className="p-6">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted">Tu estadía</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-ink-faint">Habitación</p>
                <p className="font-bold text-ink">{reservation.room_types?.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-ink-faint">Valor mensual</p>
                <p className="font-bold text-ink">USD {reservation.application_snapshots?.monthly_price_usd ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-ink-faint">Ingreso</p>
                <p className="font-medium text-ink">{reservation.start_date}</p>
              </div>
              <div>
                <p className="text-xs text-ink-faint">Fin estimado</p>
                <p className="font-medium text-ink">
                  {addMonthsDateOnly(reservation.start_date, reservation.initial_duration_months)}
                </p>
              </div>
            </div>
            {remaining > 0 && (
              <p className="mt-3 text-sm font-semibold text-forest-700">
                {remaining < 60 ? `Quedan ${remaining} días de tu estadía actual` : `Quedan ~${Math.round(remaining / 30)} meses de tu estadía actual`}
              </p>
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
            <Button href="/students/renewals" size="sm" variant={renewalStatus ? "primary" : "outline"} className="shrink-0">
              Ver renovaciones
            </Button>
          </Card>

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
                <AmenityGrid items={services.map((s) => ({ name: s, ...getServiceIcon(s) }))} />
              </div>
            </section>
          )}

          {commonAreas.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-ink">Áreas comunes</h2>
              <div className="mt-4">
                <AmenityGrid items={commonAreas.map((a) => ({ name: a, ...getCommonAreaIcon(a) }))} />
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

          {community && (community.totalResidents > 0 || community.totalAvailable > 0) && residence && (
            <section>
              <h2 className="text-xl font-bold text-ink">Comunidad actual</h2>
              <p className="mt-2 text-sm text-ink-soft">Tus compañeros de residencia — cada uno decide qué mostrar.</p>
              <div className="mt-4">
                <ReservationSelectionProvider>
                  <CommunityBrowser summary={community} slug={residence.slug} isGuest={false} />
                </ReservationSelectionProvider>
              </div>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-5 lg:col-span-1">
          <VisibilityBlock pending={pending} mine={mine} />

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

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Contacto y soporte</p>
              <Icon name="support_agent" className="text-lg text-muted" />
            </div>
            <p className="text-sm text-ink-soft">
              Para cualquier consulta sobre tu estadía, contactate con soporte de EstuRed — coordinamos con la
              residencia por vos.
            </p>
            <Button href="/students/support" size="sm" variant="outline" className="mt-3">
              Ir a Soporte
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
