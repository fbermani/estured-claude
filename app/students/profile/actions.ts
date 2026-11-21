"use server";

import { clientIpFromHeaders } from "@/lib/receipts/verifyRateLimit";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { createAuditLog } from "@/lib/audit";
import { COUNTRY_NAMES, FLAG_BY_COUNTRY } from "@/lib/data/latamCountries";
import { UNIVERSITY_NAMES } from "@/lib/data/buenosAiresUniversities";
import { isMinorByBirthDate } from "@/lib/students/isMinorByBirthDate";
import { validateIdentityDocument } from "@/lib/students/identityDocument";
import { MAX_OTHER_STAY_DOCUMENT_LENGTH, sanitizeStayDocumentLabel } from "@/lib/residences/stayDocuments";
import {
  VISIBILITY_FLAG_COLUMNS,
  allHidden,
  resolveVisibilityUpdate,
  type VisibilityValues,
} from "@/lib/students/communityVisibilitySettings";
import { extensionForMime, resolveDocumentType, toTypedBlob } from "@/lib/files/sniffFile";
import {
  INTEREST_OPTIONS,
  HABIT_OPTIONS,
  CAREER_OPTIONS,
  UNIVERSITY_OTHER_VALUE,
  CAREER_OTHER_VALUE,
  BIO_MAX_LENGTH,
} from "@/lib/students/profileOptions";
import { safeFilename } from "@/lib/files/safeFilename";
import { consumeRateLimit } from "@/lib/security/rateLimit";
import {
  STUDENT_DOCUMENT_QUOTA_MESSAGE,
  STUDENT_DOCUMENT_UPLOADS_PER_HOUR,
  exceedsDocumentQuota,
  studentDocumentUsage,
} from "@/lib/students/documentQuota";

export type UpdateProfileState = { status: "idle" | "error" | "saved"; message?: string };
export type IdentityDocumentState = { status: "idle" | "error" | "saved"; message?: string };
export type CommunityVisibilityState = { status: "idle" | "error" | "saved"; message?: string };
export type UploadDocumentState = { status: "idle" | "error" | "saved"; message?: string };

const CONSENT_VERSION = "v0.1-borrador";

/** Paso 2 del alta (Ciclo 35): completar lo que el registro dejó afuera a propósito. */
export async function updateStudentProfileDetails(
  _prev: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };

  // Nacionalidad y universidad son selects (no texto libre) desde
  // Ciclo 36 — igual se revalida server-side contra el whitelist, no
  // solo confiar en que el <select> del cliente no fue manipulado.
  const rawNationality = String(formData.get("nationality") ?? "").trim();
  const nationality = COUNTRY_NAMES.includes(rawNationality) ? rawNationality : "";
  const countryFlag = nationality ? (FLAG_BY_COUNTRY[nationality] ?? null) : null;

  const universitySelect = String(formData.get("study_institution_select") ?? "").trim();
  const universityOther = String(formData.get("study_institution_other") ?? "").trim();
  const institution =
    universitySelect === UNIVERSITY_OTHER_VALUE
      ? universityOther
      : UNIVERSITY_NAMES.includes(universitySelect)
        ? universitySelect
        : "";

  const careerSelect = String(formData.get("career_select") ?? "").trim();
  const careerOther = String(formData.get("career_other") ?? "").trim();
  const career =
    careerSelect === CAREER_OTHER_VALUE
      ? careerOther
      : CAREER_OPTIONS.includes(careerSelect as (typeof CAREER_OPTIONS)[number])
        ? careerSelect
        : "";

  const originCity = String(formData.get("origin_city") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const interests = String(formData.get("interests") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => INTEREST_OPTIONS.includes(v as (typeof INTEREST_OPTIONS)[number]));
  const habits = String(formData.get("habits") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => HABIT_OPTIONS.includes(v as (typeof HABIT_OPTIONS)[number]));

  if (institution.length > 160) return { status: "error", message: "Ese campo es demasiado largo." };
  if (career.length > 100) return { status: "error", message: "El nombre de la carrera es demasiado largo." };
  if (originCity.length > 120) return { status: "error", message: "La ciudad de origen es demasiado larga." };
  if (bio.length > BIO_MAX_LENGTH) return { status: "error", message: "Tu descripción sobre vos es demasiado larga." };

  const { data: profile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", sessionUser.id)
    .maybeSingle();
  if (!profile) return { status: "error", message: "No encontramos tu perfil de estudiante." };

  const { error: profileError } = await admin
    .from("student_profiles")
    .update({
      nationality: nationality || null,
      country_flag: countryFlag,
      study_institution_private: institution || null,
      career: career || null,
      origin_city: originCity || null,
      bio: bio || null,
      interests: { items: interests },
      habits: { items: habits },
    })
    .eq("id", profile.id);
  if (profileError) {
    console.error("[students/profile] update failed:", profileError);
    return { status: "error", message: "No pudimos guardar los cambios. Intentá de nuevo." };
  }

  // H04: guardar el perfil NO toca la visibilidad en la comunidad. Eso se
  // decide aparte, a conciencia, con `updateCommunityVisibility`.
  const headerStore = await headers();
  const ip = clientIpFromHeaders(headerStore);
  const userAgent = headerStore.get("user-agent");

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: "student",
    action: "student_profile_updated",
    entityType: "student_profiles",
    entityId: profile.id,
    newValue: {
      nationality: nationality || null,
      has_institution: !!institution,
      has_career: !!career,
      has_bio: !!bio,
      interests_count: interests.length,
      habits_count: habits.length,
    },
    ipAddress: ip,
    userAgent,
  });

  revalidatePath("/students/profile");
  revalidatePath("/students/dashboard");
  return { status: "saved" };
}

/**
 * DR58 — el estudiante carga el tipo y número de su documento. Validación y normalización server-side; el número se
 * guarda en `student_identity_documents` (solo service role) y NUNCA va a la auditoría.
 */
export async function saveIdentityDocument(
  _prev: IdentityDocumentState,
  formData: FormData,
): Promise<IdentityDocumentState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };

  const parsed = validateIdentityDocument(formData.get("document_type"), formData.get("document_number"));
  if (!parsed.ok) return { status: "error", message: parsed.message };

  const { data: profile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", sessionUser.id)
    .maybeSingle();
  if (!profile) return { status: "error", message: "No encontramos tu perfil de estudiante." };

  const { error } = await admin
    .from("student_identity_documents")
    .upsert({ student_profile_id: profile.id, document_type: parsed.type, document_number: parsed.number }, { onConflict: "student_profile_id" });
  if (error) {
    console.error("[students/profile] identity document failed:", error.code);
    // 42P01 / PGRST205: tabla inexistente (migración 0100 sin aplicar).
    const missing = error.code === "42P01" || error.code === "PGRST205";
    return { status: "error", message: missing ? "Todavía no podemos guardar este dato. Probá más tarde." : "No pudimos guardar el documento. Intentá de nuevo." };
  }

  const headerStore = await headers();
  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: "student",
    action: "student_identity_document_saved",
    entityType: "student_profiles",
    entityId: profile.id,
    newValue: { document_type: parsed.type },
    ipAddress: clientIpFromHeaders(headerStore),
    userAgent: headerStore.get("user-agent"),
  });

  revalidatePath("/students/profile");
  return { status: "saved" };
}

/**
 * H04 (Ciclo 49) — control del estudiante sobre su perfil en la comunidad
 * (docs/00 §18, docs/10 §7.6 y §9.2). Interruptor maestro + 4 grupos de
 * datos. La regla de menores se aplica ACÁ, server-side: el cliente solo la
 * refleja deshabilitando los controles.
 */
export async function updateCommunityVisibility(
  _prev: CommunityVisibilityState,
  formData: FormData,
): Promise<CommunityVisibilityState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };

  const { data: profile } = await admin
    .from("student_profiles")
    .select("id, birth_date")
    .eq("user_id", sessionUser.id)
    .maybeSingle();
  if (!profile) return { status: "error", message: "No encontramos tu perfil de estudiante." };

  const { data: currentRow } = await admin
    .from("student_visibility_settings")
    .select(`is_individual_profile_visible, ${VISIBILITY_FLAG_COLUMNS.join(", ")}`)
    .eq("student_profile_id", profile.id)
    .maybeSingle();
  const current = (currentRow as unknown as VisibilityValues | null) ?? null;

  const checked = (name: string) => formData.get(name) === "on";
  const input: VisibilityValues = {
    ...allHidden(),
    is_individual_profile_visible: checked("community_master"),
    show_age_to_registered: checked("show_age"),
    show_nationality_to_registered: checked("show_nationality"),
    show_career_to_registered: checked("show_career_origin"),
    show_origin_city_to_registered: checked("show_career_origin"),
    show_habits_to_registered: checked("show_habits_interests"),
    show_interests_to_registered: checked("show_habits_interests"),
  };

  const resolved = resolveVisibilityUpdate({ isMinor: isMinorByBirthDate(profile.birth_date), input, current });
  if (!resolved.ok) return { status: "error", message: resolved.error };

  const { error } = await admin
    .from("student_visibility_settings")
    .upsert({ student_profile_id: profile.id, ...resolved.values }, { onConflict: "student_profile_id" });
  if (error) {
    console.error("[students/profile] visibility update failed:", error);
    return { status: "error", message: "No pudimos guardar los cambios. Intentá de nuevo." };
  }

  const headerStore = await headers();
  const ip = clientIpFromHeaders(headerStore);
  const userAgent = headerStore.get("user-agent");

  // El consentimiento se versiona solo cuando el estudiante lo ACTIVA. Si no
  // se puede registrar, la visibilidad no queda activada: se revierte a lo
  // que había. Apagar no genera consentimiento: la revocación queda en el
  // audit log (docs/10 §7.6 pide auditoría de cambios, no un registro de
  // consentimiento).
  const wasVisible = current?.is_individual_profile_visible === true;
  if (resolved.values.is_individual_profile_visible && !wasVisible) {
    const { error: consentError } = await admin.from("consents").insert({
      user_id: sessionUser.id,
      consent_type: "student_visibility",
      version: CONSENT_VERSION,
      ip_address: ip,
      user_agent: userAgent,
      metadata: { is_individual_profile_visible: true, source: "profile" },
    });
    if (consentError) {
      console.error("[students/profile] visibility consent insert failed:", consentError);
      const { error: revertError } = await admin
        .from("student_visibility_settings")
        .upsert({ student_profile_id: profile.id, ...(current ?? allHidden()) }, { onConflict: "student_profile_id" });
      if (revertError) console.error("[students/profile] visibility revert failed:", revertError);
      return {
        status: "error",
        message: "No pudimos registrar tu consentimiento, así que tu perfil sigue sin aparecer. Intentá de nuevo.",
      };
    }
  }

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: "student",
    action: "student_visibility_updated",
    entityType: "student_visibility_settings",
    entityId: profile.id,
    oldValue: current,
    newValue: resolved.values,
    ipAddress: ip,
    userAgent,
  });

  revalidatePath("/students/profile");
  revalidatePath("/students/residency");
  return { status: "saved", message: resolved.values.is_individual_profile_visible ? "Listo, tu perfil ya aparece en la comunidad." : "Listo, tu perfil no aparece en la comunidad." };
}

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/**
 * Subida de documentos propios del estudiante (DNI, comprobante de
 * inscripción, otros documentos que pida una residencia puntual) —
 * mismo patrón que `studentPaymentProof.ts` (comprobante de «Ya pagué»), bucket privado
 * propio (`student-documents`). `document_type` ya existía en el enum
 * desde la migración 0003 (`student_identity`, `student_academic_proof`,
 * `other`) sin ninguna pantalla que lo usara todavía — a diferencia de
 * los otros dos, `"other"` no tiene "slot único": `files` no tiene
 * constraint que limite a 1 fila por `(student, document_type)`, así
 * que subir varias veces con `documentType: "other"` ya funciona sin
 * cambios de esquema (Ciclo 37).
 *
 * DR38: también acepta `student_criminal_record` (antecedentes penales, migración 0077) y, con `other`, un campo opcional
 * `requirement_label` en el formulario: el nombre del documento «Otro» que pide una residencia, para reconocerlo después.
 */
export async function uploadStudentDocument(
  documentType: "student_identity" | "student_academic_proof" | "student_criminal_record" | "other",
  _prev: UploadDocumentState,
  formData: FormData,
): Promise<UploadDocumentState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };

  const { data: profile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", sessionUser.id)
    .maybeSingle();
  if (!profile) return { status: "error", message: "No encontramos tu perfil de estudiante." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Adjuntá un archivo." };
  }
  if (file.size > MAX_DOCUMENT_BYTES) return { status: "error", message: "El archivo no puede superar los 10MB." };
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
    return { status: "error", message: "El archivo debe ser PDF, JPG, PNG o WebP." };
  }
  const realType = await resolveDocumentType(file);
  if (!realType) {
    return { status: "error", message: "El archivo debe ser PDF, JPG, PNG o WebP." };
  }

  // DR38: la etiqueta del requisito «Otro» se sanitiza y acota acá; en el resto de los tipos se ignora.
  let requirementLabel: string | null = null;
  if (documentType === "other") {
    const label = sanitizeStayDocumentLabel(formData.get("requirement_label"));
    if (label.length > MAX_OTHER_STAY_DOCUMENT_LENGTH) return { status: "error", message: "El nombre del documento es demasiado largo." };
    requirementLabel = label || null;
  }

  // SEG14-03: freno persistente por usuario y cuota acumulada (falla cerrado si no se puede medir el uso).
  const rate = await consumeRateLimit({ bucket: "student_document_upload", key: sessionUser.id, windowSeconds: 3_600, max: STUDENT_DOCUMENT_UPLOADS_PER_HOUR });
  if (!rate.ok) return { status: "error", message: "Subiste varios documentos seguidos. Probá de nuevo en un rato." };
  const usageBefore = await studentDocumentUsage(admin, profile.id);
  if (!usageBefore || exceedsDocumentQuota(usageBefore, file.size)) return { status: "error", message: STUDENT_DOCUMENT_QUOTA_MESSAGE };

  const ext = extensionForMime(realType);
  const path = `${profile.id}/${documentType}-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await admin.storage
    .from("student-documents")
    .upload(path, await toTypedBlob(file, realType), { contentType: realType });
  if (uploadError) {
    console.error("[students/profile] upload failed:", uploadError);
    return { status: "error", message: "No pudimos subir el archivo. Intentá de nuevo." };
  }

  const { error: fileError } = await admin.from("files").insert({
    owner_user_id: sessionUser.id,
    related_entity_type: "student_profiles",
    related_entity_id: profile.id,
    bucket: "student-documents",
    storage_path: path,
    filename: safeFilename(file.name),
    mime_type: realType,
    size_bytes: file.size,
    visibility: "private",
    document_type: documentType,
    // Solo se manda cuando hay etiqueta: así, sin la migración 0077, las subidas de siempre no cambian.
    ...(requirementLabel ? { requirement_label: requirementLabel } : {}),
    status: "uploaded",
    uploaded_by_user_id: sessionUser.id,
  });
  if (fileError) {
    console.error("[students/profile] file row failed:", fileError);
    // No dejar un archivo huérfano en el bucket si no se pudo registrar.
    await admin.storage.from("student-documents").remove([path]);
    return { status: "error", message: "No pudimos registrar el archivo. Intentá de nuevo." };
  }

  // Recuento posterior: si dos subidas concurrentes pasaron el chequeo previo, la que deja el total sobre la cuota se deshace.
  const usageAfter = await studentDocumentUsage(admin, profile.id);
  if (!usageAfter || exceedsDocumentQuota(usageAfter)) {
    await admin.from("files").delete().eq("bucket", "student-documents").eq("storage_path", path);
    await admin.storage.from("student-documents").remove([path]);
    return { status: "error", message: STUDENT_DOCUMENT_QUOTA_MESSAGE };
  }

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: "student",
    action: "student_document_uploaded",
    entityType: "student_profiles",
    entityId: profile.id,
    newValue: { document_type: documentType, ...(requirementLabel ? { requirement_label: requirementLabel } : {}) },
  });

  revalidatePath("/students/profile");
  revalidatePath("/students/dashboard");
  revalidatePath("/students/residency");
  return { status: "saved" };
}
