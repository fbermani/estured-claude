"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { createAuditLog } from "@/lib/audit";
import { LATAM_COUNTRY_NAMES, FLAG_BY_COUNTRY } from "@/lib/data/latamCountries";
import { UNIVERSITY_NAMES } from "@/lib/data/buenosAiresUniversities";
import {
  INTEREST_OPTIONS,
  HABIT_OPTIONS,
  CAREER_OPTIONS,
  UNIVERSITY_OTHER_VALUE,
  CAREER_OTHER_VALUE,
  BIO_MAX_LENGTH,
} from "@/lib/students/profileOptions";

export type UpdateProfileState = { status: "idle" | "error" | "saved"; message?: string };
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
  const nationality = LATAM_COUNTRY_NAMES.includes(rawNationality) ? rawNationality : "";
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
  const profileVisible = formData.get("profile_visible") === "on";

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

  const { error: visibilityError } = await admin
    .from("student_visibility_settings")
    .update({ is_individual_profile_visible: profileVisible })
    .eq("student_profile_id", profile.id);
  if (visibilityError) {
    console.error("[students/profile] visibility update failed:", visibilityError);
    return { status: "error", message: "No pudimos guardar los cambios. Intentá de nuevo." };
  }

  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headerStore.get("user-agent");
  await admin.from("consents").insert({
    user_id: sessionUser.id,
    consent_type: "student_visibility",
    version: CONSENT_VERSION,
    ip_address: ip,
    user_agent: userAgent,
    metadata: { is_individual_profile_visible: profileVisible },
  });

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
      profile_visible: profileVisible,
    },
    ipAddress: ip,
    userAgent,
  });

  revalidatePath("/students/profile");
  revalidatePath("/students/dashboard");
  return { status: "saved" };
}

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/**
 * Subida de documentos propios del estudiante (DNI, comprobante de
 * inscripción) — mismo patrón que `uploadResidencePaymentProof`, bucket
 * privado propio (`student-documents`). `document_type` ya existía en
 * el enum desde la migración 0003 (`student_identity`,
 * `student_academic_proof`) sin ninguna pantalla que lo usara todavía.
 */
export async function uploadStudentDocument(
  documentType: "student_identity" | "student_academic_proof",
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

  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
  const path = `${profile.id}/${documentType}-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await admin.storage
    .from("student-documents")
    .upload(path, file, { contentType: file.type });
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
    filename: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    visibility: "private",
    document_type: documentType,
    status: "uploaded",
    uploaded_by_user_id: sessionUser.id,
  });
  if (fileError) {
    console.error("[students/profile] file row failed:", fileError);
    return { status: "error", message: "No pudimos registrar el archivo. Intentá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: "student",
    action: "student_document_uploaded",
    entityType: "student_profiles",
    entityId: profile.id,
    newValue: { document_type: documentType },
  });

  revalidatePath("/students/profile");
  revalidatePath("/students/dashboard");
  return { status: "saved" };
}
