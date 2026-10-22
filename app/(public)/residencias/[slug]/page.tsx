import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TrustBadge } from "@/components/residences/TrustBadge";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";
import { Icon } from "@/components/ui/Icon";
import { getCommunityVisibility } from "@/lib/residents/communityVisibility";
import { getStudentProfileCompleteness } from "@/lib/students/profileCompleteness";
import { CommunityBrowser } from "@/components/residences/CommunityBrowser";
import { AmenityGrid } from "@/components/residences/AmenityGrid";
import { RulesHighlight } from "@/components/residences/RulesHighlight";
import { FaqAccordion } from "@/components/residences/FaqAccordion";
import { assertResidenceAccess } from "@/lib/residences/access";
import { getPublicAnsweredQuestions } from "@/lib/faq/getPublicAnsweredQuestions";
import { AskQuestionForm } from "@/app/(public)/residencias/[slug]/AskQuestionForm";
import { CompactMap } from "@/components/residences/CompactMap";
import { getServiceIcon, getCommonAreaIcon } from "@/lib/residences/amenityIcons";
import { ApplyForm } from "@/app/(public)/residencias/[slug]/ApplyForm";
import { ProposeForm } from "@/app/(public)/residencias/[slug]/ProposeForm";
import { FavoriteButton } from "@/app/(public)/residencias/[slug]/FavoriteButton";
import { toggleStudentFavorite, toggleFamilyFavorite } from "@/app/students/favorites/actions";
import { MobileRequestBar } from "@/components/residences/MobileRequestBar";
import { formatUsd } from "@/lib/mock/exchange";
import { initialPaymentConfigFromRow } from "@/lib/reservations/initialPayment";
import { ReservationSelectionProvider } from "@/components/residences/reservationSelection";
import { ResidenceGallery } from "@/components/residences/ResidenceGallery";

export const dynamic = "force-dynamic";

async function loadResidence(slug: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const { data: residence } = await admin
    .from("residences")
    .select("*")
    .eq("slug", slug)
    .eq("status", "verified_active")
    .maybeSingle();
  if (!residence) return null;

  const [{ data: roomTypes }, { data: sections }, { data: photos }, { data: rulesFile }] = await Promise.all([
    admin
      .from("room_types")
      .select(
        "id, name, monthly_price_usd, capacity_per_room, gender_policy, bathroom_type, profile_availability(status, available_count)",
      )
      .eq("residence_id", residence.id)
      .eq("is_active", true),
    admin.from("residence_profile_sections").select("section_type, content").eq("residence_id", residence.id),
    admin
      .from("files")
      .select("storage_path")
      .eq("related_entity_type", "residences")
      .eq("related_entity_id", residence.id)
      .eq("document_type", "residence_photo")
      .eq("status", "approved")
      .order("created_at", { ascending: true }),
    // Reglamento en PDF: mismo mecanismo que las fotos (queda "approved"
    // cuando no requiere revisión, o tras aprobarse) — se genera un signed
    // URL de solo lectura, sin pasar por el flujo de "acceso justificado"
    // (ese flujo es para documentación interna sensible tipo DNI; el
    // reglamento es contenido público por diseño, mismo nivel de
    // confianza que el resumen de reglas en texto, ya público hoy).
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

  const sectionMap = Object.fromEntries((sections ?? []).map((s) => [s.section_type, s.content]));
  const photoUrls = (photos ?? []).map(
    (p) => admin.storage.from("public-residence-media").getPublicUrl(p.storage_path).data.publicUrl,
  );

  let rulesPdfUrl: string | null = null;
  if (rulesFile?.storage_path) {
    const { data: signed } = await admin.storage
      .from("private-residence-documents")
      .createSignedUrl(rulesFile.storage_path, 3600);
    rulesPdfUrl = signed?.signedUrl ?? null;
  }

  // profile_availability tiene unique(room_type_id) — PostgREST devuelve
  // un objeto singular en el embed, no un array (a diferencia de lo que
  // el tipo inferido por supabase-js sugiere sin un schema generado).
  const normalizedRoomTypes = (roomTypes ?? []).map((rt) => ({
    ...rt,
    profile_availability: rt.profile_availability as unknown as { status: string; available_count: number | null } | null,
  }));

  return { residence, roomTypes: normalizedRoomTypes, sectionMap, photoUrls, rulesPdfUrl };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadResidence(slug);
  if (!data) return { title: "Residencia no encontrada" };
  return { title: data.residence.name };
}

export default async function RealResidenceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ room?: string }>;
}) {
  const { slug } = await params;
  const { room: preselectedRoomTypeId } = await searchParams;
  const data = await loadResidence(slug);
  if (!data) notFound();
  const { residence, roomTypes, sectionMap, photoUrls, rulesPdfUrl } = data;
  const rate = await getCurrentExchangeRate();

  const sessionUser = await getSessionUser();
  const services = (sectionMap.services?.items as string[]) ?? [];
  const commonAreas = (sectionMap.common_areas?.items as string[]) ?? [];
  const nearUniversities = (sectionMap.near_universities?.items as string[]) ?? [];
  const rulesSummary = (sectionMap.rules?.summary as string) ?? "";
  const staticFaqItems = (sectionMap.faq?.items as { question: string; answer: string }[]) ?? [];
  const communityStatement = (sectionMap.community_statement?.quote as string) ?? "";

  const adminClient = getSupabaseAdmin();
  const answeredQuestions = adminClient ? await getPublicAnsweredQuestions(adminClient, residence.id) : [];
  // El equipo de ESTA residencia no se pregunta a sí mismo: en vez del formulario ve un aviso (responde desde su panel).
  const isOwnResidenceTeam =
    !!sessionUser && !!adminClient && (await assertResidenceAccess(adminClient, sessionUser.id, residence.id));
  const faqItems = [...staticFaqItems, ...answeredQuestions.map((q) => ({ ...q, fromVisitor: true }))];
  const community = adminClient
    ? await getCommunityVisibility(adminClient, residence.id, sessionUser ? "registered" : "guest")
    : null;

  // Condiciones de reserva a nivel residencia (migración 0025).
  const conditions = {
    minimumStayMonths: residence.minimum_stay_months != null ? Number(residence.minimum_stay_months) : null,
    enrollmentFeeMode: (residence.enrollment_fee_mode as "one_month" | "manual" | null) ?? null,
    enrollmentFeeUsd: residence.enrollment_fee_usd != null ? Number(residence.enrollment_fee_usd) : null,
    enrollmentFeeFrequency: (residence.enrollment_fee_frequency as "once" | "annual") ?? "once",
    depositUsd: residence.deposit_usd != null ? Number(residence.deposit_usd) : null,
    emptyMonthChargePercent:
      residence.empty_month_charge_percent != null ? Number(residence.empty_month_charge_percent) : null,
    initialPayment: initialPaymentConfigFromRow(residence),
  };

  let profileCompletenessPercent: number | null = null;
  let studentProfileId: string | null = null;
  let studentFavorited = false;
  let minorBlock: "no_family" | "no_phone" | null = null;
  if (sessionUser?.roles.includes("student") && adminClient) {
    const completeness = await getStudentProfileCompleteness(adminClient, sessionUser.id);
    profileCompletenessPercent = completeness?.percent ?? null;
    const { data: profileRow } = await adminClient
      .from("student_profiles")
      .select("id, is_minor")
      .eq("user_id", sessionUser.id)
      .maybeSingle();
    studentProfileId = profileRow?.id ?? null;
    // Menor sin familiar vinculado con teléfono (docs/10 §9.1 y §9.5): el servidor
    // rechaza la solicitud al enviarla; acá se avisa antes de completar el formulario.
    if (profileRow?.is_minor) {
      const { data: link, error: linkError } = await adminClient
        .from("family_links")
        .select("family_members(phone)")
        .eq("student_profile_id", profileRow.id)
        .eq("status", "active")
        .maybeSingle();
      if (linkError) {
        // Ante un error de lectura no se bloquea: decide `submitApplication` al enviar.
        console.error("[ficha] no se pudo leer el familiar vinculado del menor:", linkError);
      } else if (!link) {
        minorBlock = "no_family";
      } else {
        const familyMember = link.family_members as unknown as { phone: string | null } | null;
        if (!familyMember?.phone) minorBlock = "no_phone";
      }
    }
    if (studentProfileId) {
      const { data: fav } = await adminClient
        .from("student_favorites")
        .select("id")
        .eq("student_profile_id", studentProfileId)
        .eq("residence_id", residence.id)
        .maybeSingle();
      studentFavorited = !!fav;
    }
  }

  let linkedStudents: { id: string; first_name: string; last_initial: string }[] = [];
  let linkedStudentsFavorited = new Set<string>();
  if (sessionUser?.roles.includes("family_member")) {
    const admin = getSupabaseAdmin();
    if (admin) {
      const { data: familyMember } = await admin
        .from("family_members")
        .select("id")
        .eq("user_id", sessionUser.id)
        .maybeSingle();
      if (familyMember) {
        const { data: links } = await admin
          .from("family_links")
          .select("student_profiles(id, first_name, last_initial)")
          .eq("family_member_id", familyMember.id)
          .eq("status", "active");
        linkedStudents = ((links ?? []) as unknown as { student_profiles: { id: string; first_name: string; last_initial: string } | null }[])
          .map((l) => l.student_profiles)
          .filter((s): s is { id: string; first_name: string; last_initial: string } => s !== null);
        if (linkedStudents.length > 0) {
          const { data: favs } = await admin
            .from("student_favorites")
            .select("student_profile_id")
            .eq("residence_id", residence.id)
            .in("student_profile_id", linkedStudents.map((s) => s.id));
          linkedStudentsFavorited = new Set((favs ?? []).map((f) => f.student_profile_id));
        }
      }
    }
  }

  const prices = roomTypes.map((rt) => Number(rt.monthly_price_usd)).filter((n) => Number.isFinite(n) && n > 0);
  const mobileBarPrice = prices.length > 0 ? formatUsd(Math.min(...prices)) : null;

  // La barra fija solo tiene sentido donde el panel ofrece una acción: invitados (inicio de sesión),
  // estudiantes con el formulario y familiares. No para admin/owner/staff ni con el bloqueo del menor.
  const showMobileBar =
    !sessionUser ||
    sessionUser.roles.includes("family_member") ||
    (sessionUser.roles.includes("student") && minorBlock === null);

  const showStudentFavoriteInHeader = sessionUser?.roles.includes("student") ?? false;

  return (
    <ReservationSelectionProvider initialRoomTypeId={preselectedRoomTypeId}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      {/* Hero de fotos — se adapta a la cantidad (0 / 1 / 2–4 / 5+), Ciclo 54 (D12) */}
      <div className="mt-4">
        <ResidenceGallery photos={photoUrls} name={residence.name} zone={residence.public_area ?? ""} />
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-ink sm:text-4xl">{residence.name}</h1>
              <TrustBadge status="verified_active" size="md" />
              {/* Favorito — cerca del título, no compite con el panel de solicitud */}
              {showStudentFavoriteInHeader && (
                <FavoriteButton action={toggleStudentFavorite.bind(null, residence.id)} initialFavorited={studentFavorited} />
              )}
            </div>
            <p className="mt-1 text-ink-soft">{residence.public_area}, CABA</p>
            {nearUniversities.length > 0 && (
              <p className="mt-3 text-sm font-medium text-forest-700">
                Cerca de {nearUniversities.join(" y ")}
              </p>
            )}
          </div>

          {/* Comunidad y Convivencia — quote + avatares + contador */}
          {(communityStatement || (community && community.totalResidents > 0)) && (
            <Card className="p-5">
              <p className="flex items-center gap-2 text-sm font-bold text-ink">
                <Icon name="diversity_3" className="text-xl text-forest-700" /> Comunidad y Convivencia
              </p>
              {communityStatement && (
                <p className="mt-3 rounded-field border-l-[3px] border-forest bg-forest-tint/40 px-4 py-3 text-sm italic leading-relaxed text-ink-soft">
                  &ldquo;{communityStatement}&rdquo;
                </p>
              )}
              {community && community.totalResidents > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {community.cards
                        .filter((c) => c.kind === "profile")
                        .slice(0, 4)
                        .map((c, i) => (
                          <span
                            key={c.residentStayId}
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-2 ring-paper ${
                              ["bg-forest-tint text-forest-700", "bg-orange-tint text-orange-700", "bg-mint text-forest-700", "bg-sand-100 text-ink-soft"][i % 4]
                            }`}
                          >
                            {c.firstName?.[0]?.toUpperCase() ?? "?"}
                          </span>
                        ))}
                      {community.totalResidents > 4 && (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-[11px] font-bold text-white ring-2 ring-paper">
                          +{community.totalResidents - 4}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-ink">{community.totalResidents} residentes actuales</p>
                  </div>
                  <Link
                    href={`/residencias/${slug}/comunidad`}
                    className="text-sm font-bold text-forest-700 hover:underline"
                  >
                    Ver todos los perfiles →
                  </Link>
                </div>
              )}
            </Card>
          )}

          {residence.description && (
            <section>
              <h2 className="text-xl font-bold text-ink">Sobre la residencia</h2>
              <p className="mt-3 leading-relaxed text-ink-soft">{residence.description}</p>
            </section>
          )}

          {/* 1. Servicios incluidos */}
          {services.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-ink">Servicios incluidos</h2>
              <div className="mt-4">
                <AmenityGrid items={services.map((s) => ({ name: s, ...getServiceIcon(s) }))} />
              </div>
            </section>
          )}

          {/* 2. Áreas comunes */}
          {commonAreas.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-ink">Áreas comunes</h2>
              <div className="mt-4">
                <AmenityGrid items={commonAreas.map((a) => ({ name: a, ...getCommonAreaIcon(a) }))} />
              </div>
            </section>
          )}

          {/* 3. Reglas de convivencia — top 5 + PDF, no el reglamento completo en texto */}
          {(rulesSummary || rulesPdfUrl) && (
            <section>
              <h2 className="text-xl font-bold text-ink">Reglas de convivencia</h2>
              <div className="mt-4">
                <RulesHighlight rulesSummary={rulesSummary} pdfUrl={rulesPdfUrl} />
              </div>
            </section>
          )}

          {/* 4. Preguntas frecuentes */}
          <section id="preguntas" className="scroll-mt-24">
            <h2 className="text-xl font-bold text-ink">Preguntas frecuentes</h2>
            {faqItems.length > 0 && (
              <div className="mt-4">
                <FaqAccordion items={faqItems} />
              </div>
            )}
            <div className="mt-4">
              {isOwnResidenceTeam ? (
                <p className="rounded-card border-[1.5px] border-line bg-paper px-5 py-4 text-sm text-ink-soft">
                  Las preguntas que reciba esta residencia las ves y respondés desde{" "}
                  <Link href={`/residence/${residence.id}/faq`} className="font-bold text-forest-700 hover:underline">
                    tu panel
                  </Link>
                  .
                </p>
              ) : (
                <AskQuestionForm residenceId={residence.id} signedIn={!!sessionUser} />
              )}
            </div>
          </section>

        </div>

        <aside id="solicitud" className="scroll-mt-24">
          <Card className="p-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
            {!sessionUser ? (
              <>
                <p className="text-sm text-ink-soft">
                  Necesitás una cuenta de estudiante para enviar una solicitud de reserva.
                </p>
                <Button href={`/login?next=/residencias/${slug}`} size="lg" className="mt-4 w-full">
                  Iniciar sesión
                </Button>
                <Button href="/register/student" variant="outline" size="lg" className="mt-2 w-full">
                  Crear cuenta de estudiante
                </Button>
              </>
            ) : sessionUser.roles.includes("family_member") ? (
              <>
                {linkedStudents.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {linkedStudents.map((s) => (
                      <FavoriteButton
                        key={s.id}
                        action={toggleFamilyFavorite.bind(null, residence.id, s.id)}
                        initialFavorited={linkedStudentsFavorited.has(s.id)}
                        label={
                          linkedStudentsFavorited.has(s.id)
                            ? `Sugerida a ${s.first_name}`
                            : `Sugerir a ${s.first_name}`
                        }
                      />
                    ))}
                  </div>
                )}
                <ProposeForm residenceId={residence.id} roomTypes={roomTypes} students={linkedStudents} />
              </>
            ) : !sessionUser.roles.includes("student") ? (
              <p className="text-sm text-ink-soft">
                Solo cuentas de estudiante o familiares vinculados pueden actuar acá.
              </p>
            ) : minorBlock === "no_family" ? (
              <>
                <p className="flex items-center gap-2 font-bold text-ink">
                  <Icon name="family_restroom" className="text-xl text-forest-700" />
                  Primero, vinculá a un familiar
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Como sos menor de 18, necesitás un familiar vinculado (con su teléfono cargado) para
                  enviar solicitudes de reserva. Invitalo/a por email desde tu panel; cuando se registre, vos
                  aprobás la vinculación. Mientras tanto podés seguir explorando.
                </p>
                <Button href="/students/dashboard#vinculacion" size="lg" className="mt-4 w-full">
                  Invitar a un familiar
                </Button>
              </>
            ) : minorBlock === "no_phone" ? (
              <>
                <p className="flex items-center gap-2 font-bold text-ink">
                  <Icon name="phone_in_talk" className="text-xl text-forest-700" />
                  Falta el teléfono de tu familiar
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Tu familiar ya está vinculado, pero no tiene un teléfono de contacto cargado, y como sos
                  menor de 18 la residencia lo contacta a él o ella. Hoy no podés completarlo desde tu cuenta:
                  escribinos desde Soporte y lo resolvemos. Mientras tanto podés seguir explorando.
                </p>
                <Button href="/students/support" size="lg" className="mt-4 w-full">
                  Ir a Soporte
                </Button>
              </>
            ) : (
              <ApplyForm
                residenceId={residence.id}
                roomTypes={roomTypes}
                conditions={conditions}
                arsPerUsd={rate.arsPerUsd}
                profileCompletenessPercent={profileCompletenessPercent}
              />
            )}
            <p className="mt-4 text-xs text-ink-faint">
              Enviar una solicitud no garantiza tu lugar: la residencia la revisa y responde. Toda
              reserva está sujeta a confirmación.
            </p>
          </Card>
        </aside>
      </div>

      {/* 5. Comunidad y Disponibilidad — a propósito FUERA de la grilla de
          2 columnas de arriba: usa el ancho completo de la página (más
          lugar para las secciones por tipo de habitación) y hace que el
          panel "Tu solicitud de reserva" (sticky solo dentro de esa
          grilla) se libere y baje con el resto del contenido apenas se
          llega acá, en vez de seguir clavado durante toda esta sección
          — pedido explícito del dueño en Ciclo 35octodevicies. Elegir
          una plaza libre sigue completando el formulario en tiempo real
          vía ReservationSelectionProvider, sin depender de que el panel
          esté a la vista. */}
      <section id="disponibilidad" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-bold text-ink">Comunidad y disponibilidad</h2>
        <p className="mt-3 flex items-start gap-2 rounded-field bg-info-bg px-3.5 py-2.5 text-xs leading-relaxed text-info-fg">
          <Icon name="info" className="mt-0.5 shrink-0 text-sm" />
          La convivencia es dinámica: los perfiles mostrados son los actuales, pero pueden cambiar antes de tu
          ingreso. Cada estudiante decide qué mostrar.
        </p>
        {community && (community.totalResidents > 0 || community.totalAvailable > 0) ? (
          <div className="mt-4">
            <CommunityBrowser summary={community} slug={slug} isGuest={!sessionUser} />
          </div>
        ) : roomTypes.length > 0 ? (
          <div className="mt-4 space-y-3">
            {roomTypes.map((rt) => {
              const isFull = rt.profile_availability?.status === "full";
              return (
                <div
                  key={rt.id}
                  className={`flex items-center justify-between gap-3 rounded-card border-[1.5px] p-4 ${
                    isFull ? "border-line bg-cream-2/50" : "border-line bg-paper shadow-card"
                  }`}
                >
                  <p className="font-bold text-ink">{rt.name}</p>
                  <Link
                    href={`/residencias/${slug}?room=${rt.id}#solicitud`}
                    className={`rounded-full px-4 py-2 text-xs font-bold ${
                      isFull ? "bg-sand-100 text-ink-faint" : "bg-forest text-white hover:bg-forest-600"
                    }`}
                  >
                    {isFull ? "Sin lugar" : "Seleccionar este lugar"}
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">La residencia todavía no cargó su comunidad visible.</p>
        )}
      </section>

      {/* 6. Ubicación — mapa compacto con pin aproximado por barrio
          (nunca la dirección exacta) + universidades cercanas. También
          fuera de la grilla, mismo bloque de ancho completo. */}
      <section className="mt-10">
        <h2 className="text-xl font-bold text-ink">Ubicación</h2>
        <div className="mt-4">
          <CompactMap residenceName={residence.name} zone={residence.public_area} nearUniversityNames={nearUniversities} />
        </div>
      </section>

      <p className="mt-10 text-center text-xs text-ink-faint">
        ¿Buscás más opciones?{" "}
        <Link href="/search" className="text-forest-700 hover:underline">
          Mirá el catálogo completo
        </Link>
        .
      </p>
      {/* Espacio para que la barra fija de mobile no tape el final de la página */}
      <div className="h-[calc(5.5rem+env(safe-area-inset-bottom))] lg:hidden" aria-hidden="true" />
    </div>
    {showMobileBar && (
      <MobileRequestBar
        priceLabel={mobileBarPrice}
        ctaLabel={sessionUser?.roles.includes("family_member") ? "Proponer" : "Solicitar"}
      />
    )}
    </ReservationSelectionProvider>
  );
}
