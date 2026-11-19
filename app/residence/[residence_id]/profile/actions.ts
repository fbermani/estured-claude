"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { assertResidenceOwner, assertResidencePermission } from "@/lib/residences/access";
import { createAuditLog, notifyAdmins } from "@/lib/audit";
import { getResidenceLocation } from "@/lib/residences/residenceLocation";
import { findFarUniversities, newlyFarUniversities, RECOMMENDED_MAX_BLOCKS } from "@/lib/residences/farUniversities";
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
import {
  applyRoomTypesUpdate,
  changesRoomStructure,
  findForeignRoomTypeIds,
  hasStructuralRoomTypeChange,
  ROOM_TYPE_NOT_OWNED_MESSAGE,
  stageProfileEdit,
  type RoomTypeEditInput,
} from "@/lib/residences/profileEdits";
import { logTariffChange } from "@/lib/residences/tariffLog";
import { amenityDetailsFromForm, normalizeAmenityLists } from "@/lib/residences/amenityDetails";
import { SUBMITTABLE_RESIDENCE_STATUSES, VERIFICATION_STATUSES_RESET_ON_SUBMIT, isMissingColumnError, isResubmission } from "@/lib/residences/changesRequest";
import { parseCustomAmenityDrafts } from "@/lib/residences/customAmenities";
import { syncCustomAmenities } from "@/lib/residences/customAmenitiesDb";
import { splitRules, validateTopRules } from "@/lib/residences/topRules";
import { normalizeRuleItems, parseRuleItems, ruleItemsToSummary, sameRuleItems, type HouseRuleItem } from "@/lib/residences/ruleItems";
import { validateAgeRange } from "@/lib/residences/age";
import { MAX_RESIDENCE_PHOTOS } from "@/lib/residences/photos";
import { parseOwnFaqField } from "@/lib/residences/ownFaq";
import {
  STAY_DOCUMENTS_SECTION,
  normalizeStayDocumentsInput,
  parseStayDocumentsContent,
  type StayDocumentsConfig,
} from "@/lib/residences/stayDocuments";
import { imageExtension, sniffImageType } from "@/lib/residences/imageSniff";
import { extensionForMime, resolveDocumentType, toTypedBlob } from "@/lib/files/sniffFile";
import { validateEarlyExitPolicy } from "@/lib/stayChange/validate";
import { parseMoneyConditionsInput, type DepositMode } from "@/lib/applications/reservationMoney";
import { describeInitialPaymentForLog, initialPaymentConfigFromRow, parseInitialPaymentInput, type InitialPaymentConfig } from "@/lib/reservations/initialPayment";
import { safeFilename } from "@/lib/files/safeFilename";

/** Mensaje cuando un staff con `profile.edit` (sin `operations.rooms_availability`) intenta cambiar la estructura de habitaciones o plazas. */
const ROOM_STRUCTURE_PERMISSION_MESSAGE =
  "Cambiar la cantidad de habitaciones o plazas requiere el permiso de Habitaciones y disponibilidad. Pedíselo al dueño.";

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
/** Topes de texto libre y de precio (B4); la base tiene CHECK equivalentes en la migración 0084. */
const MAX_LONG_TEXT_CHARS = 5000;
const MAX_MONTHLY_PRICE_USD = 100_000;

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
  /** Pago inicial para reservar (D7/H08): se valida con `parseInitialPaymentInput`. */
  initialPayment: InitialPaymentConfig;
  enrollmentFeeMode: "one_month" | "manual" | null;
  enrollmentFeeUsd: number | null;
  enrollmentFeeFrequency: "once" | "annual";
  depositUsd: number | null;
  emptyMonthChargePercent: number | null;
  /** DR18 t3 (migración 0060): descuento de matrícula (null = sin descuento), su último día y depósito en meses de renta. */
  enrollmentDiscountPercent: number | null;
  enrollmentDiscountUntil: string | null;
  depositMode: DepositMode | null;
  /** Política de salida anticipada (DR3): texto libre informativo, hasta 1000 caracteres cada uno. */
  earlyExitDepositClausesText: string | null;
  earlyExitCostsText: string | null;
  earlyExitConditionsText: string | null;
  /** Edad de residentes (DR14, migración 0052): la residencia decide sola, sin aprobación del admin. */
  ageRange: { minResidentAge: number; maxResidentAge: number | null; acceptsMinors: boolean };
}

function parseConditions(raw: string): ConditionsInput | { error: string } | null {
  try {
    const c = JSON.parse(raw);
    const initialPayment = parseInitialPaymentInput({ mode: c.initialPaymentMode, usd: c.initialPaymentUsd });
    if (!initialPayment.ok) return { error: initialPayment.error };
    const earlyExit = validateEarlyExitPolicy({ depositClausesText: c.earlyExitDepositClausesText, costsText: c.earlyExitCostsText, conditionsText: c.earlyExitConditionsText });
    if (!earlyExit.ok) return { error: earlyExit.error };
    const ageRange = validateAgeRange({ minAge: c.minResidentAge, maxAge: c.maxResidentAge, acceptsMinors: c.acceptsMinors });
    if (!ageRange.ok) return { error: ageRange.error };
    const mode = c.enrollmentFeeMode === "one_month" || c.enrollmentFeeMode === "manual" ? c.enrollmentFeeMode : null;
    const depositUsd = c.depositUsd != null && c.depositUsd !== "" ? Math.max(0, Number(c.depositUsd) || 0) : null;
    const money = parseMoneyConditionsInput({
      enrollmentFeeMode: mode,
      depositUsd,
      enrollmentDiscountPercent: c.enrollmentDiscountPercent,
      enrollmentDiscountUntil: c.enrollmentDiscountUntil,
      depositMode: c.depositMode,
    });
    if (!money.ok) return { error: money.error };
    return {
      minimumStayMonths:
        c.minimumStayMonths != null && c.minimumStayMonths !== ""
          ? Math.max(1, Math.min(24, Number(c.minimumStayMonths) || 1))
          : null,
      adjustmentPolicy: String(c.adjustmentPolicy ?? "quarterly"),
      initialPayment: initialPayment.value,
      enrollmentFeeMode: mode,
      enrollmentFeeUsd:
        mode === "manual" && c.enrollmentFeeUsd != null ? Math.max(0, Number(c.enrollmentFeeUsd) || 0) : null,
      enrollmentFeeFrequency: c.enrollmentFeeFrequency === "annual" ? "annual" : "once",
      depositUsd,
      emptyMonthChargePercent:
        c.emptyMonthChargePercent != null && c.emptyMonthChargePercent !== ""
          ? Math.min(100, Math.max(0, Number(c.emptyMonthChargePercent) || 0))
          : null,
      enrollmentDiscountPercent: money.value.enrollmentDiscountPercent,
      enrollmentDiscountUntil: money.value.enrollmentDiscountUntil,
      depositMode: money.value.depositMode,
      earlyExitDepositClausesText: earlyExit.value.depositClausesText,
      earlyExitCostsText: earlyExit.value.costsText,
      earlyExitConditionsText: earlyExit.value.conditionsText,
      ageRange: ageRange.value,
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

  // DR11: guardar el perfil, las tarifas y las condiciones requiere el permiso `profile.edit` (apagado por defecto para el staff; el
  // dueño siempre puede). Enviar o reenviar a verificación (`intent = "submit"`) sigue siendo SOLO del dueño, no delegable.
  // El rol y los permisos salen de `residence_users` en el servidor, nunca del formulario.
  const intent = String(formData.get("intent") ?? "draft");
  const accessCheck =
    intent === "submit"
      ? await assertResidenceOwner(admin, sessionUser.id, residenceId)
      : await assertResidencePermission(admin, sessionUser.id, residenceId, "profile.edit");
  if (!accessCheck.ok) return { status: "error", message: accessCheck.error };

  const { data: residenceRow } = await admin
    .from("residences")
    .select("*")
    .eq("id", residenceId)
    .single();
  const gateApplies = residenceRow?.status === "verified_active";
  // Ciclo 66 (DR5) y Ciclo 70 (DR7): desde `needs_changes` o `verification_expired` el mismo "Enviar para revisión"
  // reenvía la residencia.
  const wasNeedsChanges = isResubmission(residenceRow?.status);
  const previousResidenceStatus = (residenceRow?.status as string | undefined) ?? "needs_changes";

  const tagline = String(formData.get("tagline") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const rulesSummaryRaw = String(formData.get("rules_summary") ?? "").trim();
  const customAmenityDrafts = parseCustomAmenityDrafts(String(formData.get("custom_amenities_json") ?? "[]"));
  if (!customAmenityDrafts) return { status: "error", message: "Hubo un problema con los ítems propios de servicios y áreas." };
  const services = formData.getAll("services").map(String).filter((s) => SERVICES.has(s));
  const commonAreas = formData.getAll("common_areas").map(String).filter((s) => COMMON_AREAS.has(s));
  // 0073: cantidad de cocinas compartidas y frecuencia de la limpieza general (validadas por whitelist y rango).
  const amenityDetails = amenityDetailsFromForm(formData, { services, commonAreas });
  if (amenityDetails.error) return { status: "error", message: amenityDetails.error };
  const nearUniversities = formData
    .getAll("near_universities")
    .map(String)
    .filter((s) => UNIVERSITIES.has(s));

  if (description.length > MAX_LONG_TEXT_CHARS)
    return { status: "error", message: `La descripción es demasiado larga (máximo ${MAX_LONG_TEXT_CHARS} caracteres).` };
  if (rulesSummaryRaw.length > MAX_LONG_TEXT_CHARS)
    return { status: "error", message: `El resumen del reglamento es demasiado largo (máximo ${MAX_LONG_TEXT_CHARS} caracteres).` };
  if (tagline.length > 80)
    return { status: "error", message: "El eslogan no puede superar los 80 caracteres." };

  // DR38: documentos que la residencia le pide a sus residentes. Solo el dueño los define (el servidor lo comprueba; al staff el
  // formulario ni siquiera se los manda). Sin aprobación del admin: no es contenido público. Se valida antes de escribir nada.
  let stayDocuments: StayDocumentsConfig | null = null;
  if (accessCheck.actorRole === "residence_owner" && formData.get("stay_documents_present") === "1") {
    let otherRaw: unknown[];
    try {
      const parsed = JSON.parse(String(formData.get("stay_documents_other_json") ?? "[]"));
      if (!Array.isArray(parsed)) throw new Error("not an array");
      otherRaw = parsed;
    } catch {
      return { status: "error", message: "Hubo un problema con los documentos que pedís a tus residentes." };
    }
    const docsCheck = normalizeStayDocumentsInput(formData.getAll("stay_documents"), otherRaw);
    if (!docsCheck.ok) return { status: "error", message: docsCheck.error };
    stayDocuments = docsCheck.value;
  }


  // Reglas destacadas (DR18): hasta 5, validadas acá; lo que ya estaba guardado sin cambios no se re-valida (residencias existentes).
  const { data: storedRulesSection } = await admin
    .from("residence_profile_sections")
    .select("content")
    .eq("residence_id", residenceId)
    .eq("section_type", "rules")
    .maybeSingle();
  const storedRulesRaw = ((storedRulesSection?.content as { summary?: string } | null)?.summary ?? "").trim();
  let rulesSummary = rulesSummaryRaw;
  // Reglas principales estructuradas (hasta 6 `{ lead?, title, detail? }`): el editor las manda solo si el dueño las tocó
  // (`rules_items_dirty`); si no, lo guardado (ítems y resumen) queda tal cual y no se pide revisión de nada.
  const storedRuleItems = parseRuleItems((storedRulesSection?.content as { items?: unknown } | null)?.items);
  let ruleItems: HouseRuleItem[] = storedRuleItems;
  if (formData.get("rules_items_dirty") === "1") {
    let rawItems: unknown;
    try {
      rawItems = JSON.parse(String(formData.get("rules_items_json") ?? "[]"));
    } catch {
      return { status: "error", message: "No pudimos leer las reglas principales. Probá de nuevo." };
    }
    const itemsCheck = normalizeRuleItems(rawItems);
    if (!itemsCheck.ok) return { status: "error", message: itemsCheck.error };
    ruleItems = itemsCheck.items;
    rulesSummary = ruleItemsToSummary(ruleItems);
  } else if (splitRules(rulesSummaryRaw).join("\n") !== splitRules(storedRulesRaw).join("\n")) {
    const rulesCheck = validateTopRules(rulesSummaryRaw);
    if (!rulesCheck.ok) return { status: "error", message: rulesCheck.error };
    rulesSummary = rulesCheck.items.join("\n");
  } else {
    rulesSummary = storedRulesRaw;
  }
  // Ítems «Otro»: se validan antes de escribir nada del perfil.
  const amenitiesCheck = await syncCustomAmenities(admin, {
    residenceId,
    residenceName: String(residenceRow?.name ?? "Una residencia"),
    actorUserId: sessionUser.id,
    actorRole: accessCheck.actorRole,
    drafts: customAmenityDrafts,
    validateOnly: true,
  });
  if (!amenitiesCheck.ok) return { status: "error", message: amenitiesCheck.error };

  const roomTypesRaw = String(formData.get("room_types_json") ?? "[]");
  const roomTypes = parseRoomTypes(roomTypesRaw);
  if (!roomTypes) return { status: "error", message: "Hubo un problema con los tipos de habitación." };

  const conditionsRaw = String(formData.get("conditions_json") ?? "{}");
  const parsedConditions = parseConditions(conditionsRaw);
  if (!parsedConditions) return { status: "error", message: "Hubo un problema con las condiciones de reserva." };
  if ("error" in parsedConditions) return { status: "error", message: parsedConditions.error };
  const conditions = parsedConditions;
  // DR14: sin la migración 0052 solo se puede guardar el default (18, sin tope, sin menores); se avisa antes de escribir nada.
  if (!("min_resident_age" in (residenceRow ?? {}))) {
    const a = conditions.ageRange;
    if (a.minResidentAge !== 18 || a.maxResidentAge !== null || a.acceptsMinors)
      return { status: "error", message: "Todavía no podemos guardar la edad de los residentes. Probá de nuevo en unos días." };
  }
  if (!ADJUSTMENT_POLICIES.has(conditions.adjustmentPolicy as never))
    return { status: "error", message: "Política de ajuste inválida." };
  if (conditions.depositUsd != null && conditions.enrollmentFeeMode != null)
    return {
      status: "error",
      message: "El depósito es excluyente con la matrícula: elegí uno de los dos.",
    };
  if (conditions.enrollmentFeeMode === "manual" && !conditions.enrollmentFeeUsd)
    return { status: "error", message: "Indicá el monto de la matrícula o cambiá a \"equivalente a 1 mes\"." };
  if (conditions.initialPayment.mode === "deposit_only" && conditions.depositUsd == null && conditions.depositMode === null)
    return { status: "error", message: "Para que el pago inicial sea el depósito, primero tenés que pedir depósito." };
  if (conditions.initialPayment.mode === "enrollment_only" && conditions.enrollmentFeeMode === null)
    return { status: "error", message: "Para que el pago inicial sea la matrícula, primero tenés que cobrar matrícula." };
  // DR18 t3: sin la migración 0060 solo se pueden guardar los valores de siempre; se avisa antes de escribir nada.
  const moneyColumnsExist = "deposit_mode" in (residenceRow ?? {});
  if (
    !moneyColumnsExist &&
    (conditions.depositMode !== null || conditions.enrollmentDiscountPercent !== null || conditions.initialPayment.mode === "enrollment_only")
  )
    return { status: "error", message: "Todavía no podemos guardar los descuentos de matrícula, el depósito en meses ni el pago inicial solo con matrícula. Probá de nuevo en unos días." };

  for (const rt of roomTypes) {
    if (!ROOM_NAMES.has(rt.name))
      return { status: "error", message: "Uno de los tipos de habitación no es válido." };
    if (rt.genderPolicy && !GENDER_POLICIES.has(rt.genderPolicy as never))
      return { status: "error", message: "Género permitido inválido." };
    if (rt.monthlyPriceUsd <= 0)
      return { status: "error", message: "Cada tipo de habitación necesita una tarifa mayor a 0." };
    if (!Number.isFinite(rt.monthlyPriceUsd) || rt.monthlyPriceUsd > MAX_MONTHLY_PRICE_USD)
      return { status: "error", message: `La tarifa de ${rt.name} es demasiado alta. Revisala (máximo USD ${MAX_MONTHLY_PRICE_USD.toLocaleString("es-AR")} por mes).` };
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

  // Tipos y habitaciones ACTUALES de esta residencia, leídos antes de escribir nada: sirven para (1) rechazar ids de tipos de habitación
  // que no son de esta residencia (IDOR: el `id` de cada tipo viaja del cliente) y (2) decidir si el guardado cambia la estructura de
  // habitaciones y camas (DR11).
  const { data: existingTypesFull, error: existingTypesError } = await admin
    .from("room_types")
    .select("id, name, is_active, gender_policy, bathroom_type, features, capacity_per_room")
    .eq("residence_id", residenceId);
  const { data: existingRooms, error: existingRoomsError } = await admin
    .from("rooms")
    .select("id, room_type_id")
    .eq("residence_id", residenceId)
    .eq("is_active", true);
  if (existingTypesError || existingRoomsError) {
    console.error("[residence-profile] room structure read failed:", existingTypesError ?? existingRoomsError);
    return { status: "error", message: "No pudimos leer los tipos de habitación actuales. Intentá de nuevo en unos minutos." };
  }
  if (findForeignRoomTypeIds((existingTypesFull ?? []).map((t) => t.id as string), roomTypes).length > 0) {
    return { status: "error", message: ROOM_TYPE_NOT_OWNED_MESSAGE };
  }
  const roomCountByType = new Map<string, number>();
  for (const r of existingRooms ?? []) {
    roomCountByType.set(r.room_type_id, (roomCountByType.get(r.room_type_id) ?? 0) + 1);
  }
  // DR11: `profile.edit` no alcanza para cambiar cuántas habitaciones o plazas tiene la residencia (agregar o quitar tipos, reactivarlos,
  // cambiar la cantidad de habitaciones o de plazas por habitación): además hace falta `operations.rooms_availability`. El dueño siempre puede.
  if (changesRoomStructure(existingTypesFull ?? [], roomCountByType, roomTypes)) {
    const rooms = await assertResidencePermission(admin, sessionUser.id, residenceId, "operations.rooms_availability");
    if (!rooms.ok) return { status: "error", message: ROOM_STRUCTURE_PERMISSION_MESSAGE };
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
        reservation_initial_payment_mode: conditions.initialPayment.mode,
        reservation_initial_payment_usd:
          conditions.initialPayment.mode === "custom_usd" ? conditions.initialPayment.customUsd : null,
        enrollment_fee_mode: conditions.enrollmentFeeMode,
        enrollment_fee_usd: conditions.enrollmentFeeMode === "manual" ? conditions.enrollmentFeeUsd : null,
        enrollment_fee_frequency: conditions.enrollmentFeeFrequency,
        deposit_usd: conditions.depositUsd,
        empty_month_charge_percent: conditions.emptyMonthChargePercent,
        // Dinero DR18 t3 (migración 0060): descuento de matrícula y depósito en meses. Se limpian junto con el resto para no violar las exclusiones.
        ...(moneyColumnsExist
          ? {
              enrollment_discount_percent: conditions.enrollmentFeeMode ? conditions.enrollmentDiscountPercent : null,
              enrollment_discount_until: conditions.enrollmentFeeMode ? conditions.enrollmentDiscountUntil : null,
              deposit_mode: conditions.depositMode,
            }
          : {}),
        // Política de salida anticipada (migración 0044): solo si la columna existe (residenceRow viene de `select *`).
        ...("early_exit_costs_text" in (residenceRow ?? {})
          ? {
              early_exit_deposit_clauses_text: conditions.earlyExitDepositClausesText,
              early_exit_costs_text: conditions.earlyExitCostsText,
              early_exit_conditions_text: conditions.earlyExitConditionsText,
            }
          : {}),
      })
      .eq("id", residenceId);
    if (residenceError) throw residenceError;

    // Edad de residentes (DR14, migración 0052): se aplica al instante (sin aprobación del admin) y se audita con valor anterior y nuevo.
    // Si la migración no está aplicada, solo se avisa cuando el valor enviado difiere del default.
    const age = conditions.ageRange;
    const ageColumnsExist = "min_resident_age" in (residenceRow ?? {});
    const oldAge = {
      min_resident_age: ageColumnsExist ? ((residenceRow?.min_resident_age as number | null) ?? 18) : 18,
      max_resident_age: ageColumnsExist ? ((residenceRow?.max_resident_age as number | null) ?? null) : null,
      accepts_minors: ageColumnsExist ? residenceRow?.accepts_minors === true : false,
    };
    const newAge = { min_resident_age: age.minResidentAge, max_resident_age: age.maxResidentAge, accepts_minors: age.acceptsMinors };
    if (JSON.stringify(oldAge) !== JSON.stringify(newAge)) {
      const { error: ageError } = await admin.from("residences").update(newAge).eq("id", residenceId);
      if (ageError) throw ageError;
      await createAuditLog(admin, {
        actorUserId: sessionUser.id,
        actorRole: accessCheck.actorRole,
        action: "residence_age_range_updated",
        entityType: "residences",
        entityId: residenceId,
        oldValue: oldAge,
        newValue: newAge,
      });
    }

    // Dinero DR18 t3: descuento de matrícula y depósito en meses se aplican directo (términos comerciales, como la matrícula) y se auditan.
    if (moneyColumnsExist) {
      const oldMoney = {
        enrollment_discount_percent: residenceRow?.enrollment_discount_percent != null ? Number(residenceRow.enrollment_discount_percent) : null,
        enrollment_discount_until: (residenceRow?.enrollment_discount_until as string | null) ?? null,
        deposit_mode: (residenceRow?.deposit_mode as string | null) ?? null,
      };
      const newMoney = {
        enrollment_discount_percent: conditions.enrollmentFeeMode ? conditions.enrollmentDiscountPercent : null,
        enrollment_discount_until: conditions.enrollmentFeeMode ? conditions.enrollmentDiscountUntil : null,
        deposit_mode: conditions.depositMode,
      };
      if (JSON.stringify(oldMoney) !== JSON.stringify(newMoney)) {
        await createAuditLog(admin, {
          actorUserId: sessionUser.id,
          actorRole: accessCheck.actorRole,
          action: "residence_money_conditions_updated",
          entityType: "residences",
          entityId: residenceId,
          oldValue: oldMoney,
          newValue: newMoney,
        });
      }
    }

    // Política de salida anticipada (DR3): se aplica al instante (es texto informativo, como la política de ajuste)
    // y se audita siempre que cambia, con el valor anterior y el nuevo.
    const oldEarlyExit = {
      deposit_clauses: (residenceRow?.early_exit_deposit_clauses_text as string | null) ?? null,
      costs: (residenceRow?.early_exit_costs_text as string | null) ?? null,
      conditions: (residenceRow?.early_exit_conditions_text as string | null) ?? null,
    };
    if (oldEarlyExit.deposit_clauses !== conditions.earlyExitDepositClausesText || oldEarlyExit.costs !== conditions.earlyExitCostsText || oldEarlyExit.conditions !== conditions.earlyExitConditionsText) {
      await createAuditLog(admin, {
        actorUserId: sessionUser.id,
        actorRole: accessCheck.actorRole,
        action: "residence_early_exit_policy_updated",
        entityType: "residences",
        entityId: residenceId,
        oldValue: oldEarlyExit,
        newValue: { deposit_clauses: conditions.earlyExitDepositClausesText, costs: conditions.earlyExitCostsText, conditions: conditions.earlyExitConditionsText },
      });
    }

    // Administración de tarifas (docs/09 §9): matrícula/depósito/
    // política de ajuste se auditan siempre, se apliquen directo o no
    // — nunca bloquean el guardado (docs/09 §8.2 los deja fuera de la
    // aprobación previa).
    const newEnrollmentFeeUsd = conditions.enrollmentFeeMode === "manual" ? conditions.enrollmentFeeUsd : null;
    // Pago inicial (D7/H08): se audita con texto legible ("Primer mes" / "Monto fijo USD 450"), incluido el cambio de modo.
    const oldInitialPayment = initialPaymentConfigFromRow(residenceRow ?? {});
    await Promise.all([
      logTariffChange(admin, {
        residenceId,
        changedByUserId: sessionUser.id,
        fieldName: "initial_payment",
        oldValue: describeInitialPaymentForLog(oldInitialPayment),
        newValue: describeInitialPaymentForLog(conditions.initialPayment),
      }),
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

    // Preguntas propias (sistema anterior al catálogo): hasta `OWN_FAQ_MAX` pares pregunta/respuesta, sanitizados (largo acotado,
    // sin HTML) — texto libre del dueño, mismo nivel de confianza que el resumen de reglas, no crítico (no requiere aprobación de
    // admin). Si el formulario no manda `faq_json` NO se toca lo guardado (un cliente viejo o incompleto nunca borra las preguntas).
    const faqItems = parseOwnFaqField(formData.get("faq_json"));

    // DR18: sedes a más de 20 cuadras (≈2 km) → solo alerta al admin; se guardan y se muestran igual.
    // Se compara contra lo guardado antes para no repetir el aviso en cada guardado.
    const { data: prevNearSection, error: prevNearError } = await admin
      .from("residence_profile_sections")
      .select("content")
      .eq("residence_id", residenceId)
      .eq("section_type", "near_universities")
      .maybeSingle();
    // Si no se pudo leer lo guardado, se toma lo nuevo como previo: mejor no alertar que alertar en cada guardado.
    const previousNear = prevNearError
      ? nearUniversities.map(String)
      : ((prevNearSection?.content as { items?: string[] } | null)?.items ?? []).map(String);

    // 0073: detalles (cocinas / frecuencia de limpieza). Si la columna aún no existe se avisa y el resto se guarda igual.
    {
      const { error: detailsError } = await admin.from("residences").update({ amenity_details: amenityDetails.value }).eq("id", residenceId);
      if (detailsError) {
        if (!isMissingColumnError(detailsError)) throw detailsError;
        if (Object.keys(amenityDetails.value).length > 0) warnings.push("Guardamos tu perfil, pero todavía no pudimos guardar la cantidad de cocinas ni la frecuencia de limpieza.");
      }
    }

    // Secciones no críticas: áreas comunes, universidades cercanas, FAQ —
    // siempre directo.
    for (const section of [
      { section_type: "common_areas", content: { items: commonAreas } },
      { section_type: "near_universities", content: { items: nearUniversities } },
      ...(faqItems !== null ? [{ section_type: "faq", content: { items: faqItems } }] : []),
    ]) {
      const { error } = await admin
        .from("residence_profile_sections")
        .upsert({ residence_id: residenceId, ...section }, { onConflict: "residence_id,section_type" });
      if (error) throw error;
    }

    if (stayDocuments) {
      const { data: prevDocsSection } = await admin
        .from("residence_profile_sections")
        .select("content")
        .eq("residence_id", residenceId)
        .eq("section_type", STAY_DOCUMENTS_SECTION)
        .maybeSingle();
      const previousDocs = parseStayDocumentsContent(prevDocsSection?.content);
      const { error: docsError } = await admin
        .from("residence_profile_sections")
        .upsert(
          { residence_id: residenceId, section_type: STAY_DOCUMENTS_SECTION, content: stayDocuments },
          { onConflict: "residence_id,section_type" },
        );
      if (docsError) throw docsError;
      if (JSON.stringify(previousDocs) !== JSON.stringify(stayDocuments)) {
        await createAuditLog(admin, {
          actorUserId: sessionUser.id,
          actorRole: accessCheck.actorRole,
          action: "residence_stay_documents_updated",
          entityType: "residences",
          entityId: residenceId,
          oldValue: previousDocs,
          newValue: stayDocuments,
        });
      }
    }

    try {
      const location = getResidenceLocation(residenceRow ?? {});
      // Con el centro del barrio como fallback la distancia no es confiable: solo se alerta con coordenada propia.
      if (location.source === "residence") {
        const newlyFar = newlyFarUniversities(findFarUniversities(location, nearUniversities), findFarUniversities(location, previousNear));
        if (newlyFar.length > 0) {
          const detail = newlyFar.map((u) => `${u.name} (~${u.distanceKm.toFixed(1).replace(".", ",")} km)`).join(", ");
          await createAuditLog(admin, {
            actorUserId: sessionUser.id,
            actorRole: accessCheck.actorRole,
            action: "residence_far_university_selected",
            entityType: "residences",
            entityId: residenceId,
            newValue: { universities: newlyFar, recommended_max_blocks: RECOMMENDED_MAX_BLOCKS },
          });
          await notifyAdmins(admin, {
            title: "Residencia con sede lejana",
            body: `«${String(residenceRow?.name ?? "Una residencia")}» eligió sedes a más de 20 cuadras (≈2 km): ${detail}. Revisá si corresponde.`,
            entityType: "residences",
            entityId: residenceId,
          });
        }
      }
    } catch (alertError) {
      // Un aviso que falla no puede romper el guardado del perfil.
      console.error("[profile] alerta de sede lejana falló:", alertError);
    }

    // Ítems «Otro» (DR18): quedan pendientes de aprobación del admin; no se muestran en la ficha pública hasta entonces.
    const amenitiesResult = await syncCustomAmenities(admin, {
      residenceId,
      residenceName: String(residenceRow?.name ?? "Una residencia"),
      actorUserId: sessionUser.id,
      actorRole: accessCheck.actorRole,
      drafts: customAmenityDrafts,
    });
    // Éxito parcial: el resto del perfil se sigue guardando y el aviso sale al final (no dar a entender que nada se guardó).
    if (!amenitiesResult.ok) {
      warnings.push(`Guardamos tu perfil, pero no pudimos guardar tus ítems propios (${amenitiesResult.error}) Probá de nuevo.`);
    }

    // Servicios: crítico (docs/09 §8.1) — gated si publicada.
    const { data: existingSections } = await admin
      .from("residence_profile_sections")
      .select("section_type, content")
      .eq("residence_id", residenceId)
      .in("section_type", ["services", "rules"]);
    // Filas anteriores a la 0073 guardan «Gimnasio»/«Cocina» como servicio: se normalizan para no contarlas como un cambio.
    const currentServices = normalizeAmenityLists({
      services: ((existingSections ?? []).find((s) => s.section_type === "services")?.content as { items?: string[] } | undefined)?.items ?? [],
      commonAreas: [],
    }).services;
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
      // Se comprueba el contenido real (firma `%PDF-`), no el MIME que declara el cliente.
      if ((await resolveDocumentType(rulesFile)) !== "application/pdf")
        return { status: "error", message: "El reglamento debe ser un PDF." };
      const path = `${residenceId}/reglamento-${Date.now()}.${extensionForMime("application/pdf")}`;
      const { error: uploadError } = await admin.storage
        .from("private-residence-documents")
        .upload(path, await toTypedBlob(rulesFile, "application/pdf"), { contentType: "application/pdf", upsert: true });
      if (uploadError) throw uploadError;
      const { data: insertedFile, error: fileInsertError } = await admin
        .from("files")
        .insert({
          owner_user_id: sessionUser.id,
          related_entity_type: "residences",
          related_entity_id: residenceId,
          bucket: "private-residence-documents",
          storage_path: path,
          filename: safeFilename(rulesFile.name),
          mime_type: "application/pdf",
          size_bytes: rulesFile.size,
          visibility: "private",
          document_type: "residence_rules_document",
          status: gateApplies ? "pending_review" : "approved",
          uploaded_by_user_id: sessionUser.id,
        })
        .select("id")
        .single();
      if (fileInsertError || !insertedFile) {
        // El PDF quedó sin registro: se limpia el objeto huérfano (mejor esfuerzo) y se propaga el error.
        await admin.storage.from("private-residence-documents").remove([path]);
        throw fileInsertError ?? new Error("No se pudo registrar el reglamento.");
      }
      uploadedRulesFile = { fileId: insertedFile.id, filename: safeFilename(rulesFile.name) };
    }

    // Reglas: crítico (docs/09 §8.1) — gated si publicada. Cambia si el
    // resumen cambió o si se subió un reglamento nuevo.
    const rulesChanged = rulesSummary !== currentRulesSummary || !sameRuleItems(ruleItems, storedRuleItems) || uploadedRulesFile !== null;
    if (gateApplies && rulesChanged) {
      const stage = await stageProfileEdit(admin, {
        residenceId,
        fieldGroup: "rules",
        oldValue: { summary: currentRulesSummary, items: storedRuleItems },
        newValue: { summary: rulesSummary, items: ruleItems, rulesFile: uploadedRulesFile },
        submittedByUserId: sessionUser.id,
      });
      if (!stage.ok) return { status: "error", message: stage.error };
      pendingGroups.push("rules");
    } else {
      const { error } = await admin.from("residence_profile_sections").upsert(
        { residence_id: residenceId, section_type: "rules", content: { summary: rulesSummary, items: ruleItems }, requires_admin_review: true },
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
    // Mismo tope que el editor de la galería (`uploadResidencePhoto`): sin contar las rechazadas.
    if (photos.length > 0) {
      const { count: currentPhotos } = await admin
        .from("files")
        .select("id", { count: "exact", head: true })
        .eq("related_entity_type", "residences")
        .eq("related_entity_id", residenceId)
        .eq("document_type", "residence_photo")
        .neq("status", "rejected");
      if ((currentPhotos ?? 0) + photos.length > MAX_RESIDENCE_PHOTOS)
        return { status: "error", message: `Llegaste al máximo de ${MAX_RESIDENCE_PHOTOS} fotos. Para sumar otra, primero pedile a Soporte que quite alguna.` };
    }
    for (const photo of photos) {
      if (photo.size > MAX_PHOTO_BYTES)
        return { status: "error", message: `"${photo.name}" supera los 5MB.` };
      if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type))
        return { status: "error", message: `"${photo.name}" debe ser JPG, PNG o WebP.` };
      // El MIME lo declara el cliente: el tipo y la extensión salen de la firma real del archivo.
      const photoBytes = new Uint8Array(await photo.arrayBuffer());
      const realType = sniffImageType(photoBytes);
      if (!realType) return { status: "error", message: `"${photo.name}" no es una imagen JPG, PNG o WebP válida.` };
      const path = `${residenceId}/${crypto.randomUUID()}.${imageExtension(realType)}`;
      const { error: uploadError } = await admin.storage
        .from("public-residence-media")
        .upload(path, photoBytes, { contentType: realType });
      if (uploadError) throw uploadError;
      const { data: insertedPhoto, error: photoInsertError } = await admin
        .from("files")
        .insert({
          owner_user_id: sessionUser.id,
          related_entity_type: "residences",
          related_entity_id: residenceId,
          bucket: "public-residence-media",
          storage_path: path,
          filename: safeFilename(photo.name),
          mime_type: realType,
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
        const { error } = await admin
          .from("room_types")
          .update({ is_active: false })
          .in("id", removed.map((t) => t.id))
          .eq("residence_id", residenceId);
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
      actorRole: accessCheck.actorRole,
      // En un reenvío tras cambios pedidos, el evento propio es `residence_profile_resubmitted` (más abajo, ya confirmada la transición).
      action: intent === "submit" && !wasNeedsChanges ? "residence_profile_submitted" : "residence_profile_saved_draft",
      entityType: "residences",
      entityId: residenceId,
      newValue: { services, common_areas: commonAreas, room_types_count: roomTypes.length, pending_review: pendingGroups },
    });

    if (intent === "submit") {
      // Update condicional + filas afectadas: no reabre si ya estaba en un estado posterior y evita la carrera con el admin.
      const { data: moved, error: statusError } = await admin
        .from("residences")
        .update({ status: "pending_verification" })
        .eq("id", residenceId)
        .in("status", [...SUBMITTABLE_RESIDENCE_STATUSES])
        .select("id");
      if (statusError) throw statusError;
      const transitioned = (moved ?? []).length > 0;

      if (wasNeedsChanges && !transitioned) {
        return {
          status: "error",
          message: "El estado de tu residencia cambió mientras editabas. Recargá la página para ver cómo sigue.",
        };
      }

      // `not_started` (primer envío) y `needs_changes` (reenvío) vuelven a `documents_pending`; el resto no se pisa.
      if (transitioned || !wasNeedsChanges) {
        const { error: verificationError } = await admin
          .from("residence_verifications")
          .update({ status: "documents_pending" })
          .eq("residence_id", residenceId)
          .in("status", [...VERIFICATION_STATUSES_RESET_ON_SUBMIT]);
        if (verificationError) {
          // Sin esto la residencia queda en `pending_verification` con la verificación en otro estado: se deshace el cambio.
          if (transitioned) {
            await admin
              .from("residences")
              .update({ status: residenceRow?.status as string })
              .eq("id", residenceId)
              .eq("status", "pending_verification");
          }
          throw verificationError;
        }
      }

      if (wasNeedsChanges && transitioned) {
        // El mensaje del admin se archiva en el audit log y se limpia de la fila (DR5). Tolera que la 0048 no esté aplicada.
        // Solo aplica al reenvío tras "pedir cambios": el vencimiento (DR7) no tiene mensaje.
        let previousMessage: string | null = null;
        const hadChangesMessage = previousResidenceStatus === "needs_changes";
        const { data: vRow, error: vErr } = hadChangesMessage
          ? await admin.from("residence_verifications").select("changes_requested_message").eq("residence_id", residenceId).maybeSingle()
          : { data: null, error: null };
        if (!vErr) previousMessage = (vRow?.changes_requested_message as string | null | undefined) ?? null;
        else if (!isMissingColumnError(vErr)) console.error("[residence-profile] read changes message failed:", vErr);

        if (!vErr && hadChangesMessage) {
          const { error: clearErr } = await admin
            .from("residence_verifications")
            .update({ changes_requested_message: null })
            .eq("residence_id", residenceId);
          if (clearErr && !isMissingColumnError(clearErr)) console.error("[residence-profile] clear changes message failed:", clearErr);
        }

        await createAuditLog(admin, {
          actorUserId: sessionUser.id,
          actorRole: accessCheck.actorRole,
          action: "residence_profile_resubmitted",
          entityType: "residences",
          entityId: residenceId,
          oldValue: { residence_status: previousResidenceStatus, changes_requested_message: previousMessage },
          newValue: { residence_status: "pending_verification", verification_status: "documents_pending", pending_review: pendingGroups },
          reasonText: previousMessage ?? undefined,
        });
        revalidatePath("/admin/verifications");
        revalidatePath("/admin/dashboard");
      }
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

  if (intent === "submit" && wasNeedsChanges) {
    return {
      status: "submitted",
      message: "¡Reenviado! El equipo de EstuRed va a revisar los cambios y te avisa por mail y en la campana.",
    };
  }

  return intent === "submit"
    ? { status: "submitted" }
    : { status: "saved", message: `Cambios guardados como borrador.${warningSuffix}` };
}
