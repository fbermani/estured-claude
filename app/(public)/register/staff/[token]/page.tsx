import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { peekTeamInvitation } from "@/lib/team/teamInvitations";
import { INVALID_INVITATION_MESSAGE } from "@/lib/team/teamRules";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import {
  AcceptWithPasswordForm,
  AcceptWithSessionForm,
} from "@/app/(public)/register/staff/[token]/AcceptInvitationForms";

// El enlace lleva un token de un solo uso: no se indexa ni se manda en el Referer a otros sitios.
export const metadata: Metadata = {
  title: "Invitación al equipo",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

/**
 * Aceptar la invitación al equipo de una residencia (DR10, docs/08 §7.20). Público: lo único que lo protege es el token del enlace.
 * Un enlace inválido, vencido, ya usado o cancelado muestra siempre el mismo mensaje.
 */
export default async function AcceptStaffInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = getSupabaseAdmin();
  const invitation = admin ? await peekTeamInvitation(admin, token) : ({ state: "invalid" } as const);

  if (invitation.state !== "valid") {
    return (
      <div className="mx-auto max-w-xl px-4 py-14 sm:py-20">
        <Card className="p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-2 text-ink-faint">
            <Icon name="link_off" className="text-3xl" />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-ink">No pudimos abrir la invitación</h1>
          <p className="mt-2 text-sm text-ink-soft">{INVALID_INVITATION_MESSAGE}</p>
          <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-forest-700 hover:underline">
            Ir a iniciar sesión
          </Link>
        </Card>
      </div>
    );
  }

  const sessionUser = await getSessionUser();
  const hasMatchingSession = !!sessionUser && sessionUser.email.trim().toLowerCase() === invitation.email;

  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:py-20">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-ink">Te invitaron a sumarte al equipo</h1>
        <p className="mt-2 text-sm text-ink-soft">
          El dueño de <span className="font-semibold text-ink">{invitation.residenceName}</span> te invitó a trabajar en la residencia desde EstuRed, con acceso de staff:
          solicitudes, habitaciones, disponibilidad, residentes y más. El perfil de la residencia lo gestiona el dueño.
        </p>
      </div>
      <Card className="mt-8 p-6 sm:p-8">
        {hasMatchingSession ? (
          <AcceptWithSessionForm token={token} />
        ) : (
          <AcceptWithPasswordForm token={token} email={invitation.email} />
        )}
      </Card>
      <p className="mt-6 text-center text-xs text-ink-faint">El enlace es personal y se puede usar una sola vez.</p>
    </div>
  );
}
