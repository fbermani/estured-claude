"use server";

import { headers } from "next/headers";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hashIp } from "@/lib/waitlist/hashIp";
import { submitResidenceQuestion } from "@/lib/faq/submitResidenceQuestion";
import { minorHoldError } from "@/lib/students/minorHold";

export type AskQuestionState = { status: "idle" | "sent" | "error"; message?: string };

/**
 * IP del visitante. En Vercel `x-vercel-forwarded-for` y `x-real-ip` los pone la
 * plataforma (el cliente no los puede falsear); `x-forwarded-for` va último
 * porque su primer valor lo puede mandar el propio visitante. Sin ninguno
 * (dev local) devuelve null y `submitResidenceQuestion` aplica un límite global.
 */
async function getClientIp(): Promise<string | null> {
  const headerList = await headers();
  const trusted = headerList.get("x-vercel-forwarded-for") ?? headerList.get("x-real-ip");
  if (trusted) return trusted.split(",")[0].trim() || null;
  const forwardedFor = headerList.get("x-forwarded-for");
  return forwardedFor ? forwardedFor.split(",")[0].trim() || null : null;
}

/**
 * Pregunta libre desde la ficha pública (D9 / H12). No exige sesión ni pide
 * datos extra; valida y limita en el servidor (`submitResidenceQuestion`).
 * La residencia la responde cuando puede: no hay respuesta automática.
 */
export async function askResidenceQuestionAction(
  residenceId: string,
  _prev: AskQuestionState,
  formData: FormData,
): Promise<AskQuestionState> {
  // Honeypot: campo invisible para humanos; si viene completo, es un bot.
  if (String(formData.get("website") ?? "") !== "") return { status: "sent" };

  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá de nuevo más tarde." };

  const sessionUser = await getSessionUser();
  // DR65 (e): con sesión, un menor en espera no pregunta. Sin sesión la pregunta es anónima y no hay cuenta que revisar.
  if (sessionUser) {
    const onHold = await minorHoldError(admin, sessionUser.id);
    if (onHold) return { status: "error", message: onHold };
  }
  const ip = await getClientIp();

  const result = await submitResidenceQuestion(admin, {
    residenceId,
    question: formData.get("question"),
    userId: sessionUser?.id ?? null,
    ipHash: ip ? await hashIp(ip) : null,
  });
  if (!result.ok) return { status: "error", message: result.error };
  return { status: "sent" };
}
