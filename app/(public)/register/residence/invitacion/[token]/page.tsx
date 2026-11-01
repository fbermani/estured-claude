import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { peekSignupInvite } from "@/lib/residenceSignup/signupRequests";
import { INVITE_MESSAGES } from "@/lib/residenceSignup/rules";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { RedeemInviteForm } from "@/app/(public)/register/residence/invitacion/[token]/RedeemInviteForm";

// Enlace personal de un solo uso: no se indexa ni se manda en el Referer.
export const metadata: Metadata = { title: "Crear la cuenta de tu residencia", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

/** Canje de la invitación de alta (DR22 E3). Público: lo único que lo protege es el token del enlace. */
export default async function ResidenceInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = getSupabaseAdmin();
  const peeked = admin ? await peekSignupInvite(admin, token) : ({ state: "unavailable" } as const);

  if (peeked.state !== "valid" || !("request" in peeked) || !peeked.request) {
    const message = peeked.state === "unavailable" ? "No está disponible en este momento. Probá más tarde." : INVITE_MESSAGES[peeked.state === "valid" ? "invalid" : peeked.state];
    return (
      <div className="mx-auto max-w-xl px-4 py-14 sm:py-20">
        <Card className="p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-2 text-ink-faint">
            <Icon name="link_off" className="text-3xl" />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-ink">No pudimos abrir el enlace</h1>
          <p className="mt-2 text-sm text-ink-soft">{message}</p>
          <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-forest-700 hover:underline">Ir a iniciar sesión</Link>
        </Card>
      </div>
    );
  }

  const request = peeked.request;
  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:py-20">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-ink">Creá la cuenta de tu residencia</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Hola, {request.contact_name}. Elegí tu contraseña para entrar a EstuRed con <span className="font-semibold text-ink">{request.residence_name}</span> y completar el perfil.
        </p>
      </div>
      <Card className="mt-8 p-6 sm:p-8">
        <RedeemInviteForm token={token} email={request.email} />
      </Card>
      <p className="mt-6 text-center text-xs text-ink-faint">El enlace es personal y se puede usar una sola vez.</p>
    </div>
  );
}
