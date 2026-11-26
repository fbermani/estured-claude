import type { Metadata } from "next";
import { PreaperturaStage } from "@/components/preapertura/PreaperturaStage";
import { HomeBackdrop } from "@/components/preapertura/HomeBackdrop";
import { UrgencyPanel } from "@/components/preapertura/UrgencyPanel";
import { Step1Form } from "@/components/preapertura/Step1Form";
import { StubDialog } from "@/components/preapertura/StubDialog";
import { INVITE_MESSAGES, resolveInvitation } from "@/lib/preapertura/invitations";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSafeUser } from "@/lib/supabase/safe-get-user";

export const metadata: Metadata = {
  title: "Creá tu cuenta",
  robots: { index: false, follow: false },
  // El link de invitación lleva un token: que no salga del sitio en el encabezado Referer.
  referrer: "no-referrer",
};

// Registro del estudiante en la preapertura. Depende de la sesión: siempre dinámica.
export const dynamic = "force-dynamic";

export default async function PreregistroPage({ searchParams }: { searchParams: Promise<{ invitacion?: string | string[] }> }) {
  // Con sesión iniciada no hay nada que registrar (el formulario muestra un aviso; ver `Step1Form`).
  const supabase = await getSupabaseServer();
  const loggedIn = Boolean(supabase && (await getSafeUser(supabase)));

  const params = await searchParams;
  const rawToken = Array.isArray(params.invitacion) ? params.invitacion[0] : params.invitacion;

  let invitation: { token: string; email: string } | null = null;
  // Con sesión no se resuelve la invitación: al crear la cuenta con este mismo link, la pantalla se renderiza de nuevo con el link ya canjeado
  // y mostraría «ya se usó» antes de que el cliente siga al paso 2.
  if (rawToken && !loggedIn) {
    const admin = getSupabaseAdmin();
    const resolved = admin ? await resolveInvitation(admin, rawToken) : ({ ok: false, reason: "unavailable" } as const);
    if (!resolved.ok) {
      return (
        <StubDialog
          title="Este link no se puede usar"
          text={INVITE_MESSAGES[resolved.reason]}
        />
      );
    }
    invitation = { token: rawToken, email: resolved.invitation.email };
  }

  return (
    <PreaperturaStage preview={<HomeBackdrop />} labelledBy="pre-signup-title" size="wide" fullOnMobile initialFocus={invitation ? "#pre-password" : "#pre-email"}>
      <div className="grid grid-cols-[minmax(0,1fr)] p-2 pb-0 @min-[860px]:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] @min-[860px]:p-2.5">
        <UrgencyPanel />
        <Step1Form invitation={invitation} loggedIn={loggedIn} />
      </div>
    </PreaperturaStage>
  );
}
