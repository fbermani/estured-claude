"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { validatePasswordWithConfirmation } from "@/lib/auth/password";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createAuditLog } from "@/lib/audit";
import { notifyAdminsSafe } from "@/lib/notifications/notifyAdminsSafe";
import { createRateLimiter, clientKeyFromHeaders, clientIpFromHeaders } from "@/lib/receipts/verifyRateLimit";
import { saveResidencePrivateDetails } from "@/lib/residences/privateDetails";
import { BARRIO_OPTIONS } from "@/lib/residences/options";
import { INVITE_MESSAGES } from "@/lib/residenceSignup/rules";
import {
  claimSignupInvite,
  markSignupAccountDelivered,
  peekSignupInvite,
  releaseSignupInvite,
} from "@/lib/residenceSignup/signupRequests";
import { consentVersion } from "@/lib/legal/consentVersion";

export type RedeemState = { status: "idle" | "error"; message?: string };

const BARRIOS = new Set<string>(BARRIO_OPTIONS);
const attemptsByClient = createRateLimiter({ limit: 15, windowMs: 3_600_000 });
const attemptsByToken = createRateLimiter({ limit: 10, windowMs: 3_600_000 });
const sha = (v: string) => createHash("sha256").update(v).digest("hex");

function slugify(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

/**
 * Canje de la invitación de alta (DR22 E3). El email sale de la solicitud (no del formulario); la residencia elige su contraseña.
 * Un solo uso: el enlace se reclama de forma atómica ANTES de crear nada y se libera si algo falla. Si la solicitud ya tiene una ficha
 * borrador (`residence_id`, armada por el equipo) se vincula; si no, se crea un borrador mínimo y se sigue el onboarding existente.
 */
export async function redeemResidenceInvite(token: string, _prev: RedeemState, formData: FormData): Promise<RedeemState> {
  const headerStore = await headers();
  if (!attemptsByClient(sha(clientKeyFromHeaders(headerStore)))) {
    return { status: "error", message: "Hiciste muchos intentos. Probá de nuevo en un rato." };
  }
  const admin = getSupabaseAdmin();
  const supabase = await getSupabaseServer();
  if (!admin || !supabase) return { status: "error", message: "No está disponible en este momento. Probá más tarde." };

  const peeked = await peekSignupInvite(admin, token);
  if (peeked.state !== "valid" || !peeked.request) return { status: "error", message: INVITE_MESSAGES[peeked.state === "valid" ? "invalid" : peeked.state] };
  const request = peeked.request;
  // El freno por token cuenta solo los intentos sobre un enlace que existe y está vigente (antes de validar no se consume).
  if (!attemptsByToken(sha(String(token)))) return { status: "error", message: "Hiciste muchos intentos. Probá de nuevo en un rato." };

  if (formData.get("accept_terms") !== "on" || formData.get("accept_responsibility") !== "on") {
    return { status: "error", message: "Necesitamos que aceptes los términos y la responsabilidad como residencia." };
  }
  const passwordError = validatePasswordWithConfirmation(String(formData.get("password") ?? ""), String(formData.get("password_confirmation") ?? ""));
  if (passwordError) return { status: "error", message: passwordError };
  const password = String(formData.get("password") ?? "");
  const email = request.email.trim().toLowerCase();

  if (!(await claimSignupInvite(admin, request.id))) return { status: "error", message: INVITE_MESSAGES.used };

  const ip = clientIpFromHeaders(headerStore);
  const userAgent = headerStore.get("user-agent");
  let userId: string | null = null;
  let createdResidenceId: string | null = null;
  let redirectTo: string | null = null;

  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { responsible_name: request.contact_name },
    });
    if (createError || !created.user) {
      await releaseSignupInvite(admin, request.id, request.residence_id);
      if (createError?.code === "email_exists") {
        return { status: "error", message: "Ya existe una cuenta con el email de esta solicitud. Escribinos para resolverlo." };
      }
      console.error("[residence-invite] createUser failed:", createError?.message);
      return { status: "error", message: "No pudimos crear tu cuenta. Intentá de nuevo en unos minutos." };
    }
    userId = created.user.id;

    const { error: userError } = await admin.from("users").insert({ id: userId, email, phone: request.phone, primary_role: "residence_owner" });
    if (userError) throw userError;

    let residenceId = request.residence_id;
    if (residenceId) {
      // Ficha borrador armada por el equipo: se vincula, solo si nadie la tiene todavía.
      const { count } = await admin.from("residence_users").select("*", { count: "exact", head: true }).eq("residence_id", residenceId);
      if ((count ?? 0) > 0) throw new Error("draft residence already has users");
    } else {
      const { data: residence, error: residenceError } = await admin
        .from("residences")
        .insert({
          name: request.residence_name,
          slug: `${slugify(request.residence_name) || "residencia"}-${userId.slice(0, 6)}`,
          // Las solicitudes nuevas traen dirección y no barrio: el área pública la completa el equipo en la ficha.
          public_area: request.neighborhood && BARRIOS.has(request.neighborhood) ? request.neighborhood : null,
          city: "CABA",
          created_by: userId,
        })
        .select("id")
        .single();
      if (residenceError || !residence) throw residenceError;
      residenceId = residence.id as string;
      createdResidenceId = residenceId;
      const privateError = await saveResidencePrivateDetails(admin, residenceId, {
        responsible_name: request.contact_name,
        responsible_contact: request.phone,
      });
      if (privateError) throw new Error(privateError.message);
      const { error: verificationError } = await admin.from("residence_verifications").insert({ residence_id: residenceId, status: "not_started" });
      if (verificationError) throw verificationError;
    }

    const { error: roleError } = await admin.from("user_roles").insert({ user_id: userId, role: "residence_owner", scope_type: "residence", scope_id: residenceId });
    if (roleError) throw roleError;
    const { error: linkError } = await admin.from("residence_users").insert({ residence_id: residenceId, user_id: userId, role: "owner" });
    if (linkError) throw linkError;

    // LEG-013: la residencia acepta SUS condiciones (`/terms/residencias`) y la privacidad, con casilla propia; no los términos de estudiantes.
    const consentBase = { user_id: userId, ip_address: ip, user_agent: userAgent, related_entity_type: "residences", related_entity_id: residenceId };
    const { error: consentError } = await admin.from("consents").insert([
      { ...consentBase, consent_type: "residence_terms", version: consentVersion("residence_terms"), metadata: {} },
      { ...consentBase, consent_type: "privacy", version: consentVersion("privacy"), metadata: {} },
      { ...consentBase, consent_type: "residence_responsibility", version: consentVersion("residence_responsibility"), metadata: {} },
    ]);
    if (consentError) throw consentError;

    await createAuditLog(admin, {
      actorUserId: userId,
      actorRole: "residence_owner",
      action: "residence_registered",
      entityType: "residences",
      entityId: residenceId,
      newValue: { name: request.residence_name, via: "signup_invite", signup_request_id: request.id },
      ipAddress: ip,
      userAgent,
    });
    if (!(await markSignupAccountDelivered(admin, request.id, residenceId, userId))) throw new Error("could not mark request delivered");
    redirectTo = `/residence/${residenceId}/profile`;
  } catch (error) {
    console.error("[residence-invite] rollback, setup failed:", error);
    if (createdResidenceId) await admin.from("residences").delete().eq("id", createdResidenceId);
    if (userId) {
      // Con una ficha borrador preexistente las filas del usuario no se van en cascada con la residencia: se borran por user_id.
      for (const table of ["consents", "residence_users", "user_roles", "users"]) {
        const column = table === "users" ? "id" : "user_id";
        const { error: cleanupError } = await admin.from(table).delete().eq(column, userId);
        if (cleanupError) console.error(`[residence-invite] cleanup ${table} failed:`, cleanupError.message);
      }
      const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
      if (deleteError) console.error("[residence-invite] deleteUser failed:", deleteError.message);
    }
    await releaseSignupInvite(admin, request.id, request.residence_id);
    return { status: "error", message: "No pudimos completar la creación de tu cuenta. Intentá de nuevo en unos minutos." };
  }
  // Aviso a admin (texto neutro). Nunca lanza.
  const registeredResidenceId = createdResidenceId ?? request.residence_id;
  if (registeredResidenceId) {
    await notifyAdminsSafe(admin, {
      title: "Se registró una residencia nueva",
      body: "Una residencia canjeó su invitación y creó su cuenta.",
      entityType: "residences",
      entityId: registeredResidenceId,
      category: "admin_signups",
    });
  }
  // El login va fuera del try: la cuenta ya existe y el alta está cerrada; si falla, no se revierte nada.
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { status: "error", message: "Tu cuenta quedó creada. Ingresá desde «Iniciar sesión» con tu email y la contraseña que elegiste." };
  redirect(redirectTo ?? "/login");
}
