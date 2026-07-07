import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertResidenceAccess } from "@/lib/residences/access";
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

  const hasAccess = await assertResidenceAccess(admin, sessionUser.id, residenceId);
  if (!hasAccess) notFound();

  const [{ data: residence }, { data: sections }, { data: roomTypes }, { data: photos }, { data: rulesFile }] =
    await Promise.all([
      admin.from("residences").select("*").eq("id", residenceId).single(),
      admin.from("residence_profile_sections").select("section_type, content").eq("residence_id", residenceId),
      admin
        .from("room_types")
        .select(
          "id, name, gender_policy, bathroom_type, features, monthly_price_usd, enrollment_fee_usd, deposit_usd, adjustment_policy, minimum_stay_months, profile_availability(available_count)",
        )
        .eq("residence_id", residenceId),
      admin
        .from("files")
        .select("id, storage_path")
        .eq("related_entity_type", "residences")
        .eq("related_entity_id", residenceId)
        .eq("document_type", "residence_photo")
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
    ]);

  if (!residence) notFound();

  const sectionMap = Object.fromEntries((sections ?? []).map((s) => [s.section_type, s.content]));
  const photoUrls = (photos ?? []).map(
    (p) => admin.storage.from("public-residence-media").getPublicUrl(p.storage_path).data.publicUrl,
  );

  return (
    <ResidenceProfileForm
      residenceId={residenceId}
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
        photoUrls,
        roomTypes: (roomTypes ?? []).map((rt) => ({
          name: rt.name,
          genderPolicy: rt.gender_policy ?? undefined,
          bathroomType: rt.bathroom_type ?? undefined,
          features: (rt.features as string[]) ?? [],
          availableCount:
            (rt.profile_availability as unknown as { available_count: number | null }[])?.[0]
              ?.available_count ?? 0,
          monthlyPriceUsd: Number(rt.monthly_price_usd),
          enrollmentFeeUsd: rt.enrollment_fee_usd ? Number(rt.enrollment_fee_usd) : undefined,
          depositUsd: rt.deposit_usd ? Number(rt.deposit_usd) : undefined,
          adjustmentPolicy: rt.adjustment_policy,
          minimumStayMonths: rt.minimum_stay_months ?? undefined,
        })),
      }}
    />
  );
}
