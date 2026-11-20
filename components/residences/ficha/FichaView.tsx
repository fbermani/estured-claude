import { genderOfferLabel, genderOffers } from "@/lib/availability/genderAvailability";
import { amenityDisplayName, normalizeAmenityLists, parseAmenityDetails } from "@/lib/residences/amenityDetails";
import Link from "next/link";
import type { FichaData } from "@/lib/residences/loadFicha";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/Button";
import { FichaMobileBar, FichaSummary } from "@/components/residences/ficha/FichaSummary";
import { RequestPanel, RequestMobileBar } from "@/components/residences/ficha/RequestPanel";
import { GuestRequestContent } from "@/components/residences/ficha/GuestRequestContent";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";
import { Icon } from "@/components/ui/Icon";
import { getCommunityVisibility } from "@/lib/residents/communityVisibility";
import { AmenityGrid } from "@/components/residences/AmenityGrid";
import { getApprovedCustomAmenities } from "@/lib/residences/customAmenitiesDb";
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
import { GuidePicks } from "@/components/guides/GuidePicks";
import { MoveInGuideNote } from "@/components/guides/MoveInGuideNote";
import { ApplyForm } from "@/app/(public)/residencias/[slug]/ApplyForm";
import { ProposeForm } from "@/app/(public)/residencias/[slug]/ProposeForm";
import { FavoriteButton } from "@/app/(public)/residencias/[slug]/FavoriteButton";
import { toggleStudentFavorite, toggleFamilyFavorite } from "@/app/students/favorites/actions";
import { JoinWaitlistForm } from "@/app/(public)/residencias/[slug]/JoinWaitlistForm";
import { residenceJsonLd } from "@/lib/seo/residenceJsonLd";
import { usdToArsRounded } from "@/lib/mock/exchange";
import { getResidenceLocation } from "@/lib/residences/residenceLocation";
import { startingPriceUsd, typeAvailabilityState } from "@/lib/availability/typeAvailability";
import { initialPaymentConfigFromRow } from "@/lib/reservations/initialPayment";
import { ReservationSelectionProvider } from "@/components/residences/reservationSelection";
import { OwnerShareBar } from "@/components/share/OwnerShareBar";
import { FichaHeroImmersive } from "@/components/residences/ficha/FichaHeroImmersive";
import { HeroCta } from "@/components/residences/ficha/HeroCta";
import { ResidencePlate } from "@/components/residences/ficha/ResidencePlate";
import { EssentialsStrip } from "@/components/residences/ficha/EssentialsStrip";
import { buildEssentialCells } from "@/lib/residences/fichaEssentials";
import { applyPromotion, normalizeDepositMode } from "@/lib/applications/reservationMoney";
import { loadFamilyViewer, loadStudentViewer, type LinkedStudent, type StudentViewer } from "@/app/(public)/residencias/[slug]/loadViewerContext";
import { findUniversitiesByName, haversineDistanceKm, withoutOtherUniversity } from "@/lib/data/buenosAiresUniversities";
import { roomTypeSubtitle } from "@/lib/residences/fichaConditions";
import { isTypeRequestable } from "@/lib/availability/typeAvailability";
import { resolveRequestPanelMode, type RequestPanelMode } from "@/lib/residences/requestPanelMode";
import { PreviewRequestContent } from "@/components/residences/ficha/PreviewRequestContent";
import type { FichaRoomType } from "@/components/residences/ficha/types";
import { SectionNav, type SectionNavItem } from "@/components/residences/ficha/SectionNav";
import { ChapterHeading } from "@/components/residences/ficha/ChapterHeading";
import { FaqBand } from "@/components/residences/ficha/FaqBand";
import { VivirMosaic } from "@/components/residences/ficha/VivirMosaic";
import { FICHA_BARS_STYLE, FICHA_PREVIEW_BARS_STYLE } from "@/lib/residences/fichaLayout";
import { buildChapters, type Chapter as FichaChapter, type ChapterKey } from "@/lib/residences/fichaChapters";
import { faqChapterVisible, splitFeaturedFaq } from "@/lib/residences/featuredFaq";
import { buildRuleRows } from "@/lib/residences/fichaRules";
import { ReadMore } from "@/components/residences/ficha/ReadMore";
import { RoomCards } from "@/components/residences/ficha/RoomCards";
import { ReservationConditions } from "@/components/residences/ficha/ReservationConditions";
import { EarlyExitPolicy } from "@/components/residences/ficha/EarlyExitPolicy";
import { CommunitySummary } from "@/components/residences/ficha/CommunitySummary";
import { RequestNotices } from "@/components/residences/ficha/RequestNotices";
import { CostsBoard } from "@/components/residences/ficha/CostsBoard";
import { FaqModalProvider } from "@/components/residences/ficha/FaqModal";
import { HouseRules, RegulationDownloadLink } from "@/components/residences/ficha/HouseRules";
import { MinorsNotice } from "@/components/residences/ficha/MinorsNotice";
import { ClosingCta } from "@/components/residences/ficha/ClosingCta";
import { buildPaidSeparately } from "@/lib/residences/fichaCosts";
import { buildAgeFacts } from "@/lib/residences/fichaAge";
import { canDownloadRegulation } from "@/lib/residences/fichaRules";
import { loadAverageResidentAge } from "@/lib/residents/averageAge";

const FICHA_GENDER_LABEL: Record<string, string> = { mixto: "Mixta", solo_hombres: "Solo hombres", solo_mujeres: "Solo mujeres" };

/**
 * Espaciado y desplazamiento de ancla de cada capítulo: la navbar y la navegación de capítulos quedan fijas arriba; su altura total
 * (variables `--ficha-navbar-h` y `--ficha-chips-h` de `lib/residences/fichaLayout.ts`; la clase va literal para que Tailwind la detecte) más 1 rem de aire es el `scroll-margin-top` de todas las anclas.
 */
const ANCHOR_OFFSET = "scroll-mt-[calc(var(--ficha-navbar-h,4.0625rem)_+_var(--ficha-chips-h,3.9rem)_+_1rem)]";
const CHAPTER_SECTION = `${ANCHOR_OFFSET} pt-10 min-[768px]:pt-14`;

/** Un capítulo de la ficha: sección con ancla, número y título (h2). Los capítulos con encabezado propio (preguntas) arman su `<section>` aparte. */
function Chapter({ chapter, subtitle, children }: { chapter: FichaChapter; subtitle?: string | null; children: React.ReactNode }) {
  return (
    <section id={chapter.id} aria-labelledby={`h-${chapter.id}`} className={CHAPTER_SECTION}>
      <ChapterHeading id={`h-${chapter.id}`} number={chapter.number}>
        {chapter.title}
      </ChapterHeading>
      {subtitle && <p className="-mt-2 mb-5 text-lg text-ink-soft tabular-nums">{subtitle}</p>}
      {children}
    </section>
  );
}

/**
 * Render de la ficha. Lo usan la ficha pública (`/residencias/[slug]`) y la vista previa del equipo (`/residence/[id]/preview`).
 *
 * `preview` (vista previa): se dibuja como la vería un visitante, pero SIN nada que dependa de quién mira ni que haga algo: no se lee la
 * sesión (modo «visitante», sin formularios de estudiante ni de familiar, sin favorito, sin «Hacer una pregunta»), no hay JSON-LD, no hay
 * «Compartir esta ficha», los botones «Pedir esta habitación» de las tarjetas no se muestran, el panel de solicitud es un aviso sin acciones y
 * no se enlaza nada que dependa de que la residencia esté publicada (reglamento descargable, ficha pública, comunidad).
 */
export async function FichaView({
  data,
  slug,
  preselectedRoomTypeId,
  solicitar,
  preview = false,
}: {
  data: FichaData;
  slug: string;
  preselectedRoomTypeId?: string;
  solicitar?: string;
  preview?: boolean;
}) {
  const { residence, roomTypes, sectionMap, photos, rulesPdfUrl, capacityPlaces } = data;

  // Lecturas independientes en paralelo: cotización, sesión y, con la sesión, todo lo que depende de quién mira.
  const adminClient = getSupabaseAdmin();
  // Las lecturas que no dependen de la sesión arrancan ya, en paralelo con cotización y sesión (auditoría 2026-11-19, R19-08).
  const answeredQuestionsPromise = adminClient ? getPublicAnsweredQuestions(adminClient, residence.id) : Promise.resolve([]);
  // DR14: preguntas del catálogo que la residencia eligió mostrar (agrupadas por tema). Vacío si no eligió ninguna o si la 0054 no está aplicada.
  const catalogFaqPromise = adminClient ? getPublicCatalogFaq(adminClient, residence.id) : Promise.resolve([]);
  // DR14: reglamento vigente (propio, o el modelo). `null`/`ok:false` = no se pudo leer: no se muestra ni se ofrece aceptarlo.
  const regulationPromise = adminClient ? loadCurrentRegulation(adminClient, residence.id) : Promise.resolve(null);
  // Edad promedio de la comunidad vigente: solo con comunidad activa y más de 10 residentes (privacidad).
  const averageAgePromise = adminClient
    ? loadAverageResidentAge(adminClient, residence.id, residence.has_operational_management_access as boolean | null)
    : Promise.resolve(null);
  // DR18: los ítems «Otro» aprobados se suman a los fijos (los pendientes y rechazados nunca llegan acá; vacío si la 0058 no está aplicada).
  const customAmenitiesPromise = adminClient ? getApprovedCustomAmenities(adminClient, residence.id) : Promise.resolve({ services: [], areas: [] });
  const [rate, sessionUser] = await Promise.all([getCurrentExchangeRate(), preview ? Promise.resolve(null) : getSessionUser()]);
  const isStudent = sessionUser?.roles.includes("student") ?? false;
  const isFamily = sessionUser?.roles.includes("family_member") ?? false;
  const [answeredQuestions, catalogFaq, isOwnResidenceTeam, community, studentViewer, familyViewer, regulationResult, averageAge, customAmenities] = await Promise.all([
    answeredQuestionsPromise,
    catalogFaqPromise,
    sessionUser && adminClient ? assertResidenceAccess(adminClient, sessionUser.id, residence.id) : Promise.resolve(false),
    adminClient ? getCommunityVisibility(adminClient, residence.id, sessionUser ? "registered" : "guest") : Promise.resolve(null),
    isStudent && sessionUser && adminClient ? loadStudentViewer(adminClient, sessionUser.id, residence.id) : Promise.resolve(null),
    isFamily && sessionUser && adminClient
      ? loadFamilyViewer(adminClient, sessionUser.id, residence.id)
      : Promise.resolve(null),
    regulationPromise,
    averageAgePromise,
    customAmenitiesPromise,
  ]);
  const regulation = regulationResult?.ok ? regulationResult.view : null;

  // La ubicación y la dirección de la residencia son públicas (decisión del dueño, 2026-10-23): pin exacto.
  const location = getResidenceLocation(residence);
  const addressLine = (residence.address_line as string | null)?.trim() || null;
  // Dirección y barrio en una línea; en una ficha incompleta (borrador) puede faltar alguno: no se escribe «null».
  const addressZoneText = [addressLine, (residence.public_area as string | null)?.trim(), "CABA"].filter(Boolean).join(", ") + ".";
  const { services, commonAreas } = normalizeAmenityLists({
    services: [...((sectionMap.services?.items as string[]) ?? []), ...customAmenities.services],
    commonAreas: [...((sectionMap.common_areas?.items as string[]) ?? []), ...customAmenities.areas],
  });
  const amenityDetails = parseAmenityDetails((residence as { amenity_details?: unknown }).amenity_details);
  const nearUniversities = withoutOtherUniversity((sectionMap.near_universities?.items as string[]) ?? []);
  const rulesSummary = (sectionMap.rules?.summary as string) ?? "";
  const staticFaqItems = (sectionMap.faq?.items as { question: string; answer: string }[]) ?? [];
  const communityStatement = (sectionMap.community_statement?.quote as string) ?? "";
  // El equipo de ESTA residencia no se pregunta a sí mismo: en vez del formulario ve un aviso (responde desde su panel).
  // Orden (DR14): primero las del catálogo agrupadas por tema, después las fijas del perfil y al final las libres respondidas.
  const otherFaqGroup = catalogFaq.length > 0 ? "Otras preguntas" : undefined;
  const faqItems: { question: string; answer: string; fromVisitor?: boolean; group?: string; isFeatured?: boolean; featuredOrder?: number | null }[] = [
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
    // Foto del tipo: la primera que la residencia clasificó «Por tipo de habitación» con este nombre (sin ella: ilustración de marca).
    ...(() => {
      const photoUrl = photos.find((p) => p.category === "room_type" && p.roomTypeName === rt.name)?.url;
      return photoUrl ? { photoUrl } : {};
    })(),
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
    // Por género solo si el tipo se ofrece en más de uno (con uno solo, el género ya figura en la línea del tipo).
    ...(() => {
      const offers = genderOffers(rt.profile_availability?.status, rt.genderRows);
      return offers.length > 1
        ? { genderOffers: offers.map((o) => ({ gender: o.gender, label: genderOfferLabel(rt.name, o.gender), state: o.state, note: o.note })) }
        : {};
    })(),
  }));

  // "Desde" = mínimo de los tipos NO completos (D3/H03; si todos están completos, el mínimo de todos).
  const fromPriceUsd = startingPriceUsd(fichaTypes.map((t) => ({ priceUsd: t.priceUsd, state: t.state })));

  const nearest = findUniversitiesByName(nearUniversities)
    .map((u) => ({ name: u.name, km: haversineDistanceKm(location, u) }))
    .sort((a, b) => a.km - b.km)[0];
  const hasCommunity = !!communityStatement || (community?.totalResidents ?? 0) > 0;

  const hasServices = services.length > 0 || commonAreas.length > 0;
  // Capítulos de la ficha (fase 3): solo los que tienen contenido; la numeración sale de los visibles.
  // Edad de los residentes: rango que admite la residencia + promedio de la comunidad (ya filtrado por privacidad). Lo leen la franja «Lo esencial» y el subtítulo del capítulo «La comunidad».
  const ageFacts = buildAgeFacts({
    minAge: residence.min_resident_age as number | null | undefined,
    maxAge: residence.max_resident_age as number | null | undefined,
    acceptsMinors: residence.accepts_minors as boolean | null | undefined,
    average: averageAge,
  });
  const hasAgeSection = !!ageFacts.subtitle;
  // Reglas de casa: las estructuradas (`rules.items`) o las derivadas del resumen; sin ninguna y sin reglamento, el capítulo no se muestra.
  const rulesItems = sectionMap.rules?.items;
  const hasRules = buildRuleRows({ items: rulesItems, summary: rulesSummary }).length > 0 || !!rulesPdfUrl || !!regulation;
  const chapters = buildChapters({
    vivir: true, // el mosaico se dibuja siempre (con tarjetas vacías si faltan fotos): la estructura de la ficha no depende de las fotos
    tarifas: true,
    incluye: true,
    // Sin preguntas respondidas no hay capítulo: el dueño quiere que la gente LEA, no que pregunte (ver `faqChapterVisible`).
    preguntas: faqChapterVisible(faqItems.length),
    comunidad: hasCommunity || hasAgeSection,
    reglas: hasRules,
    ubicacion: true,
  });
  const chapter = (key: ChapterKey) => chapters.find((c) => c.key === key);
  const navItems: SectionNavItem[] = chapters.map((c) => ({ id: c.id, label: c.navLabel, number: c.number }));
  // Banda de preguntas destacadas: las que la residencia marcó (`isFeatured` / `featuredOrder`, migración 0096) y, si no marcó ninguna, las primeras por orden (ver `lib/residences/featuredFaq.ts`).
  const { featured: featuredFaq } = splitFeaturedFaq(faqItems);
  const showStudentFavoriteInHeader = isStudent;
  const singleStudentName = linkedStudents.length === 1 ? linkedStudents[0].first_name : null;
  // Lista de espera: solo tipos completos, y nunca el tipo en el que ya tiene una reserva vigente en ESTA residencia.
  const ownTypeIds = new Set(studentViewer?.ownReservationTypeIds ?? []);
  const waitlistTypeIds = fichaTypes.filter((t) => t.state === "full" && !ownTypeIds.has(t.id)).map((t) => t.id);
  const waitlistRoomTypes = roomTypes
    .filter((rt) => !ownTypeIds.has(rt.id))
    .map((rt) => ({ id: rt.id, name: rt.name, state: fichaTypes.find((t) => t.id === rt.id)?.state }));
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

  // Cuadro de costos del capítulo «Qué incluye»: lo incluido (servicios declarados) y lo que se paga aparte (a la residencia / a EstuRed).
  const includedItems = services.map((s) => amenityDisplayName(s, amenityDetails));
  const paidSeparately = buildPaidSeparately({ conditions, fromPriceUsd, arsPerUsd: rate.arsPerUsd });
  // Reglamento: se ofrece la descarga solo si la residencia cargó el suyo (propio, adaptado del modelo o un PDF subido).
  // En la vista previa no se enlaza: la descarga pública exige la ficha publicada. Se avisa en su lugar.
  const regulationDownloadable = canDownloadRegulation({ regulation, hasUploadedPdf: !!rulesPdfUrl });
  const regulationDownloadHref = regulationDownloadable && !preview ? `/residencias/${slug}/reglamento` : null;
  const regulationPreviewNote = regulationDownloadable && preview ? "La descarga del reglamento se habilita cuando tu ficha esté publicada." : null;

  // Quién ve el panel de solicitud en la columna derecha (≥ 900 px) y como hoja inferior en móvil: visitante, estudiante y
  // familiar con estudiante vinculado, siempre que haya tipos para elegir. El resto (equipo, menores, otros roles) ve el
  // resumen con «Ver tarifas».
  const panelVariant: "guest" | "apply" | "propose" | null =
    mode === "guest" && fichaTypes.length > 0
      ? "guest"
      : mode === "student" && roomTypes.length > 0
        ? "apply"
        : mode === "family" && roomTypes.length > 0
          ? "propose"
          : null;
  // Qué hacen los botones de las tarjetas de habitación y los avisos de la tabla: en la vista previa, nada (modo «other» no ofrece acciones).
  const cardsMode: RequestPanelMode = preview ? "other" : mode;
  const hasSummary = fromPriceUsd != null;
  const hasAside = panelVariant !== null || hasSummary;

  // Franja «Lo esencial» (datos que la página ya calculó) y CTA del hero: la misma acción que la barra móvil, solo en escritorio.
  const essentialCells = buildEssentialCells({
    fromPriceUsd,
    arsPerUsd: rate.arsPerUsd,
    roomTypes: fichaTypes.map((t) => ({ capacity: t.capacity ?? null })),
    minimumStayMonths: conditions.minimumStayMonths,
    enrollmentFeeMode: conditions.enrollmentFeeMode,
    enrollmentFeeUsd: conditions.enrollmentFeeUsd,
    nearest: nearest ?? null,
    age: ageFacts.strip,
    totalPlaces: capacityPlaces,
  });
  const heroCta = panelVariant ? (
    <HeroCta
      action={{ kind: "sheet" }}
      label={panelVariant === "propose" ? "Proponer esta residencia" : "Elegir habitación"}
      note={panelVariant === "propose" ? undefined : "Enviar la solicitud es gratis"}
    />
  ) : hasSummary ? (
    <HeroCta action={{ kind: "link", href: "#tarifas" }} label="Ver tarifas" />
  ) : undefined;

  const heroCtaClosing = panelVariant ? (
    <HeroCta action={{ kind: "sheet" }} label={panelVariant === "propose" ? "Proponer esta residencia" : "Elegir habitación"} pulse={false} />
  ) : hasSummary ? (
    <HeroCta action={{ kind: "link", href: "#tarifas" }} label="Ver tarifas" pulse={false} />
  ) : undefined;

  return (
    <ReservationSelectionProvider initialRoomTypeId={preselectedRoomTypeId} initialSheet={initialSheet}>
      {/* Datos estructurados para buscadores: solo en la ficha pública (la vista previa no se indexa). */}
      {!preview && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: residenceJsonLd({
              slug,
              name: residence.name,
              description: residence.description as string | null,
              addressLine,
              area: residence.public_area as string | null,
              geo: location.source === "residence" ? { lat: location.lat, lng: location.lng } : null,
              photoUrl: photos[0]?.url ?? null,
              pricesUsd: fichaTypes.map((t) => t.priceUsd),
              amenities: includedItems,
              faq: faqItems.filter((q) => !q.fromVisitor),
            }),
          }}
        />
      )}
      {/* Solo el equipo de ESTA residencia (dueño o staff activo) ve «Compartir esta ficha»; nadie más recibe la franja ni sus datos. */}
      {isOwnResidenceTeam && <OwnerShareBar residenceId={residence.id} />}
      {/* Hero inmersivo (portada + placa + CTA) y franja «Lo esencial»: a todo el ancho, antes del contenedor de la ficha. */}
      <FichaHeroImmersive
        photos={photos}
        name={residence.name}
        zone={residence.public_area ?? ""}
        plate={
          <ResidencePlate
            variant="hero"
            name={residence.name}
            zone={(residence.public_area as string | null)?.trim() || null}
            address={addressLine}
            fromPriceUsd={fromPriceUsd}
            arsPerUsd={rate.arsPerUsd}
          />
        }
        cta={heroCta}
      />
      {/* Las preguntas completas viven en un modal que abren el chip de la franja y el botón de la banda (una sola instancia). */}
      <FaqModalProvider
        items={faqItems}
        residenceName={residence.name}
        askSlot={isOwnResidenceTeam || preview ? undefined : <AskQuestionForm residenceId={residence.id} signedIn={!!sessionUser} />}
      >
      {/* Las alturas de la navbar y de la tira de capítulos se publican como variables CSS para el sticky del panel y las anclas. */}
      <div style={preview ? FICHA_PREVIEW_BARS_STYLE : FICHA_BARS_STYLE}>
      <EssentialsStrip cells={essentialCells} faqCount={faqItems.length} />
      {/* Navegación de capítulos: a todo el ancho, fija bajo la navbar (único sticky de la ficha). */}
      <SectionNav items={navItems} label="Capítulos de la ficha" />
      <div className={`mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6 sm:pb-14 ${hasSummary ? "max-[899px]:pb-28" : ""}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Ruta de navegación" className="text-sm text-ink-faint">
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
          {/* Favorito: el nombre, la dirección y el precio viven en la placa del hero; acá queda solo la acción de guardar. */}
          {showStudentFavoriteInHeader && (
            <FavoriteButton action={toggleStudentFavorite.bind(null, residence.id)} initialFavorited={studentFavorited} />
          )}
        </div>

        {/* Dos columnas desde 900 px (A1, auditoría 2026-11-03): contenido a la izquierda y resumen fijo a la derecha. */}
        <div className={`mt-6 ${hasAside ? "min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1fr)_23rem] min-[900px]:gap-8" : ""}`}>
        <div className="min-w-0">
        {/* Capítulos de la ficha (fase 3): 01 Vivir acá · 02 Habitaciones y precio · 03 Qué incluye · 04 Preguntas · 05 La comunidad ·
            06 Reglas de casa · 07 Dónde está. Solo se dibujan los que tienen contenido; la numeración sale de los visibles. */}
        <div>
          {/* 01 Vivir acá: descripción, mosaico de fotos con rótulos y su pill «Ver todas las fotos (N)» (abre el visor), y debajo los chips de
              servicios y áreas comunes. Con 0 o 1 foto el mosaico se dibuja igual, con tarjetas vacías. */}
          {chapter("vivir") && (
            <Chapter chapter={chapter("vivir")!}>
              {residence.description && (
                <div className="max-w-[68ch]">
                  <ReadMore text={residence.description} />
                </div>
              )}
              <div className={residence.description ? "mt-6" : ""}>
                <VivirMosaic photos={photos} name={residence.name} zone={residence.public_area ?? ""} />
              </div>
              {/* Servicios y áreas comunes: una sola fila de etiquetas, como en el mockup (cada una con su tooltip al hover). */}
              {hasServices && (
                <div className="mt-4">
                  <AmenityGrid
                    layout="chips"
                    tone="tag"
                    items={[
                      ...services.map((s) => ({ name: amenityDisplayName(s, amenityDetails), ...getServiceIcon(s) })),
                      ...commonAreas.map((a) => ({ name: amenityDisplayName(a, amenityDetails), ...getCommonAreaIcon(a) })),
                    ].filter((item, i, all) => all.findIndex((o) => o.name === item.name) === i)}
                  />
                </div>
              )}
            </Chapter>
          )}

          {/* 02 Habitaciones y precio: tarifas visibles para TODOS (H10 / D17). Conserva el ancla histórica #tarifas. */}
          {chapter("tarifas") && (
            <Chapter chapter={chapter("tarifas")!}>
              <p className="-mt-2 mb-5 text-sm text-ink-soft">
                Precios mensuales por tipo de habitación, visibles para todos. La disponibilidad la informa la residencia por tipo.
              </p>
              <div className="space-y-5">
                <RequestNotices
                  mode={cardsMode}
                  roomTypes={fichaTypes}
                  slot={panelSlot}
                  windowNotice={windowNotice}
                  studentName={singleStudentName}
                />
                {fichaTypes.length > 0 ? (
                  <RoomCards
                    roomTypes={fichaTypes}
                    arsPerUsd={rate.arsPerUsd}
                    waitlistTypeIds={mode === "student" ? waitlistTypeIds : []}
                    mode={cardsMode}
                    slug={slug}
                  />
                ) : (
                  <EmptyState
                    icon="request_quote"
                    title="La residencia todavía no publicó sus tarifas"
                    description={faqItems.length > 0 ? "Mientras tanto, leé las respuestas rápidas o seguí mirando otras residencias." : "Seguí mirando otras residencias."}
                    action={
                      <div className="flex flex-wrap justify-center gap-2">
                        {faqItems.length > 0 && (
                          <Button href="#preguntas" variant="outline" size="sm">
                            Leé las respuestas rápidas
                          </Button>
                        )}
                        <Button href="/search" size="sm">
                          Ver más residencias
                        </Button>
                      </div>
                    }
                  />
                )}
                {/* Condiciones de la reserva (estadía mínima, pago inicial, matrícula, depósito, ajuste, mes vacío y documentos): lista
                    escaneable debajo de las habitaciones, sin desplegable. */}
                <ReservationConditions conditions={conditions} arsPerUsd={rate.arsPerUsd} showFaqLink={faqChapterVisible(faqItems.length)} />
              </div>
            </Chapter>
          )}

          {/* 03 Qué incluye y qué se paga aparte: cuadro de costos (incluido / se paga aparte / línea de tiempo de 3 pasos), la salida anticipada y las guías generales de EstuRed, separadas del reglamento propio de la residencia. */}
          {chapter("incluye") && (
            <Chapter chapter={chapter("incluye")!}>
              <div className="space-y-5">
                <CostsBoard included={includedItems} paid={paidSeparately} residenceName={residence.name} />
                <EarlyExitPolicy
                  depositClausesText={conditions.earlyExitDepositClausesText}
                  costsText={conditions.earlyExitCostsText}
                  conditionsText={conditions.earlyExitConditionsText}
                />
                <GuidePicks keys={["01", "03"]} variant="strip" label="Antes de reservar, leé:" />
              </div>
            </Chapter>
          )}

          {/* 04 Preguntas: banda destacada (las primeras, hasta 6) con «Leé las respuestas rápidas», que abre todas en el modal. No hay botón de
              «Hacer una pregunta» (el dueño quiere incentivar a leer): el formulario vive solo como enlace discreto al final del modal. Sin
              ninguna pregunta respondida el capítulo (y su chip) no existe. */}
          {chapter("preguntas") && (
            <section id="preguntas" aria-labelledby="h-preguntas" className={CHAPTER_SECTION}>
              <FaqBand
                headingId="h-preguntas"
                number={chapter("preguntas")!.number}
                items={featuredFaq}
                total={faqItems.length}
                residenceName={residence.name}
              />
            </section>
          )}

          {/* 05 La comunidad: comunidad y convivencia (resumen por tipo, D18; el mapa de camas vive en /comunidad) y edad de los residentes (DR14). */}
          {chapter("comunidad") && (
            <Chapter chapter={chapter("comunidad")!} subtitle={ageFacts.subtitle}>
              <div className="space-y-8">
                {hasCommunity && (
                  <div id="comunidad-resumen" className="space-y-4">
                    <p className="-mt-2 text-sm text-ink-soft">Quiénes viven hoy en la residencia.</p>
                    <CommunitySummary slug={slug} community={community} statement={communityStatement} isGuest={!sessionUser} preview={preview} />
                  </div>
                )}
                {/* La edad de los residentes (rango que admite la residencia y promedio de la comunidad, DR14) va como subtítulo del capítulo. */}
                {residence.accepts_minors === true && <MinorsNotice />}
              </div>
            </Chapter>
          )}

          {/* 06 Reglas de casa: reglas de convivencia (top 5) + reglamento para leer (modal) y descargar. Se acepta al enviar la solicitud. */}
          {chapter("reglas") && (
            <Chapter chapter={chapter("reglas")!}>
              <div id="convivencia" className={ANCHOR_OFFSET}>
                <HouseRules
                  rulesSummary={rulesSummary}
                  items={rulesItems}
                  actions={
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
                        footnote={[regulation.isBaseModel ? MODEL_LEGAL_NOTE : null, regulationPreviewNote].filter(Boolean).join(" ") || null}
                        downloadHref={regulationDownloadHref}
                      >
                        <RegulationText text={regulation.text} />
                      </RegulationModal>
                    ) : regulationDownloadHref ? (
                      <RegulationDownloadLink href={regulationDownloadHref} />
                    ) : regulationPreviewNote ? (
                      <p className="text-sm text-ink-soft">{regulationPreviewNote}</p>
                    ) : undefined
                  }
                />
              </div>
            </Chapter>
          )}

          {/* 07 Dónde está: pin exacto + dirección pública + universidades con distancia (DF5) */}
          {chapter("ubicacion") && (
            <Chapter chapter={chapter("ubicacion")!}>
              <p className="-mt-2 mb-4 text-sm text-ink-soft">
                {addressZoneText}
              </p>
              <CompactMap
                residenceName={residence.name}
                zone={residence.public_area ?? ""}
                nearUniversityNames={nearUniversities}
                location={location}
                address={addressLine}
              />
            </Chapter>
          )}
        </div>

        {/* Cierre: «¿Te ves viviendo acá?» con la misma CTA, sin segundo halo (una sola CTA pulsante por pantalla). */}
        {heroCtaClosing && (
          <ClosingCta
            description={panelVariant ? "Enviar la solicitud es gratis y queda sujeta a confirmación de la residencia." : "Mirá las tarifas de cada tipo de habitación."}
            cta={heroCtaClosing}
          />
        )}

        </div>
        {panelVariant ? (
          <aside aria-label={`Solicitud de reserva en ${residence.name}`} className="max-[899px]:contents">
            <RequestPanel
              residenceName={residence.name}
              zone={(residence.public_area as string | null)?.trim() || null}
              windowNotice={windowNotice}
              variant={panelVariant}
              canRequest={anyRequestable}
              requestContent={
                mode === "guest" ? (
                  preview ? (
                    <PreviewRequestContent types={fichaTypes.filter((t) => isTypeRequestable(t.state))} />
                  ) : (
                    <GuestRequestContent slug={slug} types={fichaTypes.filter((t) => isTypeRequestable(t.state))} />
                  )
                ) : mode === "family" ? (
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
                    typeCards={fichaTypes}
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
                    ageCheck={
                      studentViewer?.birthDate
                        ? {
                            birthDate: studentViewer.birthDate,
                            minResidentAge: residence.min_resident_age as number | null | undefined,
                            maxResidentAge: residence.max_resident_age as number | null | undefined,
                            acceptsMinors: residence.accepts_minors as boolean | null | undefined,
                          }
                        : null
                    }
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
          </aside>
        ) : (
          hasSummary && <FichaSummary fromPriceUsd={fromPriceUsd} arsPerUsd={rate.arsPerUsd} />
        )}
        </div>

        <p className="mt-10 text-center text-xs text-ink-faint">
          ¿Buscás más opciones?{" "}
          <Link href="/search" className="text-forest-700 hover:underline">
            Mirá el catálogo completo
          </Link>
          .
        </p>
      </div>
      </div>
      </FaqModalProvider>

      {hasSummary &&
        (panelVariant ? (
          <RequestMobileBar fromPriceUsd={fromPriceUsd} arsPerUsd={rate.arsPerUsd} label={panelVariant === "propose" ? "Proponer esta residencia" : "Elegir habitación"} />
        ) : (
          <FichaMobileBar fromPriceUsd={fromPriceUsd} arsPerUsd={rate.arsPerUsd} />
        ))}
    </ReservationSelectionProvider>
  );
}
