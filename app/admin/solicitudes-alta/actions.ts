"use server";

import { revalidatePath } from "next/cache";
import { adminActorRole, getAdminSession } from "@/lib/auth/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/siteUrl";
import { changeSignupStatus, confirmSignupEmail, generateSignupInvite, saveSignupDetails } from "@/lib/residenceSignup/signupRequests";

export type AdminActionState = { status: "idle" | "ok" | "error"; message?: string };

const NO_ACCESS: AdminActionState = { status: "error", message: "No tenés permiso o el servicio no está disponible." };
const result = (r: { ok: true } | { ok: false; error: string }): AdminActionState => (r.ok ? { status: "ok" } : { status: "error", message: r.error });

/** Cambio de estado: `<button name="to" value="in_contact">` nativo. Rol admin y transición se validan en el servidor. */
export async function changeStatusAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const user = await getAdminSession();
  const admin = getSupabaseAdmin();
  if (!user || !admin) return NO_ACCESS;
  const r = await changeSignupStatus(admin, {
    actorUserId: user.id,
    actorRole: adminActorRole(user),
    id: String(formData.get("id") ?? ""),
    to: String(formData.get("to") ?? ""),
  });
  revalidatePath("/admin/solicitudes-alta");
  return result(r);
}

/** «Confirmé el email con la residencia»: requisito para generar la invitación. */
export async function confirmEmailAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const user = await getAdminSession();
  const admin = getSupabaseAdmin();
  if (!user || !admin) return NO_ACCESS;
  const r = await confirmSignupEmail(admin, { actorUserId: user.id, actorRole: adminActorRole(user), id: String(formData.get("id") ?? "") });
  revalidatePath("/admin/solicitudes-alta");
  return result(r);
}

/** `datetime-local` se interpreta como hora de Argentina (UTC-3, sin horario de verano). */
function parseLocalDateTime(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function saveDetailsAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const user = await getAdminSession();
  const admin = getSupabaseAdmin();
  if (!user || !admin) return NO_ACCESS;
  const visitRaw = String(formData.get("visit_at") ?? "");
  if (visitRaw && !parseLocalDateTime(visitRaw)) return { status: "error", message: "La fecha de la visita no es válida." };
  const r = await saveSignupDetails(admin, {
    actorUserId: user.id,
    actorRole: adminActorRole(user),
    id: String(formData.get("id") ?? ""),
    notes: String(formData.get("admin_notes") ?? "").trim(),
    email: String(formData.get("email") ?? ""),
    visitAt: parseLocalDateTime(visitRaw),
    draftResidenceId: String(formData.get("residence_id") ?? "").trim() || null,
  });
  revalidatePath("/admin/solicitudes-alta");
  return result(r);
}

export type InviteState = { status: "idle" | "error" | "ready"; message?: string; link?: string; expiresAt?: string };

/** Genera la invitación y devuelve el enlace UNA vez. No envía mail ni WhatsApp: la entrega la hace el admin a mano. */
export async function generateInviteAction(id: string, _prev: InviteState): Promise<InviteState> {
  const user = await getAdminSession();
  const admin = getSupabaseAdmin();
  if (!user || !admin) return { status: "error", message: "No tenés permiso o el servicio no está disponible." };
  const result = await generateSignupInvite(admin, { actorUserId: user.id, actorRole: adminActorRole(user), id });
  if (!result.ok) return { status: "error", message: result.error };
  return { status: "ready", link: `${SITE_URL}/register/residence/invitacion/${result.token}`, expiresAt: result.expiresAt };
}
