"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { assertResidenceAccess } from "@/lib/residences/access";
import { createAuditLog } from "@/lib/audit";
import { usdToArsReferencial } from "@/lib/mock/exchange";
import {
  SERVICE_OPTIONS,
  COMMON_AREA_OPTIONS,
  UNIVERSITY_OPTIONS,
  ROOM_TYPE_NAMES,
  GENDER_POLICY_OPTIONS,
  ADJUSTMENT_POLICY_OPTIONS,
  ROOM_FEATURE_OPTIONS,
} from "@/lib/residences/options";

export type ProfileFormState = {
  status: "idle" | "error" | "saved" | "submitted";
  message?: string;
};

const SERVICES = new Set<string>(SERVICE_OPTIONS);
const COMMON_AREAS = new Set<string>(COMMON_AREA_OPTIONS);
const UNIVERSITIES = new Set<string>(UNIVERSITY_OPTIONS);
const ROOM_NAMES = new Set<string>(ROOM_TYPE_NAMES);
const GENDER_POLICIES = new Set(GENDER_POLICY_OPTIONS.map((o) => o.value));
const ADJUSTMENT_POLICIES = new Set(ADJUSTMENT_POLICY_OPTIONS.map((o) => o.value));
const ROOM_FEATURES = new Set<string>(ROOM_FEATURE_OPTIONS);
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

interface RoomTypeInput {
  name: string;
  genderPolicy?: string;
  bathroomType?: string;
  features: string[];
  availableCount: number;
  monthlyPriceUsd: number;
  enrollmentFeeUsd?: number;
  depositUsd?: number;
  adjustmentPolicy: string;
  minimumStayMonths?: number;
}

/** Docs/06 §3.3: tarifas USD terminan en 0 o 5. Redondeo suave, no rechazo. */
function roundUsd(value: number): number {
  return Math.round(value / 5) * 5;
}
/** Docs/06 §3.3: tarifas ARS terminan en 500 o 000. */
function roundArs(value: number): number {
  return Math.round(value / 500) * 500;
}

function parseRoomTypes(raw: string): RoomTypeInput[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((r) => ({
      name: String(r.name ?? ""),
      genderPolicy: r.genderPolicy ? String(r.genderPolicy) : undefined,
      bathroomType: r.bathroomType ? String(r.bathroomType) : undefined,
      features: Array.isArray(r.features) ? r.features.map(String) : [],
      availableCount: Number(r.availableCount) || 0,
      monthlyPriceUsd: Number(r.monthlyPriceUsd) || 0,
      enrollmentFeeUsd: r.enrollmentFeeUsd ? Number(r.enrollmentFeeUsd) : undefined,
      depositUsd: r.depositUsd ? Number(r.depositUsd) : undefined,
      adjustmentPolicy: String(r.adjustmentPolicy ?? "quarterly"),
      minimumStayMonths: r.minimumStayMonths ? Number(r.minimumStayMonths) : undefined,
    }));
  } catch {
    return null;
  }
}

/**
 * Guarda el perfil de residencia (docs/12 §6.2, §6.4).
 *
 * `intent` = "draft" guarda sin tocar el estado de publicación.
 * `intent` = "submit" además valida mínimos de publicación y pasa
 * residences.status → pending_verification (docs/12 §6.3: no publica
 * sin verificación; acá solo se solicita).
 */
export async function saveResidenceProfile(
  residenceId: string,
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };

  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };

  const hasAccess = await assertResidenceAccess(admin, sessionUser.id, residenceId);
  if (!hasAccess) return { status: "error", message: "No tenés acceso a esta residencia." };

  const intent = String(formData.get("intent") ?? "draft");
  const tagline = String(formData.get("tagline") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const rulesSummary = String(formData.get("rules_summary") ?? "").trim();
  const services = formData.getAll("services").map(String).filter((s) => SERVICES.has(s));
  const commonAreas = formData.getAll("common_areas").map(String).filter((s) => COMMON_AREAS.has(s));
  const nearUniversities = formData
    .getAll("near_universities")
    .map(String)
    .filter((s) => UNIVERSITIES.has(s));

  if (tagline.length > 80)
    return { status: "error", message: "El eslogan no puede superar los 80 caracteres." };

  const roomTypesRaw = String(formData.get("room_types_json") ?? "[]");
  const roomTypes = parseRoomTypes(roomTypesRaw);
  if (!roomTypes) return { status: "error", message: "Hubo un problema con los tipos de habitación." };

  for (const rt of roomTypes) {
    if (!ROOM_NAMES.has(rt.name))
      return { status: "error", message: "Uno de los tipos de habitación no es válido." };
    if (rt.genderPolicy && !GENDER_POLICIES.has(rt.genderPolicy as never))
      return { status: "error", message: "Género permitido inválido." };
    if (!ADJUSTMENT_POLICIES.has(rt.adjustmentPolicy as never))
      return { status: "error", message: "Política de ajuste inválida." };
    if (rt.monthlyPriceUsd <= 0)
      return { status: "error", message: "Cada tipo de habitación necesita una tarifa mayor a 0." };
    if (rt.features.some((f) => !ROOM_FEATURES.has(f)))
      return { status: "error", message: "Una de las características no es válida." };
  }

  if (intent === "submit") {
    if (roomTypes.length === 0)
      return { status: "error", message: "Agregá al menos un tipo de habitación antes de enviar." };
  }

  try {
    // Datos básicos + descripción.
    const { error: residenceError } = await admin
      .from("residences")
      .update({ tagline: tagline || null, description: description || null })
      .eq("id", residenceId);
    if (residenceError) throw residenceError;

    // Secciones (upsert por section_type).
    const sections = [
      { section_type: "services", content: { items: services } },
      { section_type: "common_areas", content: { items: commonAreas } },
      { section_type: "near_universities", content: { items: nearUniversities } },
      {
        section_type: "rules",
        content: { summary: rulesSummary },
        requires_admin_review: true,
      },
    ];
    for (const section of sections) {
      const { error } = await admin.from("residence_profile_sections").upsert(
        { residence_id: residenceId, ...section },
        { onConflict: "residence_id,section_type" },
      );
      if (error) throw error;
    }

    // Reglamento PDF (opcional).
    const rulesFile = formData.get("rules_file");
    if (rulesFile instanceof File && rulesFile.size > 0) {
      if (rulesFile.size > MAX_PDF_BYTES)
        return { status: "error", message: "El reglamento no puede superar los 10MB." };
      if (rulesFile.type !== "application/pdf")
        return { status: "error", message: "El reglamento debe ser un PDF." };
      const path = `${residenceId}/reglamento-${Date.now()}.pdf`;
      const { error: uploadError } = await admin.storage
        .from("private-residence-documents")
        .upload(path, rulesFile, { contentType: "application/pdf", upsert: true });
      if (uploadError) throw uploadError;
      await admin.from("files").insert({
        owner_user_id: sessionUser.id,
        related_entity_type: "residences",
        related_entity_id: residenceId,
        bucket: "private-residence-documents",
        storage_path: path,
        filename: rulesFile.name,
        mime_type: rulesFile.type,
        size_bytes: rulesFile.size,
        visibility: "private",
        document_type: "residence_rules_document",
        uploaded_by_user_id: sessionUser.id,
      });
    }

    // Fotos (0 a N).
    const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
    for (const photo of photos) {
      if (photo.size > MAX_PHOTO_BYTES)
        return { status: "error", message: `"${photo.name}" supera los 5MB.` };
      if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type))
        return { status: "error", message: `"${photo.name}" debe ser JPG, PNG o WebP.` };
      const ext = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
      const path = `${residenceId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await admin.storage
        .from("public-residence-media")
        .upload(path, photo, { contentType: photo.type });
      if (uploadError) throw uploadError;
      await admin.from("files").insert({
        owner_user_id: sessionUser.id,
        related_entity_type: "residences",
        related_entity_id: residenceId,
        bucket: "public-residence-media",
        storage_path: path,
        filename: photo.name,
        mime_type: photo.type,
        size_bytes: photo.size,
        visibility: "public",
        document_type: "residence_photo",
        status: "approved", // fotos no requieren revisión previa para pre-visualizar (docs 8.5 sí exige revisión de cambios críticos; fotos se marcan approved a nivel archivo y la publicación real depende de residence_verifications)
        uploaded_by_user_id: sessionUser.id,
      });
    }

    // Tipos de habitación: reemplaza los existentes (simplificación del
    // ciclo — el histórico de tarifas real vía tariff_change_logs llega
    // cuando exista edición fina post-publicación).
    const { data: existingTypes } = await admin
      .from("room_types")
      .select("id")
      .eq("residence_id", residenceId);
    if (existingTypes && existingTypes.length > 0) {
      const ids = existingTypes.map((t) => t.id);
      await admin.from("profile_availability").delete().in("room_type_id", ids);
      await admin.from("room_types").delete().in("id", ids);
    }

    for (const rt of roomTypes) {
      const monthlyPriceUsd = roundUsd(rt.monthlyPriceUsd);
      const { data: inserted, error: rtError } = await admin
        .from("room_types")
        .insert({
          residence_id: residenceId,
          name: rt.name,
          gender_policy: rt.genderPolicy || null,
          bathroom_type: rt.bathroomType || null,
          features: rt.features,
          monthly_price_usd: monthlyPriceUsd,
          monthly_price_ars: roundArs(usdToArsReferencial(monthlyPriceUsd)),
          enrollment_fee_usd: rt.enrollmentFeeUsd ? roundUsd(rt.enrollmentFeeUsd) : null,
          enrollment_fee_ars: rt.enrollmentFeeUsd
            ? roundArs(usdToArsReferencial(roundUsd(rt.enrollmentFeeUsd)))
            : null,
          deposit_usd: rt.depositUsd ? roundUsd(rt.depositUsd) : null,
          deposit_ars: rt.depositUsd ? roundArs(usdToArsReferencial(roundUsd(rt.depositUsd))) : null,
          adjustment_policy: rt.adjustmentPolicy,
          minimum_stay_months: rt.minimumStayMonths || null,
        })
        .select("id")
        .single();
      if (rtError || !inserted) throw rtError;

      await admin.from("profile_availability").insert({
        residence_id: residenceId,
        room_type_id: inserted.id,
        status: rt.availableCount > 0 ? "available_to_confirm" : "full",
        available_count: rt.availableCount,
        last_confirmed_by: sessionUser.id,
      });
    }

    await createAuditLog(admin, {
      actorUserId: sessionUser.id,
      actorRole: "residence_owner",
      action: intent === "submit" ? "residence_profile_submitted" : "residence_profile_saved_draft",
      entityType: "residences",
      entityId: residenceId,
      newValue: { services, common_areas: commonAreas, room_types_count: roomTypes.length },
    });

    if (intent === "submit") {
      const { error: statusError } = await admin
        .from("residences")
        .update({ status: "pending_verification" })
        .eq("id", residenceId)
        .eq("status", "draft"); // no reabrir si ya estaba en un estado posterior
      if (statusError) throw statusError;

      await admin
        .from("residence_verifications")
        .update({ status: "documents_pending" })
        .eq("residence_id", residenceId)
        .eq("status", "not_started");
    }
  } catch (error) {
    console.error("[residence-profile] save failed:", error);
    return {
      status: "error",
      message: "No pudimos guardar los cambios. Intentá de nuevo en unos minutos.",
    };
  }

  revalidatePath(`/residence/${residenceId}/profile`);
  revalidatePath("/residence/dashboard");
  return intent === "submit"
    ? { status: "submitted" }
    : { status: "saved", message: "Cambios guardados como borrador." };
}
