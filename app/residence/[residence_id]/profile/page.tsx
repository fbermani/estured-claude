import { residenceAvailabilityMode, typeAvailabilityState } from "@/lib/availability/typeAvailability";
import { parseRuleItems } from "@/lib/residences/ruleItems";
import { loadCatalogForResidence } from "@/lib/faq/residenceCatalog";
import { loadFeaturedCandidates } from "@/lib/faq/featured";
import { buildFaqProfileSummary } from "@/lib/faq/profileSummary";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getResidenceMembership } from "@/lib/residences/access";
import { can } from "@/lib/residences/permissions";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";
import { loadChangesMessage } from "@/lib/residences/loadChangesMessage";
import { initialPaymentConfigFromRow } from "@/lib/reservations/initialPayment";
import { normalizeAmenityLists, parseAmenityDetails } from "@/lib/residences/amenityDetails";
import { listCustomAmenities } from "@/lib/residences/customAmenitiesDb";
import { loadCurrentRegulation } from "@/lib/regulations/current";
import { essentialFaqsReadyCount, regulationPublishedFlag } from "@/lib/residences/submitReadinessDb";
import { parseStayDocumentsContent } from "@/lib/residences/stayDocuments";
import { loadPhotoMeta } from "@/lib/residences/photoMetaDb";
import { summarizeProfileEdit } from "@/lib/residences/profileEditSummary";
import { loadResidencePromotions } from "@/lib/residences/promotions";
import { isWithinWindow, normalizeDepositMode, todayIso } from "@/lib/applications/reservationMoney";
import type { PhotoMetaItem } from "@/app/residence/[residence_id]/profile/PhotoMetaManager";
import { ResidenceProfileForm } from "@/app/residence/[residence_id]/profile/ResidenceProfileForm";

export const metadata: Metadata = { title: "Configuración de residencia" };
export const dynamic = "force-dynamic";

/** Coordenada de la residencia para ordenar las universidades de la miniatura por cercanía; `null` si falta o no es válida. */
function previewLocation(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  if (lat === null || lat === undefined || lat === "" || lng === null || lng === undefined || lng === "") return null;
  const la = Number(lat);
  const lo = Number(lng);
  return Number.isFinite(la) && Number.isFinite(lo) ? { lat: la, lng: lo } : null;
}

export default async function ResidenceProfilePage({
  params,
}: {
  params: Promise<{ residence_id: string }>;
}) {
  const { residence_id: residenceId } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect(`/login?next=/residence/${residenceId}/profile`);

  const admin = getSupabaseAdmin();
  if (!admin) notFound();

  // DR11: edita quien tenga `profile.edit` (el dueño siempre); el resto lo ve en solo lectura. Enviar a verificación es solo del dueño.
  // Es solo presentación: el servidor rechaza cualquier envío sin el permiso correspondiente.
  const membership = await getResidenceMembership(admin, sessionUser.id, residenceId);
  if (!membership) notFound();
  const readOnly = !can(membership, "profile.edit");
  const canSubmit = membership.role === "owner";

  const [{ data: residence }, { data: sections }, { data: roomTypes }, { data: rooms }, { data: photos }, { data: rulesFile }, { data: pendingEdits }] =
    await Promise.all([
      admin.from("residences").select("*").eq("id", residenceId).single(),
      admin.from("residence_profile_sections").select("section_type, content").eq("residence_id", residenceId),
      admin
        .from("room_types")
        .select("id, name, gender_policy, bathroom_type, features, capacity_per_room, monthly_price_usd, profile_availability(status)")
        .eq("residence_id", residenceId)
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      admin.from("rooms").select("id, room_type_id").eq("residence_id", residenceId).eq("is_active", true),
      admin
        .from("files")
        .select("id, storage_path, status")
        .eq("related_entity_type", "residences")
        .eq("related_entity_id", residenceId)
        .eq("document_type", "residence_photo")
        .neq("status", "rejected")
        .order("created_at", { ascending: true }),
      admin
        .from("files")
        .select("filename")
        .eq("related_entity_type", "residences")
        .eq("related_entity_id", residenceId)
        .eq("document_type", "residence_rules_document")
        .neq("status", "rejected")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("residence_profile_edits")
        .select("field_group, created_at, old_value, new_value")
        .eq("residence_id", residenceId)
        .eq("status", "pending_admin_review")
        .order("created_at", { ascending: false }),
    ]);

  if (!residence) notFound();

  // DR18: ítems «Otro» (degrada a vacío sin la migración 0058) y si ya hay reglamento propio publicado (si no, se invita a armarlo).
  const [customAmenitiesRes, regulationRes, photoMeta, promotionsRes, faqCatalog, faqFeatured] = await Promise.all([
    listCustomAmenities(admin, residenceId),
    loadCurrentRegulation(admin, residenceId),
    loadPhotoMeta(admin, [residenceId], { reconcile: false }),
    loadResidencePromotions(admin, residenceId),
    // Estado del catálogo de preguntas para la tarjeta «Preguntas frecuentes» (no editable acá: se elige en /faq).
    loadCatalogForResidence(admin, residenceId),
    loadFeaturedCandidates(admin, residenceId),
  ]);
  const today = todayIso();

  const changesMessage = !readOnly && residence.status === "needs_changes" ? await loadChangesMessage(admin, residenceId) : null;
  const rate = await getCurrentExchangeRate();
  const initialPayment = initialPaymentConfigFromRow(residence);
  const sectionMap = Object.fromEntries((sections ?? []).map((s) => [s.section_type, s.content]));
  const photoItems = (photos ?? []).map((p) => {
    const m = photoMeta.byFileId.get(p.id);
    return {
      id: p.id as string,
      url: admin.storage.from("public-residence-media").getPublicUrl(p.storage_path).data.publicUrl,
      pending: p.status === "pending_review",
      category: m?.category ?? ("general" as const),
      area: (m?.area ?? null) as PhotoMetaItem["area"],
      roomTypeId: m?.room_type_id ?? null,
      featured: m?.is_featured === true,
      section: m?.section ?? null,
      sortOrder: m?.sort_order ?? 0,
      coverOrder: m?.cover_order ?? null,
      isCover: m?.is_cover === true,
    };
  });
  photoItems.sort((a, b) => a.sortOrder - b.sortOrder); // estable: a igual orden, la antigüedad
  const pendingEditGroups = (pendingEdits ?? []).map((e) => ({
    fieldGroup: e.field_group,
    createdAt: e.created_at,
    summary: summarizeProfileEdit(e.field_group, e.old_value, e.new_value),
  }));

  return (
    <ResidenceProfileForm
      residenceId={residenceId}
      arsPerUsd={rate.arsPerUsd}
      readOnly={readOnly}
      canSubmit={canSubmit}
      draftScope={{ userId: sessionUser.id }}
      // Requisitos para enviar (DR59) que no viajan en el formulario: reglamento publicado, PDF y preguntas esenciales listas.
      readinessExternal={{
        rulesPdf: rulesFile !== null,
        regulationPublished: regulationPublishedFlag(regulationRes),
        essentialFaqsReady: essentialFaqsReadyCount(faqCatalog),
      }}
      initial={{
        name: residence.name,
        tagline: residence.tagline ?? "",
        propertyType: residence.property_type ?? "",
        addressLine: residence.address_line ?? "",
        zone: residence.public_area ?? "",
        description: residence.description ?? "",
        status: residence.status,
        ...normalizeAmenityLists({
          services: (sectionMap.services?.items as string[]) ?? [],
          commonAreas: (sectionMap.common_areas?.items as string[]) ?? [],
        }),
        amenityDetails: parseAmenityDetails((residence as { amenity_details?: unknown }).amenity_details),
        nearUniversities: (sectionMap.near_universities?.items as string[]) ?? [],
        stayDocuments: parseStayDocumentsContent(sectionMap.stay_documents),
        rulesSummary: (sectionMap.rules?.summary as string) ?? "",
        rulesItems: parseRuleItems(sectionMap.rules?.items),
        rulesFileName: regulationRes.ok ? (regulationRes.view.pdf?.filename ?? null) : (rulesFile?.filename ?? null),
        customAmenities: (customAmenitiesRes.ok ? customAmenitiesRes.items : []).map((i) => ({
          id: i.id,
          kind: i.kind,
          label: i.label,
          status: i.status,
          rejectReason: i.reject_reason,
        })),
        customAmenitiesReady: customAmenitiesRes.ok && customAmenitiesRes.schemaReady,
        hasOwnRegulation: regulationRes.ok ? !regulationRes.view.isBaseModel : true,
        faqItems: (sectionMap.faq?.items as { question: string; answer: string }[]) ?? [],
        faqSummary: buildFaqProfileSummary(faqCatalog, faqFeatured),
        slug: residence.slug as string,
        // Disponibilidad ya guardada, con la misma regla del catálogo (el estado oficial se muestra solo vía StatusTag).
        availabilityMode: residenceAvailabilityMode(
          (roomTypes ?? []).map((rt) => typeAvailabilityState((rt.profile_availability as unknown as { status: string } | null)?.status)),
        ),
        location: previewLocation(residence.latitude, residence.longitude),
        photos: photoItems,
        photoRoomTypes: (roomTypes ?? []).map((rt) => ({ id: rt.id as string, name: rt.name as string })),
        photoMetaReady: photoMeta.schemaReady,
        photoSectionsReady: photoMeta.sectionsReady,
        photoCoverReady: photoMeta.coverReady,
        photoMainCoverReady: photoMeta.mainCoverReady,
        // DR18 t3 (0060): las opciones de dinero se habilitan cuando existe `deposit_mode` y la tabla de promociones.
        moneyReady: promotionsRes.schemaReady && "deposit_mode" in residence,
        promotions: promotionsRes.promotions.map((p) => ({
          id: p.id,
          label: p.label,
          discountPercent: p.discountPercent,
          roomTypeName: (roomTypes ?? []).find((rt) => rt.id === p.roomTypeId)?.name ?? null,
          startsOn: p.startsOn,
          endsOn: p.endsOn,
          isActive: p.isActive,
          current: p.isActive && isWithinWindow({ startsOn: p.startsOn, endsOn: p.endsOn }, today),
        })),
        pendingEditGroups,
        changesMessage,
        roomTypes: (roomTypes ?? []).map((rt) => ({
          id: rt.id,
          name: rt.name,
          genderPolicy: rt.gender_policy ?? undefined,
          bathroomType: rt.bathroom_type ?? undefined,
          features: (rt.features as string[]) ?? [],
          roomCount: (rooms ?? []).filter((r) => r.room_type_id === rt.id).length,
          capacityPerRoom: Math.max(1, rt.capacity_per_room ?? 1),
          monthlyPriceUsd: Number(rt.monthly_price_usd),
        })),
        conditions: {
          minimumStayMonths: residence.minimum_stay_months ?? "",
          adjustmentPolicy: residence.adjustment_policy ?? "quarterly",
          initialPaymentMode: initialPayment.mode,
          initialPaymentUsd: initialPayment.customUsd ?? "",
          enrollmentEnabled: residence.enrollment_fee_mode != null,
          enrollmentFeeMode: residence.enrollment_fee_mode === "manual" ? "manual" : "one_month",
          enrollmentFeeUsd: residence.enrollment_fee_usd != null ? Number(residence.enrollment_fee_usd) : "",
          enrollmentFeeFrequency: residence.enrollment_fee_frequency === "annual" ? "annual" : "once",
          enrollmentDiscountPercent:
            residence.enrollment_discount_percent != null ? Number(residence.enrollment_discount_percent) : "",
          enrollmentDiscountUntil: (residence.enrollment_discount_until as string | null) ?? "",
          depositEnabled: residence.deposit_usd != null || normalizeDepositMode(residence.deposit_mode) !== null,
          depositMode: normalizeDepositMode(residence.deposit_mode) ?? "",
          depositUsd: residence.deposit_usd != null ? Number(residence.deposit_usd) : "",
          emptyMonthsEnabled: residence.empty_month_charge_percent != null,
          emptyMonthChargePercent:
            residence.empty_month_charge_percent != null ? Math.max(0, Math.min(100, Number(residence.empty_month_charge_percent))) : 50,
          earlyExitDepositClausesText: (residence.early_exit_deposit_clauses_text as string | null) ?? "",
          earlyExitCostsText: (residence.early_exit_costs_text as string | null) ?? "",
          earlyExitConditionsText: (residence.early_exit_conditions_text as string | null) ?? "",
          minResidentAge: (residence.min_resident_age as number | null) ?? 18,
          maxResidentAge: (residence.max_resident_age as number | null) ?? "",
          acceptsMinors: residence.accepts_minors === true,
        },
      }}
    />
  );
}
