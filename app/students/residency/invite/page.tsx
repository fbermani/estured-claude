import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { otpRequiredFor, peekResidentInvitation, resolveInviteByToken } from "@/lib/residents/inviteVerification";
import { checkStudentCanLink } from "@/lib/residents/studentLinkGuards";
import { maskEmail } from "@/lib/residents/inviteRules";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { DeclineInvite, InviteCodeStep } from "@/components/residents/InviteSteps";
import { ActivateWithInviteButton } from "@/app/students/residency/ResidencyActions";

export const metadata: Metadata = { title: "Activar mi estadía", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

function Notice({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <Card className="mx-auto max-w-xl p-8 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-2 text-ink-faint">
        <Icon name={icon} className="text-3xl" />
      </span>
      <h1 className="mt-4 text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-2 text-sm text-ink-soft">{text}</p>
      <Link href="/students/residency" className="mt-6 inline-block text-sm font-semibold text-forest-700 hover:underline">
        Ir a Mi residencia
      </Link>
    </Card>
  );
}

/**
 * Activar la estadía con el enlace personal cuando la persona YA tiene cuenta (DR19). El enlace es la prueba: si llegó por mail alcanza
 * un clic; si llegó por WhatsApp (o la residencia no cargó mail) se verifica el mail de la cuenta con un código antes.
 */
export default async function ActivateInvitePage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite } = await searchParams;
  const sessionUser = await getSessionUser();
  const admin = getSupabaseAdmin();
  if (!invite || !sessionUser || !admin) {
    return <Notice icon="link_off" title="No pudimos abrir tu invitación" text="Abrí de nuevo el enlace que te mandó tu residencia." />;
  }

  const peek = await peekResidentInvitation(admin, invite);
  if (!peek.ok) return <Notice icon="link_off" title="No pudimos abrir tu invitación" text={peek.message} />;
  const resolved = await resolveInviteByToken(admin, invite);
  if (!resolved.ok) return <Notice icon="link_off" title="No pudimos abrir tu invitación" text={resolved.message} />;

  const { data: profile } = await admin.from("student_profiles").select("id").eq("user_id", sessionUser.id).maybeSingle();
  if (!profile) {
    return <Notice icon="person_off" title="Esta invitación es para una cuenta de estudiante" text="Ingresá con la cuenta de estudiante de la persona invitada." />;
  }

  const stayEmail = (resolved.stay.invite_email ?? "").toLowerCase();
  const needsCode = otpRequiredFor(resolved.invite.channel, !!stayEmail);
  if (stayEmail && stayEmail !== sessionUser.email.toLowerCase()) {
    return (
      <Notice
        icon="alternate_email"
        title="Esta invitación es para otro mail"
        text={`Es para ${maskEmail(stayEmail)}. Cerrá sesión e ingresá con ese mail, o pedile a ${peek.residenceName} que lo corrija.`}
      />
    );
  }

  const guard = await checkStudentCanLink(admin, (profile as { id: string }).id);
  const codeSessionVerified =
    !!resolved.invite.otp_verified_at && (resolved.invite.otp_email ?? "").toLowerCase() === sessionUser.email.toLowerCase();

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Card className="p-6 sm:p-8">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-forest-tint px-3 py-1 text-xs font-bold text-forest-700">
          <Icon name="how_to_reg" className="text-base" /> Invitación personal
        </p>
        <h1 className="mt-3 text-2xl font-bold text-ink">{peek.residenceName} te invitó a vincular tu estadía</h1>
        <p className="mt-2 text-sm text-ink-soft">Al activarla, figurás como residente. Tu perfil sigue privado: vos elegís qué se muestra.</p>

        <div className="mt-6">
          {!guard.ok ? (
            <p role="alert" className="rounded-field bg-info-bg px-3.5 py-3 text-sm leading-relaxed text-info-fg">
              {guard.error}
            </p>
          ) : needsCode && !codeSessionVerified ? (
            <InviteCodeStep token={invite} maskedEmail={maskEmail(sessionUser.email)} askEmail={false} useSessionEmail />
          ) : (
            <ActivateWithInviteButton token={invite} />
          )}
        </div>

        <div className="mt-6 border-t border-line pt-4">
          <DeclineInvite token={invite} />
        </div>
      </Card>
    </div>
  );
}
