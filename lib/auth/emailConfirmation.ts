import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailButton, emailParagraph, renderEmail } from "@/lib/email/layout";
import { sanitizeAddress, sendEmail } from "@/lib/email/sendEmail";
import { getAppUrl } from "@/lib/appUrl";

/**
 * DR65 (d) (LEG-025): confirmación de email en el registro abierto (estudiante sin invitación y familiar). Solo se exige con dominio
 * verificado (`EMAIL_FROM` válido): en staging Resend está en sandbox y no entrega a terceros (decisión del dueño 2026-11-25).
 * La cuenta se crea sin confirmar; el enlace (token de un solo uso de Supabase) la confirma y abre la sesión en `/auth/confirmar`.
 */
export function isSignupEmailConfirmationRequired(): boolean {
  return sanitizeAddress(process.env.EMAIL_FROM) !== null;
}

export const CONFIRM_EMAIL_PATH = "/auth/confirmar";

/** Manda (o reenvía) el enlace de confirmación. Nunca lanza; `false` si no salió. */
export async function sendSignupConfirmationEmail(admin: SupabaseClient, email: string): Promise<boolean> {
  try {
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) {
      console.error("[email-confirm] generateLink failed:", error?.code ?? "sin token");
      return false;
    }
    const link = `${getAppUrl()}${CONFIRM_EMAIL_PATH}?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`;
    const html = renderEmail({
      preheader: "Un paso para activar tu cuenta.",
      title: "Confirmá tu email",
      hero: "cuenta",
      bodyHtml: [emailParagraph("Confirmá tu email para activar tu cuenta."), emailButton(link, "Confirmar mi email")].join("\n"),
      footerNote: "El enlace sirve una sola vez. Si no creaste una cuenta en EstuRed, ignorá este email.",
    });
    return await sendEmail({ to: email, subject: "Confirmá tu email en EstuRed", html });
  } catch (e) {
    console.error("[email-confirm] failed:", e instanceof Error ? e.message : e);
    return false;
  }
}
