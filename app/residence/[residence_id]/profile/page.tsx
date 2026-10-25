import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getResidenceMembership } from "@/lib/residences/access";
import { can } from "@/lib/residences/permissions";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";
import { loadChangesMessage } from "@/lib/residences/loadChangesMessage";
import { initialPaymentConfigFromRow } from "@/lib/reservations/initialPayment";
import { ResidenceProfileForm } from "@/app/residence/[residence_id]/profile/ResidenceProfileForm";

export const metadata: Metadata = { title: "Configuración de residencia" };
export const dynamic = "force-dynamic";

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
        .select("id, name, gender_policy, bathroom_type, features, capacity_per_room, monthly_price_usd")
        .eq("residence_id", residenceId)
        .eq("is_active", true),
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
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("residence_profile_edits")
        .select("field_group, created_at")
        .eq("residence_id", residenceId)
        .eq("status", "pending_admin_review")
        .order("created_at", { ascending: false }),
    ]);

  if (!residence) notFound();

  const changesMessage = !readOnly && residence.status === "needs_changes" ? await loadChangesMessage(admin, residenceId) : null;
  const rate = await getCurrentExchangeRate();
  const initialPayment = initialPaymentConfigFromRow(residence);
  const sectionMap = Object.fromEntries((sections ?? []).map((s) => [s.section_type, s.content]));
  const photoItems = (photos ?? []).map((p) => ({
    url: admin.storage.from("public-residence-media").getPublicUrl(p.storage_path).data.publicUrl,
    pending: p.status === "pending_review",
  }));
  const pendingEditGroups = (pendingEdits ?? []).map((e) => ({ fieldGroup: e.field_group, createdAt: e.created_at }));

  return (
    <ResidenceProfileForm
      residenceId={residenceId}
      arsPerUsd={rate.arsPerUsd}
      readOnly={readOnly}
      canSubmit={canSubmit}
      initial={{
        name: residence.name,
        tagline: residence.tagline ?? "",
        propertyType: residence.property_type ?? "",
        addressLine: residence.address_line ?? "",
        zone: residence.public_area ?? "",
        description: residence.description ?? "",
        status: residence.status,
        services: (sectionMap.services?.items as string[]) ?? [],
        commonAreas: (sectionMap.common_areas?.items as string[]) ?? [],
        nearUniversities: (sectionMap.near_universities?.items as string[]) ?? [],
        rulesSummary: (sectionMap.rules?.summary as string) ?? "",
        rulesFileName: rulesFile?.filename ?? null,
        faqItems: (sectionMap.faq?.items as { question: string; answer: string }[]) ?? [],
        photos: photoItems,
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
          depositEnabled: residence.deposit_usd != null,
          depositUsd: residence.deposit_usd != null ? Number(residence.deposit_usd) : "",
          emptyMonthsEnabled: residence.empty_month_charge_percent != null,
          emptyMonthDiscountPercent:
            residence.empty_month_charge_percent != null
              ? Math.max(0, Math.min(100, 100 - Number(residence.empty_month_charge_percent)))
              : 50,
          earlyExitDepositClausesText: (residence.early_exit_deposit_clauses_text as string | null) ?? "",
          earlyExitCostsText: (residence.early_exit_costs_text as string | null) ?? "",
          earlyExitConditionsText: (residence.early_exit_conditions_text as string | null) ?? "",
        },
      }}
    />
  );
}
