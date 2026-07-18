"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { assertResidenceAccess } from "@/lib/residences/access";
import { createAuditLog } from "@/lib/audit";
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
import { applyRoomTypesUpdate, hasStructuralRoomTypeChange, stageProfileEdit, type RoomTypeEditInput } from "@/lib/residences/profileEdits";
import { logTariffChange } from "@/lib/residences/tariffLog";

export type ProfileFormState = {
  status: "idle" | "error" | "saved" | "submitted" | "saved_pending_review";
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

function parseRoomTypes(raw: string): RoomTypeEditInput[] | null {
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

const FIELD_GROUP_LABELS: Record<string, string> = {
  photos: "fotos",
  services: "servicios",
  rules: "reglas/reglamento",
  minimum_stay_months: "mínimo de estadía",
  room_types: "tipos de habitación",
};

/**
 * Guarda el perfil de residencia (docs/12 §6.2, §6.4).
 *
 * `intent` = "draft" guarda sin tocar el estado de publicación.
 * `intent` = "submit" además valida mínimos de publicación y pasa
 * residences.status → pending_verification (docs/12 §6.3: no publica
 * sin verificación; acá solo se solicita).
 *
 * Revisión de ediciones (docs/09 §8, migración 0027, Ciclo 34sexvicies):
 * si la residencia ya está `verified_active`, los campos críticos
 * (fotos, servicios, reglas + reglamento, mínimo de estadía, tipos de
 * habitación con cambio estructural) NO se aplican acá — quedan
 * `pending_admin_review` en `residence_profile_edits` hasta que un admin
 * los apruebe en `/admin/profile-edits`. El resto (eslogan, descripción,
 * áreas comunes, universidades cercanas, matrícula/depósito/política de
 * ajuste/mes vacío, precio de tipos ya existentes sin cambio
 * estructural) se sigue aplicando al instante, igual que antes.
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

  const { data: residenceRow } = await admin
    .from("residences")
    .select("status, minimum_stay_months, adjustment_policy, enrollment_fee_usd, deposit_usd")
    .eq("id", residenceId)
    .single();
  const gateApplies = residenceRow?.status === "verified_active";

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
  const pendingGroups: string[] = [];

  try {
    // Datos siempre directos: eslogan, descripción, y los términos
    // comerciales de condiciones de reserva que docs/09 §8.2 deja
    // explícitamente fuera de la aprobación previa (solo auditados).
    const { error: residenceError } = await admin
      .from("residences")
      .update({
        tagline: tagline || null,
        description: description || null,
        adjustment_policy: conditions.adjustmentPolicy,
        enrollment_fee_mode: conditions.enrollmentFeeMode,
        enrollment_fee_usd: conditions.enrollmentFeeMode === "manual" ? conditions.enrollmentFeeUsd : null,
        enrollment_fee_frequency: conditions.enrollmentFeeFrequency,
        deposit_usd: conditions.depositUsd,
        empty_month_charge_percent: conditions.emptyMonthChargePercent,
      })
      .eq("id", residenceId);
    if (residenceError) throw residenceError;

    // Administración de tarifas (docs/09 §9): matrícula/depósito/
    // política de ajuste se auditan siempre, se apliquen directo o no
    // — nunca bloquean el guardado (docs/09 §8.2 los deja fuera de la
    // aprobación previa).
    const newEnrollmentFeeUsd = conditions.enrollmentFeeMode === "manual" ? conditions.enrollmentFeeUsd : null;
    await Promise.all([
      logTariffChange(admin, {
        residenceId,
        changedByUserId: sessionUser.id,
        fieldName: "adjustment_policy",
        oldValue: residenceRow?.adjustment_policy ?? null,
        newValue: conditions.adjustmentPolicy,
      }),
      logTariffChange(admin, {
        residenceId,
        changedByUserId: sessionUser.id,
        fieldName: "enrollment_fee",
        oldValue: residenceRow?.enrollment_fee_usd ?? null,
        newValue: newEnrollmentFeeUsd,
        currencyCode: "USD",
      }),
      logTariffChange(admin, {
        residenceId,
        changedByUserId: sessionUser.id,
        fieldName: "deposit",
        oldValue: residenceRow?.deposit_usd ?? null,
        newValue: conditions.depositUsd,
        currencyCode: "USD",
      }),
    ]);

    // Mínimo de estadía: crítico (docs/09 §8.1) — gated si publicada.
    const currentMinStay = residenceRow?.minimum_stay_months ?? null;
    if (gateApplies && conditions.minimumStayMonths !== currentMinStay) {
      const stage = await stageProfileEdit(admin, {
        residenceId,
        fieldGroup: "minimum_stay_months",
        oldValue: { months: currentMinStay },
        newValue: { months: conditions.minimumStayMonths },
        submittedByUserId: sessionUser.id,
      });
      if (!stage.ok) return { status: "error", message: stage.error };
      pendingGroups.push("minimum_stay_months");
    } else {
      const { error } = await admin
        .from("residences")
        .update({ minimum_stay_months: conditions.minimumStayMonths })
        .eq("id", residenceId);
      if (error) throw error;
    }

    // Secciones no críticas: áreas comunes, universidades cercanas —
    // siempre directo.
    for (const section of [
      { section_type: "common_areas", content: { items: commonAreas } },
      { section_type: "near_universities", content: { items: nearUniversities } },
    ]) {
      const { error } = await admin
        .from("residence_profile_sections")
        .upsert({ residence_id: residenceId, ...section }, { onConflict: "residence_id,section_type" });
      if (error) throw error;
    }

    // Servicios: crítico (docs/09 §8.1) — gated si publicada.
    const { data: existingSections } = await admin
      .from("residence_profile_sections")
      .select("section_type, content")
      .eq("residence_id", residenceId)
      .in("section_type", ["services", "rules"]);
    const currentServices = ((existingSections ?? []).find((s) => s.section_type === "services")?.content as { items?: string[] } | undefined)?.items ?? [];
    const currentRulesSummary = ((existingSections ?? []).find((s) => s.section_type === "rules")?.content as { summary?: string } | undefined)?.summary ?? "";

    const servicesChanged = [...currentServices].sort().join(",") !== [...services].sort().join(",");
    if (gateApplies && servicesChanged) {
      const stage = await stageProfileEdit(admin, {
        residenceId,
        fieldGroup: "services",
        oldValue: { items: currentServices },
        newValue: { items: services },
        submittedByUserId: sessionUser.id,
      });
      if (!stage.ok) return { status: "error", message: stage.error };
      pendingGroups.push("services");
    } else {
      const { error } = await admin
        .from("residence_profile_sections")
        .upsert(
          { residence_id: residenceId, section_type: "services", content: { items: services } },
          { onConflict: "residence_id,section_type" },
        );
      if (error) throw error;
    }

    // Reglamento PDF (opcional) — se sube igual, pero si queda pendiente
    // de revisión el archivo se marca `pending_review` (nunca se sirve
    // públicamente hasta aprobarse).
    let uploadedRulesFile: { fileId: string; filename: string } | null = null;
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
      const { data: insertedFile, error: fileInsertError } = await admin
        .from("files")
        .insert({
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
          status: gateApplies ? "pending_review" : "approved",
          uploaded_by_user_id: sessionUser.id,
        })
        .select("id")
        .single();
      if (fileInsertError || !insertedFile) throw fileInsertError;
      uploadedRulesFile = { fileId: insertedFile.id, filename: rulesFile.name };
    }

    // Reglas: crítico (docs/09 §8.1) — gated si publicada. Cambia si el
    // resumen cambió o si se subió un reglamento nuevo.
    const rulesChanged = rulesSummary !== currentRulesSummary || uploadedRulesFile !== null;
    if (gateApplies && rulesChanged) {
      const stage = await stageProfileEdit(admin, {
        residenceId,
        fieldGroup: "rules",
        oldValue: { summary: currentRulesSummary },
        newValue: { summary: rulesSummary, rulesFile: uploadedRulesFile },
        submittedByUserId: sessionUser.id,
      });
      if (!stage.ok) return { status: "error", message: stage.error };
      pendingGroups.push("rules");
    } else {
      const { error } = await admin.from("residence_profile_sections").upsert(
        { residence_id: residenceId, section_type: "rules", content: { summary: rulesSummary }, requires_admin_review: true },
        { onConflict: "residence_id,section_type" },
      );
      if (error) throw error;
      if (uploadedRulesFile) {
        const { error: approveError } = await admin.from("files").update({ status: "approved" }).eq("id", uploadedRulesFile.fileId);
        if (approveError) throw approveError;
      }
    }

    // Fotos: crítico (docs/09 §8.1) — gated si publicada. Se suben
    // siempre; si queda pendiente, el archivo entra `pending_review` y
    // no se muestra públicamente hasta que un admin lo apruebe.
    const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
    const uploadedPhotoIds: string[] = [];
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
      const { data: insertedPhoto, error: photoInsertError } = await admin
        .from("files")
        .insert({
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
          status: gateApplies ? "pending_review" : "approved",
          uploaded_by_user_id: sessionUser.id,
        })
        .select("id")
        .single();
      if (photoInsertError || !insertedPhoto) throw photoInsertError;
      uploadedPhotoIds.push(insertedPhoto.id);
    }
    if (gateApplies && uploadedPhotoIds.length > 0) {
      const stage = await stageProfileEdit(admin, {
        residenceId,
        fieldGroup: "photos",
        oldValue: null,
        newValue: { fileIds: uploadedPhotoIds },
        submittedByUserId: sessionUser.id,
      });
      if (!stage.ok) return { status: "error", message: stage.error };
      pendingGroups.push("photos");
    }

    // Tipos de habitación: crítico (docs/09 §8.1) — gated si publicada Y
    // el cambio es estructural (agrega/quita tipos, cambia cantidad de
    // habitaciones, género, baño o características). El precio solo NO
    // gatea (docs/09 §8.2: "Precios" se audita, no se aprueba antes).
    const { data: existingTypesFull } = await admin
      .from("room_types")
      .select("id, name, is_active, gender_policy, bathroom_type, features, capacity_per_room")
      .eq("residence_id", residenceId);
    const { data: existingRooms } = await admin
      .from("rooms")
      .select("id, room_type_id")
      .eq("residence_id", residenceId)
      .eq("is_active", true);
    const roomCountByType = new Map<string, number>();
    for (const r of existingRooms ?? []) {
      roomCountByType.set(r.room_type_id, (roomCountByType.get(r.room_type_id) ?? 0) + 1);
    }
    const currentSnapshots = (existingTypesFull ?? [])
      .filter((t) => t.is_active)
      .map((t) => ({
        id: t.id,
        name: t.name,
        genderPolicy: t.gender_policy,
        bathroomType: t.bathroom_type,
        features: (t.features as string[]) ?? [],
        roomCount: roomCountByType.get(t.id) ?? 0,
        capacityPerRoom: t.capacity_per_room ?? 1,
      }));

    const structuralChange = gateApplies && hasStructuralRoomTypeChange(currentSnapshots, roomTypes);
    if (structuralChange) {
      const stage = await stageProfileEdit(admin, {
        residenceId,
        fieldGroup: "room_types",
        oldValue: { roomTypes: currentSnapshots },
        newValue: { roomTypes },
        submittedByUserId: sessionUser.id,
      });
      if (!stage.ok) return { status: "error", message: stage.error };
      pendingGroups.push("room_types");
    } else {
      // Tipos quitados del formulario se DESACTIVAN (is_active=false),
      // nunca se borran: el histórico los sigue referenciando.
      const draftIds = new Set(roomTypes.map((rt) => rt.id).filter(Boolean));
      const removed = (existingTypesFull ?? []).filter((t) => t.is_active && !draftIds.has(t.id));
      if (removed.length > 0) {
        const { error } = await admin.from("room_types").update({ is_active: false }).in(
          "id",
          removed.map((t) => t.id),
        );
        if (error) throw error;
      }
      const rate = await getCurrentExchangeRate();
      const result = await applyRoomTypesUpdate(admin, {
        residenceId,
        sessionUserId: sessionUser.id,
        roomTypes,
        arsPerUsd: rate.arsPerUsd,
      });
      if (!result.ok) return { status: "error", message: result.error };
      warnings.push(...result.warnings);
    }

    await createAuditLog(admin, {
      actorUserId: sessionUser.id,
      actorRole: "residence_owner",
      action: intent === "submit" ? "residence_profile_submitted" : "residence_profile_saved_draft",
      entityType: "residences",
      entityId: residenceId,
      newValue: { services, common_areas: commonAreas, room_types_count: roomTypes.length, pending_review: pendingGroups },
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

  if (pendingGroups.length > 0) {
    const labels = pendingGroups.map((g) => FIELD_GROUP_LABELS[g] ?? g).join(", ");
    return {
      status: "saved_pending_review",
      message: `Guardamos tus cambios. Como esta residencia ya está publicada, lo siguiente quedó pendiente de aprobación del equipo de EstuRed: ${labels}.${warningSuffix}`,
    };
  }

  return intent === "submit"
    ? { status: "submitted" }
    : { status: "saved", message: `Cambios guardados como borrador.${warningSuffix}` };
}
