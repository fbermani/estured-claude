"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { assertResidenceAccess } from "@/lib/residences/access";
import { createAuditLog } from "@/lib/audit";
import { usdToArs, roundUsd, roundArs } from "@/lib/mock/exchange";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";
import {
  SERVICE_OPTIONS,
  COMMON_AREA_OPTIONS,
  UNIVERSITY_OPTIONS,
  ROOM_TYPE_NAMES,
  GENDER_POLICY_OPTIONS,
  ADJUSTMENT_POLICY_OPTIONS,
  ROOM_FEATURE_OPTIONS,
} from "@/lib/residences/options";
import { syncRoomsAndBeds } from "@/lib/residences/syncRoomsAndBeds";

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
  /** id existente en DB → update; sin id → tipo nuevo. */
  id?: string;
  name: string;
  genderPolicy?: string;
  bathroomType?: string;
  features: string[];
  /** Cantidad de habitaciones físicas del tipo (sincroniza `rooms`). */
  roomCount: number;
  /** Camas por habitación (derivada del nombre; editable en Compartida). */
  capacityPerRoom: number;
  monthlyPriceUsd: number;
}

function parseRoomTypes(raw: string): RoomTypeInput[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((r) => ({
      id: r.id ? String(r.id) : undefined,
      name: String(r.name ?? ""),
      genderPolicy: r.genderPolicy ? String(r.genderPolicy) : undefined,
      bathroomType: r.bathroomType ? String(r.bathroomType) : undefined,
      features: Array.isArray(r.features) ? r.features.map(String) : [],
      roomCount: Math.max(0, Math.min(60, Number(r.roomCount) || 0)),
      capacityPerRoom: Math.max(1, Math.min(10, Number(r.capacityPerRoom) || 1)),
      monthlyPriceUsd: Number(r.monthlyPriceUsd) || 0,
    }));
  } catch {
    return null;
  }
}

/**
 * Condiciones de reserva generales de la residencia (migración 0025,
 * referencia `estured_configuraci_n_de_residencia_onboarding`):
 * matrícula y depósito son excluyentes; el mes vacío se expresa como %
 * de la renta cobrado por mes completo entre la solicitud y el ingreso.
 */
interface ConditionsInput {
  minimumStayMonths: number | null;
  adjustmentPolicy: string;
  enrollmentFeeMode: "one_month" | "manual" | null;
  enrollmentFeeUsd: number | null;
  enrollmentFeeFrequency: "once" | "annual";
  depositUsd: number | null;
  emptyMonthChargePercent: number | null;
}

function parseConditions(raw: string): ConditionsInput | null {
  try {
    const c = JSON.parse(raw);
    const mode = c.enrollmentFeeMode === "one_month" || c.enrollmentFeeMode === "manual" ? c.enrollmentFeeMode : null;
    return {
      minimumStayMonths:
        c.minimumStayMonths != null && c.minimumStayMonths !== ""
          ? Math.max(1, Math.min(24, Number(c.minimumStayMonths) || 1))
          : null,
      adjustmentPolicy: String(c.adjustmentPolicy ?? "quarterly"),
      enrollmentFeeMode: mode,
      enrollmentFeeUsd:
        mode === "manual" && c.enrollmentFeeUsd != null ? Math.max(0, Number(c.enrollmentFeeUsd) || 0) : null,
      enrollmentFeeFrequency: c.enrollmentFeeFrequency === "annual" ? "annual" : "once",
      depositUsd: c.depositUsd != null && c.depositUsd !== "" ? Math.max(0, Number(c.depositUsd) || 0) : null,
      emptyMonthChargePercent:
        c.emptyMonthChargePercent != null && c.emptyMonthChargePercent !== ""
          ? Math.min(100, Math.max(0, Number(c.emptyMonthChargePercent) || 0))
          : null,
    };
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

  const conditionsRaw = String(formData.get("conditions_json") ?? "{}");
  const conditions = parseConditions(conditionsRaw);
  if (!conditions) return { status: "error", message: "Hubo un problema con las condiciones de reserva." };
  if (!ADJUSTMENT_POLICIES.has(conditions.adjustmentPolicy as never))
    return { status: "error", message: "Política de ajuste inválida." };
  if (conditions.depositUsd != null && conditions.enrollmentFeeMode != null)
    return {
      status: "error",
      message: "El depósito de garantía es excluyente con la matrícula: elegí uno de los dos.",
    };
  if (conditions.enrollmentFeeMode === "manual" && !conditions.enrollmentFeeUsd)
    return { status: "error", message: "Indicá el monto de la matrícula o cambiá a \"equivalente a 1 mes\"." };

  for (const rt of roomTypes) {
    if (!ROOM_NAMES.has(rt.name))
      return { status: "error", message: "Uno de los tipos de habitación no es válido." };
    if (rt.genderPolicy && !GENDER_POLICIES.has(rt.genderPolicy as never))
      return { status: "error", message: "Género permitido inválido." };
    if (rt.monthlyPriceUsd <= 0)
      return { status: "error", message: "Cada tipo de habitación necesita una tarifa mayor a 0." };
    if (rt.roomCount <= 0)
      return { status: "error", message: `Indicá cuántas habitaciones ${rt.name} tenés (mínimo 1).` };
    if (rt.features.some((f) => !ROOM_FEATURES.has(f)))
      return { status: "error", message: "Una de las características no es válida." };
  }
  const names = roomTypes.map((rt) => rt.name);
  if (new Set(names).size !== names.length)
    return { status: "error", message: "No repitas el mismo tipo de habitación dos veces." };

  if (intent === "submit") {
    if (roomTypes.length === 0)
      return { status: "error", message: "Agregá al menos un tipo de habitación antes de enviar." };
  }

  const warnings: string[] = [];

  try {
    // Datos básicos + descripción + condiciones de reserva (0025).
    const { error: residenceError } = await admin
      .from("residences")
      .update({
        tagline: tagline || null,
        description: description || null,
        minimum_stay_months: conditions.minimumStayMonths,
        adjustment_policy: conditions.adjustmentPolicy,
        enrollment_fee_mode: conditions.enrollmentFeeMode,
        enrollment_fee_usd: conditions.enrollmentFeeMode === "manual" ? conditions.enrollmentFeeUsd : null,
        enrollment_fee_frequency: conditions.enrollmentFeeFrequency,
        deposit_usd: conditions.depositUsd,
        empty_month_charge_percent: conditions.emptyMonthChargePercent,
      })
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

    // Tipos de habitación: UPSERT por id (Ciclo 34duovicies — el viejo
    // delete+reinsert rompería las FKs de solicitudes/estadías/habitaciones
    // que ya referencian estos tipos). Tipos quitados del formulario se
    // DESACTIVAN (is_active=false), nunca se borran: el histórico los
    // sigue referenciando.
    const { data: existingTypes } = await admin
      .from("room_types")
      .select("id, is_active")
      .eq("residence_id", residenceId);
    const draftIds = new Set(roomTypes.map((rt) => rt.id).filter(Boolean));
    const removed = (existingTypes ?? []).filter((t) => t.is_active && !draftIds.has(t.id));
    if (removed.length > 0) {
      const { error } = await admin
        .from("room_types")
        .update({ is_active: false })
        .in("id", removed.map((t) => t.id));
      if (error) throw error;
      // Sus habitaciones vacías también se dan de baja.
      for (const t of removed) {
        const sync = await syncRoomsAndBeds(admin, {
          residenceId,
          roomTypeId: t.id,
          desiredRoomCount: 0,
          capacityPerRoom: 1,
        });
        if (sync.ok) warnings.push(...sync.warnings);
      }
    }

    const rate = await getCurrentExchangeRate();
    for (const rt of roomTypes) {
      const monthlyPriceUsd = roundUsd(rt.monthlyPriceUsd);
      const baseFields = {
        name: rt.name,
        gender_policy: rt.genderPolicy || null,
        bathroom_type: rt.bathroomType || null,
        features: rt.features,
        capacity_per_room: rt.capacityPerRoom,
        monthly_price_usd: monthlyPriceUsd,
        monthly_price_ars: roundArs(usdToArs(monthlyPriceUsd, rate.arsPerUsd)),
        is_active: true,
      };

      let roomTypeId = rt.id ?? null;
      if (roomTypeId) {
        const { error } = await admin.from("room_types").update(baseFields).eq("id", roomTypeId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await admin
          .from("room_types")
          .insert({ residence_id: residenceId, ...baseFields })
          .select("id")
          .single();
        if (error || !inserted) throw error;
        roomTypeId = inserted.id;
        // La disponibilidad informada arranca "sin actualizar": se
        // gestiona en su propia pantalla, ya no desde la configuración.
        await admin.from("profile_availability").insert({
          residence_id: residenceId,
          room_type_id: roomTypeId,
          status: "not_updated",
          available_count: null,
          last_confirmed_by: sessionUser.id,
        });
      }

      const sync = await syncRoomsAndBeds(admin, {
        residenceId,
        roomTypeId: roomTypeId as string,
        desiredRoomCount: rt.roomCount,
        capacityPerRoom: rt.capacityPerRoom,
      });
      if (!sync.ok) return { status: "error", message: sync.error };
      warnings.push(...sync.warnings);
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
  revalidatePath(`/residence/${residenceId}/rooms`);
  revalidatePath("/residence/dashboard");
  const warningSuffix = warnings.length > 0 ? ` Atención: ${warnings.join(" ")}` : "";
  return intent === "submit"
    ? { status: "submitted" }
    : { status: "saved", message: `Cambios guardados como borrador.${warningSuffix}` };
}
