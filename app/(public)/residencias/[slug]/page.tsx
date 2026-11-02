import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrustBadge } from "@/components/residences/TrustBadge";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";
import { Icon } from "@/components/ui/Icon";
import { getCommunityVisibility } from "@/lib/residents/communityVisibility";
import { AmenityGrid } from "@/components/residences/AmenityGrid";
import { getApprovedCustomAmenities } from "@/lib/residences/customAmenitiesDb";
import { RulesHighlight } from "@/components/residences/RulesHighlight";
import { FaqAccordion } from "@/components/residences/FaqAccordion";
import { assertResidenceAccess } from "@/lib/residences/access";
import { getPublicAnsweredQuestions } from "@/lib/faq/getPublicAnsweredQuestions";
import { getPublicCatalogFaq } from "@/lib/faq/residenceCatalog";
import { loadCurrentRegulation } from "@/lib/regulations/current";
import { RegulationModal } from "@/components/residences/ficha/RegulationModal";
import { MODEL_LEGAL_NOTE } from "@/lib/regulations/modelTemplate";
import { RegulationText } from "@/components/regulations/RegulationText";
import { formatDate } from "@/lib/dates/format";
import { AskQuestionForm } from "@/app/(public)/residencias/[slug]/AskQuestionForm";
import { CompactMap } from "@/components/residences/CompactMap";
import { getServiceIcon, getCommonAreaIcon } from "@/lib/residences/amenityIcons";
import { serviceLabel } from "@/lib/residences/options";
import { FICHA_FAQ_VISIBLE } from "@/lib/faq/catalog";
import { GuidePicks } from "@/components/guides/GuidePicks";
import { MoveInGuideNote } from "@/components/guides/MoveInGuideNote";
import { ApplyForm } from "@/app/(public)/residencias/[slug]/ApplyForm";
import { ProposeForm } from "@/app/(public)/residencias/[slug]/ProposeForm";
import { FavoriteButton } from "@/app/(public)/residencias/[slug]/FavoriteButton";
import { toggleStudentFavorite, toggleFamilyFavorite } from "@/app/students/favorites/actions";
import { JoinWaitlistForm } from "@/app/(public)/residencias/[slug]/JoinWaitlistForm";
import { formatUsd, usdToArsRounded } from "@/lib/mock/exchange";
import { getResidenceLocation } from "@/lib/residences/residenceLocation";
import { effectiveRoomGender, policyFromGender, summarizeTypeGenders } from "@/lib/residences/roomGender";
import { startingPriceUsd, typeAvailabilityState } from "@/lib/availability/typeAvailability";
import { initialPaymentConfigFromRow } from "@/lib/reservations/initialPayment";
import { ReservationSelectionProvider } from "@/components/residences/reservationSelection";
import { ResidenceGallery } from "@/components/residences/ResidenceGallery";
import { buildGalleryPhotos, loadPhotoMeta } from "@/lib/residences/photoMetaDb";
import { loadResidencePromotions } from "@/lib/residences/promotions";
import { loadVacancyOutlooks } from "@/lib/residences/vacancy";
import { applyPromotion, normalizeDepositMode, pickActivePromotion, todayIso } from "@/lib/applications/reservationMoney";
import { computeCapacity, formatOccupancy, residentsToDisplay } from "@/lib/residences/occupancy";
import { loadFamilyViewer, loadStudentViewer, type LinkedStudent, type StudentViewer } from "@/app/(public)/residencias/[slug]/loadViewerContext";
import { findUniversitiesByName, haversineDistanceKm } from "@/lib/data/buenosAiresUniversities";
import { monthsLabel, roomTypeSubtitle } from "@/lib/residences/fichaConditions";
import { isTypeRequestable } from "@/lib/availability/typeAvailability";
import { resolveRequestPanelMode } from "@/lib/residences/requestPanelMode";
import type { FichaRoomType } from "@/components/residences/ficha/types";
import { SectionNav, type SectionNavItem } from "@/components/residences/ficha/SectionNav";
import { ReadMore } from "@/components/residences/ficha/ReadMore";
import { RatesTable } from "@/components/residences/ficha/RatesTable";
import { ReservationConditions } from "@/components/residences/ficha/ReservationConditions";
import { EarlyExitPolicy } from "@/components/residences/ficha/EarlyExitPolicy";
import { WhoGetsPaid } from "@/components/residences/ficha/WhoGetsPaid";
import { VerificationScope } from "@/components/residences/ficha/VerificationScope";
import { CommunitySummary } from "@/components/residences/ficha/CommunitySummary";
import { RequestHowItWorks, RequestNotices } from "@/components/residences/ficha/RequestNotices";
import { RequestSheet } from "@/components/residences/ficha/RequestSheet";
import { describeAgeRange } from "@/lib/residences/age";
import { SITE_URL } from "@/lib/siteUrl";

const FICHA_GENDER_LABEL: Record<string, string> = { mixto: "Mixta", solo_hombres: "Solo hombres", solo_mujeres: "Solo mujeres" };

export const dynamic = "force-dynamic";

/**
 * Una sola lectura por request: `generateMetadata` y la página la llaman, y `cache` evita repetir las ~6 consultas.
 * Cada consulta chequea su `error`: se registra y la ficha degrada (sin fotos, sin tipos, etc.) en vez de caerse.
 */
const loadResidence = cache(async (slug: string) => {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const { data: residence, error: residenceError } = await admin
    .from("residences")
    .select("*")
    .eq("slug", slug)
    .eq("status", "verified_active")
    .maybeSingle();
  if (residenceError) console.error("[ficha] no se pudo leer la residencia:", residenceError);
  if (!residence) return null;

  const [roomTypesRes, roomsRes, sectionsRes, photosRes, rulesFileRes, photoMeta, staysRes, promotionsRes] = await Promise.all([
    admin
      .from("room_types")
      .select(
        "id, name, monthly_price_usd, capacity_per_room, gender_policy, bathroom_type, profile_availability(status, available_count)",
      )
      .eq("residence_id", residence.id)
      .eq("is_active", true),
    // "*": degrada sin error si la migración 0057 (rooms.gender) aún no está aplicada.
    admin.from("rooms").select("*").eq("residence_id", residence.id).eq("is_active", true),
    admin.from("residence_profile_sections").select("section_type, content").eq("residence_id", residence.id),
    admin
      .from("files")
      .select("id, storage_path")
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
    // DR18 (tanda 2): clasificación de fotos (degrada a «todo general» sin la 0059) y residentes vigentes para «plazas · residentes».
    loadPhotoMeta(admin, [residence.id]),
    admin
      .from("resident_stays")
      .select("id", { count: "exact", head: true })
      .eq("residence_id", residence.id)
      .eq("is_current", true)
      .neq("status", "hidden_by_user")
      .neq("status", "inactive"),
    // DR18 (tanda 3): promociones de tarifa (degrada a «sin promociones» sin la 0060).
    loadResidencePromotions(admin, residence.id),
  ]);
  if (roomTypesRes.error) console.error("[ficha] no se pudieron leer los tipos de habitación:", roomTypesRes.error);
  // Mes vacío confirmado: la ocupación futura por tipo solo se lee si la residencia configuró un % de mes vacío.
  const vacancyByType =
    Number(residence.empty_month_charge_percent) > 0
      ? await loadVacancyOutlooks(admin, residence.id, (roomTypesRes.data ?? []).map((rt) => rt.id as string), todayIso())
      : {};
  if (sectionsRes.error) console.error("[ficha] no se pudieron leer las secciones del perfil:", sectionsRes.error);
  if (photosRes.error) console.error("[ficha] no se pudieron leer las fotos:", photosRes.error);
  if (rulesFileRes.error) console.error("[ficha] no se pudo leer el reglamento:", rulesFileRes.error);

  const sectionMap = Object.fromEntries((sectionsRes.data ?? []).map((s) => [s.section_type, s.content]));
  const typeNames = new Map((roomTypesRes.data ?? []).map((rt) => [rt.id as string, rt.name as string]));
  const photos = buildGalleryPhotos(
    (photosRes.data ?? []) as { id: string; storage_path: string }[],
    photoMeta.byFileId,
    (path) => admin.storage.from("public-residence-media").getPublicUrl(path).data.publicUrl,
    typeNames,
  );
  // Plazas declaradas (Verificado) y residentes reales (solo Gestión Operativa, con estadías vigentes): sin porcentaje ni «quedan N».
  const capacityPlaces = computeCapacity(
    (roomTypesRes.data ?? []).map((rt) => ({ id: rt.id as string, capacity_per_room: rt.capacity_per_room as number | null })),
    ((roomsRes.data ?? []) as { room_type_id: string }[]).map((r) => ({ room_type_id: r.room_type_id })),
  );
  const stayCount = staysRes.error ? 0 : (staysRes.count ?? 0);
  const residentsCount = residentsToDisplay(residence.has_operational_management_access as boolean | null | undefined, stayCount);
  const occupancyLabel = formatOccupancy(capacityPlaces, residentsCount);

  let rulesPdfUrl: string | null = null;
  if (rulesFileRes.data?.storage_path) {
    const { data: signed, error: signedError } = await admin.storage
      .from("private-residence-documents")
      .createSignedUrl(rulesFileRes.data.storage_path, 3600);
    if (signedError) console.error("[ficha] no se pudo firmar el reglamento:", signedError);
    rulesPdfUrl = signed?.signedUrl ?? null;
  }

  // profile_availability tiene unique(room_type_id) — PostgREST devuelve
  // un objeto singular en el embed, no un array (a diferencia de lo que
  // el tipo inferido por supabase-js sugiere sin un schema generado).
  const normalizedRoomTypes = (roomTypesRes.data ?? []).map((rt) => {
    // Género por habitación (0057). Sin la columna o sin habitaciones: queda el género del tipo.
    const genders = ((roomsRes.data ?? []) as { room_type_id: string; gender?: string | null }[])
      .filter((r) => r.room_type_id === rt.id)
      .map((r) =>
        effectiveRoomGender({ roomGender: r.gender, typePolicy: rt.gender_policy, capacityPerRoom: rt.capacity_per_room }),
      );
    return { rt, genders };
  }).map(({ rt, genders }) => ({
    ...rt,
    // Promoción vigente de mayor % para este tipo (no se apilan); `monthly_price_usd` sigue siendo la tarifa de lista.
    promotion: pickActivePromotion(promotionsRes.promotions, rt.id, todayIso()),
    vacancy: vacancyByType[rt.id as string] ?? null,
    genderSummary: new Set(genders).size > 1 ? summarizeTypeGenders(genders) : null,
    gender_policy: new Set(genders).size === 1 ? (policyFromGender(genders[0]) ?? rt.gender_policy) : rt.gender_policy,
    profile_availability: rt.profile_availability as unknown as { status: string; available_count: number | null } | null,
  }));

  return { residence, roomTypes: normalizedRoomTypes, sectionMap, photos, rulesPdfUrl, occupancyLabel };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadResidence(slug);
  if (!data) return { title: "Residencia no encontrada", robots: { index: false, follow: false } };
  const { residence, photos } = data;
  const zone = (residence.public_area as string | null)?.trim();
  const description = zone
    ? `${residence.name}: residencia estudiantil verificada en ${zone}, CABA. Mirá fotos, servicios y reglas, y enviá tu solicitud.`
    : `${residence.name}: residencia estudiantil verificada en CABA. Mirá fotos, servicios y reglas, y enviá tu solicitud.`;
  const path = `/residencias/${slug}`;
  const image = photos[0]?.url;
  return {
    title: residence.name,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "EstuRed",
      locale: "es_AR",
      url: path,
      title: residence.name,
      description,
      ...(image ? { images: [{ url: image }] } : {}),
    },
  };
}

export default async function RealResidenceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ room?: string; solicitar?: string }>;
}) {
  const { slug } = await params;
  const { room: preselectedRoomTypeId, solicitar } = await searchParams;
  const data = await loadResidence(slug);
  if (!data) notFound();
  const { residence, roomTypes, sectionMap, photos, rulesPdfUrl, occupancyLabel } = data;

  // Lecturas independientes en paralelo: cotización, sesión y, con la sesión, todo lo que depende de quién mira.
  const adminClient = getSupabaseAdmin();
  const [rate, sessionUser] = await Promise.all([getCurrentExchangeRate(), getSessionUser()]);
  const isStudent = sessionUser?.roles.includes("student") ?? false;
  const isFamily = sessionUser?.roles.includes("family_member") ?? false;
  const [answeredQuestions, catalogFaq, isOwnResidenceTeam, community, studentViewer, familyViewer, regulationResult] = await Promise.all([
    adminClient ? getPublicAnsweredQuestions(adminClient, residence.id) : Promise.resolve([]),
    // DR14: preguntas del catálogo que la residencia eligió mostrar (agrupadas por tema). Vacío si no eligió ninguna o si la 0054 no está aplicada.
    adminClient ? getPublicCatalogFaq(adminClient, residence.id) : Promise.resolve([]),
    sessionUser && adminClient ? assertResidenceAccess(adminClient, sessionUser.id, residence.id) : Promise.resolve(false),
    adminClient ? getCommunityVisibility(adminClient, residence.id, sessionUser ? "registered" : "guest") : Promise.resolve(null),
    isStudent && sessionUser && adminClient ? loadStudentViewer(adminClient, sessionUser.id, residence.id) : Promise.resolve(null),
    isFamily && sessionUser && adminClient
      ? loadFamilyViewer(adminClient, sessionUser.id, residence.id)
      : Promise.resolve(null),
    // DR14: reglamento vigente (propio, o el modelo). `null`/`ok:false` = no se pudo leer: no se muestra ni se ofrece aceptarlo.
    adminClient ? loadCurrentRegulation(adminClient, residence.id) : Promise.resolve(null),
  ]);
  const regulation = regulationResult?.ok ? regulationResult.view : null;

  // La ubicación y la dirección de la residencia son públicas (decisión del dueño, 2026-10-23): pin exacto.
  const location = getResidenceLocation(residence);
  const addressLine = (residence.address_line as string | null)?.trim() || null;
  // DR18: los ítems «Otro» aprobados se suman a los fijos (los pendientes y rechazados nunca llegan acá; vacío si la 0058 no está aplicada).
  const customAmenities = adminClient ? await getApprovedCustomAmenities(adminClient, residence.id) : { services: [], areas: [] };
  const services = [...((sectionMap.services?.items as string[]) ?? []), ...customAmenities.services];
  const commonAreas = [...((sectionMap.common_areas?.items as string[]) ?? []), ...customAmenities.areas];
  const nearUniversities = (sectionMap.near_universities?.items as string[]) ?? [];
  const rulesSummary = (sectionMap.rules?.summary as string) ?? "";
  const staticFaqItems = (sectionMap.faq?.items as { question: string; answer: string }[]) ?? [];
  const communityStatement = (sectionMap.community_statement?.quote as string) ?? "";
  // El equipo de ESTA residencia no se pregunta a sí mismo: en vez del formulario ve un aviso (responde desde su panel).
  // Orden (DR14): primero las del catálogo agrupadas por tema, después las fijas del perfil y al final las libres respondidas.
  const otherFaqGroup = catalogFaq.length > 0 ? "Otras preguntas" : undefined;
  const faqItems: { question: string; answer: string; fromVisitor?: boolean; group?: string }[] = [
    ...catalogFaq.flatMap((g) => g.items.map((q) => ({ ...q, group: g.label }))),
    ...staticFaqItems.map((q) => ({ ...q, group: otherFaqGroup })),
    ...answeredQuestions.map((q) => ({ ...q, fromVisitor: true, group: otherFaqGroup })),
  ];

  // Condiciones de reserva a nivel residencia (migración 0025).
  const conditions = {
    minimumStayMonths: residence.minimum_stay_months != null ? Number(residence.minimum_stay_months) : null,
    adjustmentPolicy: (residence.adjustment_policy as string | null) ?? null,
    enrollmentFeeMode: (residence.enrollment_fee_mode as "one_month" | "manual" | null) ?? null,
    enrollmentFeeUsd: residence.enrollment_fee_usd != null ? Number(residence.enrollment_fee_usd) : null,
    enrollmentFeeFrequency: (residence.enrollment_fee_frequency as "once" | "annual") ?? "once",
    depositUsd: residence.deposit_usd != null ? Number(residence.deposit_usd) : null,
    depositMode: normalizeDepositMode(residence.deposit_mode),
    enrollmentDiscountPercent:
      residence.enrollment_discount_percent != null ? Number(residence.enrollment_discount_percent) : null,
    enrollmentDiscountUntil: (residence.enrollment_discount_until as string | null) ?? null,
    emptyMonthChargePercent:
      residence.empty_month_charge_percent != null ? Number(residence.empty_month_charge_percent) : null,
    initialPayment: initialPaymentConfigFromRow(residence),
    // DR3: política de salida anticipada (dato listo para el bloque "Si te vas antes" de la ficha; lo dibuja `interfaz`).
    earlyExitDepositClausesText: (residence.early_exit_deposit_clauses_text as string | null) ?? null,
    earlyExitCostsText: (residence.early_exit_costs_text as string | null) ?? null,
    earlyExitConditionsText: (residence.early_exit_conditions_text as string | null) ?? null,
  };

  const profileCompletenessPercent = (studentViewer as StudentViewer | null)?.profileCompletenessPercent ?? null;
  const studentFavorited = studentViewer?.studentFavorited ?? false;
  const minorBlock = studentViewer?.minorBlock ?? null;
  const windowNotice = studentViewer?.windowNotice ?? null;
  const linkedStudents: LinkedStudent[] = familyViewer?.linkedStudents ?? [];
  const linkedStudentsFavorited = familyViewer?.favorited ?? new Set<string>();

  const mode = resolveRequestPanelMode({
    roles: sessionUser?.roles ?? null,
    isOwnResidenceTeam,
    minorBlock,
    linkedStudentsCount: linkedStudents.length,
  });

  // Tipos de habitación listos para mostrar: la disponibilidad sale SOLO del tipo (D3/H03).
  const fichaTypes: FichaRoomType[] = roomTypes.map((rt) => ({
    id: rt.id,
    name: rt.name,
    priceUsd: applyPromotion(Number(rt.monthly_price_usd), rt.promotion?.discountPercent),
    ...(rt.promotion
      ? {
          listPriceUsd: Number(rt.monthly_price_usd),
          promotion: { label: rt.promotion.label, percent: rt.promotion.discountPercent, endsOn: rt.promotion.endsOn },
        }
      : {}),
    arsRounded: usdToArsRounded(applyPromotion(Number(rt.monthly_price_usd), rt.promotion?.discountPercent), rate.arsPerUsd),
    subtitle: roomTypeSubtitle({
      capacityPerRoom: rt.capacity_per_room,
      genderPolicy: rt.gender_policy,
      bathroomType: rt.bathroom_type,
      genderSummary: rt.genderSummary,
    }),
    ...(Number(rt.capacity_per_room) > 0 ? { capacity: Number(rt.capacity_per_room) } : {}),
    ...(rt.genderSummary || (rt.gender_policy && FICHA_GENDER_LABEL[rt.gender_policy])
      ? { genderLabel: rt.genderSummary || FICHA_GENDER_LABEL[rt.gender_policy as string] }
      : {}),
    ...(rt.bathroom_type === "privado" || rt.bathroom_type === "compartido" ? { bathroom: rt.bathroom_type } : {}),
    state: typeAvailabilityState(rt.profile_availability?.status),
  }));

  // "Desde" = mínimo de los tipos NO completos (D3/H03; si todos están completos, el mínimo de todos).
  const fromPriceUsd = startingPriceUsd(fichaTypes.map((t) => ({ priceUsd: t.priceUsd, state: t.state })));

  const nearest = findUniversitiesByName(nearUniversities)
    .map((u) => ({ name: u.name, km: haversineDistanceKm(location, u) }))
    .sort((a, b) => a.km - b.km)[0];
  const typeNames = fichaTypes.map((t) => t.name.toLowerCase());
  const typesChip =
    typeNames.length > 1
      ? `${typeNames.slice(0, -1).join(", ")} y ${typeNames[typeNames.length - 1]}`
      : (typeNames[0] ?? "");
  const hasCommunity = !!communityStatement || (community?.totalResidents ?? 0) > 0;

  const hasServices = services.length > 0 || commonAreas.length > 0;
  const hasAge = residence.min_resident_age !== undefined;
  const hasRules = !!rulesSummary || !!rulesPdfUrl || !!regulation;
  const navItems: SectionNavItem[] = [
    ...(hasServices ? [{ id: "servicios", label: "Servicios" }] : []),
    ...(hasAge ? [{ id: "edad", label: "Edad" }] : []),
    ...(hasRules ? [{ id: "convivencia", label: "Convivencia" }] : []),
    ...(hasCommunity ? [{ id: "comunidad", label: "Comunidad" }] : []),
    { id: "tarifas", label: "Tarifas y condiciones" },
    { id: "pagos", label: "Qué pagás" },
    { id: "verificacion", label: "Qué revisamos" },
    { id: "ubicacion", label: "Ubicación" },
    { id: "preguntas", label: "Preguntas" },
  ];
  const showStudentFavoriteInHeader = isStudent;
  const singleStudentName = linkedStudents.length === 1 ? linkedStudents[0].first_name : null;
  // Lista de espera: solo tipos completos, y nunca el tipo en el que ya tiene una reserva vigente en ESTA residencia.
  const ownTypeIds = new Set(studentViewer?.ownReservationTypeIds ?? []);
  const waitlistTypeIds = fichaTypes.filter((t) => t.state === "full" && !ownTypeIds.has(t.id)).map((t) => t.id);
  const waitlistRoomTypes = roomTypes.filter((rt) => !ownTypeIds.has(rt.id));
  const anyRequestable = fichaTypes.some((t) => isTypeRequestable(t.state));
  // Vuelta del login con `?solicitar=1`: abre la hoja que corresponde (solicitud con el tipo elegido, o lista de espera).
  const preselectedType = fichaTypes.find((t) => t.id === preselectedRoomTypeId);
  const initialSheet: "request" | "waitlist" | null =
    solicitar !== "1"
      ? null
      : mode === "family"
        ? "request"
        : mode === "student"
          ? preselectedType && isTypeRequestable(preselectedType.state)
            ? "request"
            : (preselectedType ? waitlistTypeIds.includes(preselectedType.id) : !anyRequestable) && waitlistTypeIds.length > 0
              ? "waitlist"
              : null
          : null;

  // Contenido del servidor para los modos sin acción interactiva (SPEC §5).
  let panelSlot: React.ReactNode = null;
  if (mode === "family") {
    panelSlot =
      linkedStudents.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {linkedStudents.map((s) => (
            <FavoriteButton
              key={s.id}
              action={toggleFamilyFavorite.bind(null, residence.id, s.id)}
              initialFavorited={linkedStudentsFavorited.has(s.id)}
              label={linkedStudentsFavorited.has(s.id) ? `Sugerida a ${s.first_name}` : `Sugerir a ${s.first_name}`}
            />
          ))}
        </div>
      ) : null;
  } else if (mode === "family_unlinked") {
    panelSlot = (
      <p className="text-sm leading-relaxed text-ink-soft">
        Necesitás tener al menos un estudiante vinculado activo para proponerle una residencia.
      </p>
    );
  } else if (mode === "minor_no_family") {
    panelSlot = (
      <>
        <p className="flex items-center gap-2 font-bold text-ink">
          <Icon name="family_restroom" className="text-xl text-forest-700" />
          Primero, vinculá a un familiar
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Como sos menor de 18, necesitás un familiar vinculado (con su teléfono cargado) para enviar solicitudes de
          reserva. Invitá a tu familiar por email desde tu panel; cuando se registre, vos aprobás la vinculación. Mientras tanto
          podés seguir explorando.
        </p>
        <Button href="/students/dashboard#vinculacion" size="lg" className="mt-4 w-full">
          Invitar a un familiar
        </Button>
      </>
    );
  } else if (mode === "minor_no_phone") {
    panelSlot = (
      <>
        <p className="flex items-center gap-2 font-bold text-ink">
          <Icon name="phone_in_talk" className="text-xl text-forest-700" />
          Falta el teléfono de tu familiar
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Tu familiar ya está vinculado, pero no tiene un teléfono de contacto cargado, y como sos menor de 18 la
          residencia lo contacta a él o ella. Hoy no podés completarlo desde tu cuenta: escribinos desde Soporte y lo
          resolvemos. Mientras tanto podés seguir explorando.
        </p>
        <Button href="/students/support" size="lg" className="mt-4 w-full">
          Ir a Soporte
        </Button>
      </>
    );
  } else if (mode === "team") {
    panelSlot = (
      <>
        <p className="flex items-center gap-2 font-bold text-ink">
          <Icon name="visibility" className="text-xl text-forest-700" />
          Vista previa
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">Así ven tu ficha los estudiantes.</p>
        <Button href={`/residence/${residence.id}/profile`} size="lg" className="mt-4 w-full">
          Editar perfil de la residencia
        </Button>
        <Button href={`/residence/${residence.id}/availability`} variant="outline" size="lg" className="mt-2 w-full">
          Actualizar disponibilidad
        </Button>
      </>
    );
  } else if (mode === "other") {
    panelSlot = (
      <p className="text-sm leading-relaxed text-ink-soft">
        Solo cuentas de estudiante o familiares vinculados pueden actuar acá.
      </p>
    );
  }

  const minimumStayLabel =
    conditions.minimumStayMonths != null && conditions.minimumStayMonths > 0 ? monthsLabel(conditions.minimumStayMonths) : null;
  const hasDeposit =
    !!conditions.depositMode || (conditions.depositUsd != null && conditions.depositUsd > 0);

  const chipClass =
    "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-paper px-3 py-1.5 text-sm text-ink-soft";

  return (
    <ReservationSelectionProvider initialRoomTypeId={preselectedRoomTypeId} initialSheet={initialSheet}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LodgingBusiness",
            name: residence.name,
            url: `${SITE_URL}/residencias/${slug}`,
            address: {
              "@type": "PostalAddress",
              ...(addressLine ? { streetAddress: addressLine } : {}),
              addressLocality: residence.public_area || "Ciudad Autónoma de Buenos Aires",
              addressRegion: "CABA",
              addressCountry: "AR",
            },
            ...(photos[0]?.url ? { image: photos[0].url } : {}),
          }).replace(/</g, "\\u003c"),
        }}
      />
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6 sm:pb-14">
        <nav aria-label="Ruta de navegación" className="mb-4 text-sm text-ink-faint">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/search" className="hover:text-forest-700 hover:underline">
                Residencias
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li>{residence.public_area}</li>
            <li aria-hidden="true">›</li>
            <li aria-current="page" className="font-semibold text-ink-soft">
              {residence.name}
            </li>
          </ol>
        </nav>

        {/* Hero de fotos — se adapta a la cantidad (0 / 1 / 2–4 / 5+), Ciclo 54 (D12) */}
        <ResidenceGallery photos={photos} name={residence.name} zone={residence.public_area ?? ""} />

        <header className="mt-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-ink sm:text-4xl">{residence.name}</h1>
            <TrustBadge status="verified_active" size="md" />
            {/* Favorito — cerca del título, no compite con el panel de solicitud */}
            {showStudentFavoriteInHeader && (
              <FavoriteButton action={toggleStudentFavorite.bind(null, residence.id)} initialFavorited={studentFavorited} />
            )}
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-ink-soft">
            <Icon name="location_on" className="text-lg text-orange-700" />
            {addressLine ? `${addressLine}, ` : ""}
            {residence.public_area}, CABA
          </p>

          <ul className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {fromPriceUsd != null && (
              <li className={chipClass}>
                <Icon name="payments" className="text-lg text-forest-700" />
                Desde <strong className="text-ink">{formatUsd(fromPriceUsd)}</strong> /mes
              </li>
            )}
            {typesChip && (
              <li className={chipClass}>
                <Icon name="bed" className="text-lg text-forest-700" />
                <span className="first-letter:uppercase">{typesChip}</span>
              </li>
            )}
            {minimumStayLabel && (
              <li className={chipClass}>
                <Icon name="event_available" className="text-lg text-forest-700" />
                Estadía mínima <strong className="text-ink">{minimumStayLabel}</strong>
              </li>
            )}
            {nearest && (
              <li className={chipClass}>
                <Icon name="school" className="text-lg text-forest-700" />
                ~{nearest.km.toFixed(1).replace(".", ",")} km de {nearest.name}
              </li>
            )}
            {/* DR18: «plazas · residentes», sin porcentaje ni «quedan N». Sin plazas declaradas queda el conteo de la comunidad. */}
            {occupancyLabel ? (
              <li className={chipClass}>
                <Icon name="groups" className="text-lg text-forest-700" />
                <strong className="font-semibold text-ink">{occupancyLabel}</strong>
              </li>
            ) : (
              (community?.totalResidents ?? 0) > 0 && (
                <li className={chipClass}>
                  <Icon name="groups" className="text-lg text-forest-700" />
                  {community?.totalResidents} residentes
                </li>
              )
            )}
          </ul>

          {residence.description && (
            <div className="mt-4 max-w-3xl">
              <ReadMore text={residence.description} />
            </div>
          )}
        </header>

        <div className="mt-5">
          <SectionNav items={navItems} />
        </div>

        <div className="mt-8 grid gap-y-8">
          {/* DR30 §3 (1) Servicios y áreas comunes — horizontal, con íconos */}
          {(services.length > 0 || commonAreas.length > 0) && (
            <section id="servicios" className="scroll-mt-32 space-y-4">
              <h2 className="text-2xl font-bold text-ink">Servicios y áreas comunes</h2>
              {services.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-ink-faint">Servicios incluidos</h3>
                  <div className="mt-2">
                    <AmenityGrid layout="chips" items={services.map((s) => ({ name: serviceLabel(s), ...getServiceIcon(s) }))} />
                  </div>
                </div>
              )}
              {commonAreas.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-ink-faint">Áreas comunes</h3>
                  <div className="mt-2">
                    <AmenityGrid layout="chips" items={commonAreas.map((a) => ({ name: a, ...getCommonAreaIcon(a) }))} />
                  </div>
                </div>
              )}
            </section>
          )}

          {/* (2) Edad de los residentes (DR14): oculta si la migración 0052 no está aplicada. */}
          {residence.min_resident_age !== undefined && (
            <section id="edad" className="scroll-mt-32 space-y-3">
              <h2 className="text-2xl font-bold text-ink">Edad de los residentes</h2>
              <p className="text-ink-soft">
                {describeAgeRange({
                  minResidentAge: residence.min_resident_age as number | null | undefined,
                  maxResidentAge: residence.max_resident_age as number | null | undefined,
                  acceptsMinors: residence.accepts_minors as boolean | null | undefined,
                })}
                .
              </p>
              {residence.accepts_minors === true && (
                <div className="rounded-card border border-line bg-paper p-5">
                  <h3 className="text-base font-bold text-ink">Para menores de 18</h3>
                  <p className="mt-2 text-sm text-ink-soft">
                    Esta residencia admite residentes menores de 18. Consultá con la residencia las condiciones que aplican y, al solicitar,
                    tu guardián deberá confirmar la solicitud. La solicitud queda sujeta a confirmación de la residencia.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* (3) Reglas de convivencia (top 5) + reglamento para leer (modal) y descargar. Se acepta al enviar la solicitud. */}
          {(rulesSummary || rulesPdfUrl || regulation) && (
            <section id="convivencia" className="scroll-mt-32 space-y-3">
              <h2 className="text-2xl font-bold text-ink">Reglas de convivencia</h2>
              <RulesHighlight
                rulesSummary={rulesSummary}
                pdfUrl={rulesPdfUrl}
                slug={slug}
                hasRegulation={!!regulation}
                regulationActions={
                  regulation ? (
                    <RegulationModal
                      title="Reglamento de convivencia"
                      intro={`${
                        regulation.isBaseModel
                          ? "Esta residencia todavía no cargó su propio reglamento: te mostramos el modelo de convivencia de EstuRed. Consultá con la residencia los puntos que quieras confirmar."
                          : regulation.source === "model"
                            ? "Reglamento de convivencia de la residencia, adaptado a partir del modelo de EstuRed."
                            : "Reglamento de convivencia de la residencia."
                      } Lo aceptás al enviar tu solicitud; esa aceptación no asegura el lugar (solicitud sujeta a confirmación).${
                        regulation.versionNumber != null && regulation.publishedAt && !regulation.isBaseModel
                          ? ` Versión ${regulation.versionNumber}, publicada el ${formatDate(regulation.publishedAt)}.`
                          : ""
                      }`}
                      footnote={regulation.isBaseModel ? MODEL_LEGAL_NOTE : null}
                      downloadHref={`/residencias/${slug}/reglamento`}
                    >
                      <RegulationText text={regulation.text} />
                    </RegulationModal>
                  ) : undefined
                }
              />
            </section>
          )}

          {/* (4) Comunidad y convivencia — resumen por tipo (D18); el mapa de camas vive en /comunidad */}
          {hasCommunity && (
            <section id="comunidad" className="scroll-mt-32 space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-ink">Comunidad y convivencia</h2>
                <p className="mt-1 text-sm text-ink-soft">Quiénes viven hoy en la residencia.</p>
              </div>
              <CommunitySummary slug={slug} community={community} statement={communityStatement} isGuest={!sessionUser} />
            </section>
          )}

          {/* (5) Tarifas + condiciones + salida anticipada — visible para TODOS (H10 / D17) */}
          <section id="tarifas" className="scroll-mt-32 space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-ink">Tarifas y condiciones</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Precios mensuales por tipo de habitación, visibles para todos. La disponibilidad la informa la
                residencia por tipo.
              </p>
            </div>
            <RequestNotices
              mode={mode}
              roomTypes={fichaTypes}
              slot={panelSlot}
              windowNotice={windowNotice}
              studentName={singleStudentName}
            />
            {fichaTypes.length > 0 ? (
              <RatesTable
                roomTypes={fichaTypes}
                arsPerUsd={rate.arsPerUsd}
                waitlistTypeIds={mode === "student" ? waitlistTypeIds : []}
                mode={mode}
                slug={slug}
              />
            ) : (
              <EmptyState
                icon="request_quote"
                title="La residencia todavía no publicó sus tarifas"
                description="Podés hacerle una pregunta o seguir mirando otras residencias."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button href="#preguntas" variant="outline" size="sm">
                      Hacer una pregunta
                    </Button>
                    <Button href="/search" size="sm">
                      Ver más residencias
                    </Button>
                  </div>
                }
              />
            )}
            {(mode === "guest" || mode === "student") && anyRequestable && <RequestHowItWorks />}
            <ReservationConditions conditions={conditions} arsPerUsd={rate.arsPerUsd} />
            <EarlyExitPolicy
              depositClausesText={conditions.earlyExitDepositClausesText}
              costsText={conditions.earlyExitCostsText}
              conditionsText={conditions.earlyExitConditionsText}
            />
          </section>

          {/* (6) Qué pagás y a quién */}
          <div id="pagos" className="scroll-mt-32">
            <WhoGetsPaid
              forFamily={mode === "family"}
              initialPayment={conditions.initialPayment}
              hasDeposit={hasDeposit}
              enrollment={{
                mode: conditions.enrollmentFeeMode,
                usd: conditions.enrollmentFeeUsd,
                frequency: conditions.enrollmentFeeFrequency,
              }}
            />
          </div>

          {/* (7) Qué revisó EstuRed */}
          <div id="verificacion" className="scroll-mt-32">
            <VerificationScope />
          </div>

          {/* (8) Ubicación — pin exacto + dirección pública + universidades con distancia (DF5) */}
          <section id="ubicacion" className="scroll-mt-32 space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-ink">Ubicación</h2>
              <p className="mt-1 text-sm text-ink-soft">
                {addressLine ? `${addressLine}, ${residence.public_area}, CABA.` : `${residence.public_area}, CABA.`}
              </p>
            </div>
            <CompactMap
              residenceName={residence.name}
              zone={residence.public_area}
              nearUniversityNames={nearUniversities}
              location={location}
              address={addressLine}
            />
          </section>

          {/* Lectura previa: guías generales de EstuRed, separadas del reglamento propio de la residencia. */}
          <div className="lg:col-start-1">
            <GuidePicks keys={["01", "03"]} variant="strip" label="Antes de reservar, leé:" />
          </div>

          {/* (9) Preguntas frecuentes */}
          <section id="preguntas" className="scroll-mt-32">
            <h2 className="text-2xl font-bold text-ink">Preguntas frecuentes</h2>
            {faqItems.length > 0 && (
              <div className="mt-4">
                <FaqAccordion items={faqItems} visibleLimit={FICHA_FAQ_VISIBLE} />
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

        <p className="mt-10 text-center text-xs text-ink-faint">
          ¿Buscás más opciones?{" "}
          <Link href="/search" className="text-forest-700 hover:underline">
            Mirá el catálogo completo
          </Link>
          .
        </p>
      </div>

      {(mode === "student" || mode === "family") && (
        <RequestSheet
          residenceName={residence.name}
          windowNotice={windowNotice}
          variant={mode === "family" ? "propose" : "apply"}
          requestContent={
            mode === "family" ? (
              <ProposeForm
                residenceId={residence.id}
                roomTypes={roomTypes.map((rt) => ({ ...rt, promotion_percent: rt.promotion?.discountPercent ?? null, vacancy: rt.vacancy }))}
                students={linkedStudents}
                moveInNotice={<MoveInGuideNote />}
                conditions={{
                  minimumStayMonths: conditions.minimumStayMonths,
                  enrollmentFeeMode: conditions.enrollmentFeeMode,
                  enrollmentFeeUsd: conditions.enrollmentFeeUsd,
                  enrollmentFeeFrequency: conditions.enrollmentFeeFrequency,
                  depositUsd: conditions.depositUsd,
                  depositMode: conditions.depositMode,
                  enrollmentDiscountPercent: conditions.enrollmentDiscountPercent,
                  enrollmentDiscountUntil: conditions.enrollmentDiscountUntil,
                  emptyMonthChargePercent: conditions.emptyMonthChargePercent,
                  initialPayment: conditions.initialPayment,
                }}
                arsPerUsd={rate.arsPerUsd}
              />
            ) : (
              <ApplyForm
                residenceId={residence.id}
                moveInNotice={<MoveInGuideNote />}
                regulation={
                  regulation
                    ? {
                        hash: regulation.hash,
                        content: <RegulationText text={regulation.text} className="max-h-72 overflow-y-auto pr-2" />,
                        isModel: regulation.isBaseModel,
                      }
                    : null
                }
                roomTypes={roomTypes.map((rt) => ({ ...rt, promotion_percent: rt.promotion?.discountPercent ?? null, vacancy: rt.vacancy }))}
                conditions={{
                  minimumStayMonths: conditions.minimumStayMonths,
                  enrollmentFeeMode: conditions.enrollmentFeeMode,
                  enrollmentFeeUsd: conditions.enrollmentFeeUsd,
                  enrollmentFeeFrequency: conditions.enrollmentFeeFrequency,
                  depositUsd: conditions.depositUsd,
                  depositMode: conditions.depositMode,
                  enrollmentDiscountPercent: conditions.enrollmentDiscountPercent,
                  enrollmentDiscountUntil: conditions.enrollmentDiscountUntil,
                  emptyMonthChargePercent: conditions.emptyMonthChargePercent,
                  initialPayment: conditions.initialPayment,
                }}
                arsPerUsd={rate.arsPerUsd}
                profileCompletenessPercent={profileCompletenessPercent}
                minStartDate={windowNotice?.minRequestStartDate ?? null}
                stayChange={
                  windowNotice?.stayChangeOpen
                    ? { currentEndDate: windowNotice.endDateLabel.split("/").reverse().join("-"), currentEndLabel: windowNotice.endDateLabel }
                    : null
                }
              />
            )
          }
          waitlistContent={
            mode === "student" && waitlistTypeIds.length > 0 ? (
              <JoinWaitlistForm
                residenceId={residence.id}
                roomTypes={waitlistRoomTypes}
                minStartDate={windowNotice?.minRequestStartDate ?? null}
              />
            ) : undefined
          }
        />
      )}

    </ReservationSelectionProvider>
  );
}
