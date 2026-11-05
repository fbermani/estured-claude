import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { safeInternalPath } from "@/lib/auth/safeNext";
import { getSessionUser, roleHome } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { peekResidentInvitation } from "@/lib/residents/inviteVerification";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { DeclineInvite, InviteCodeStep } from "@/components/residents/InviteSteps";
import { listActiveResidencesForPicker } from "@/lib/residents/activeResidences";
import { RegisterStudentForm } from "@/app/(public)/register/student/RegisterStudentForm";

// El enlace personal lleva un token de un solo uso: no se indexa ni viaja en el Referer.
export const metadata: Metadata = { title: "Crear cuenta de estudiante", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function RegisterStudentPage({ searchParams }: { searchParams: Promise<{ invite?: string; next?: string }> }) {
  const { invite, next: nextRaw } = await searchParams;
  const sessionUser = await getSessionUser();

  if (invite) {
    // Con sesión se activa con un clic en la pantalla de «Mi residencia»; sin sesión se registra (o inicia sesión) acá.
    if (sessionUser) redirect(`/students/residency/invite?invite=${encodeURIComponent(invite)}`);
    return <InviteRegistration token={invite} />;
  }

  if (sessionUser) redirect(roleHome(sessionUser));
  const residences = await listActiveResidencesForPicker();
  const next = safeInternalPath(nextRaw) ?? undefined;
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:py-20">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-ink">
          Crear cuenta de estudiante
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Tu apellido, fecha de nacimiento y universidad son privados: nunca se
          muestran públicamente.
        </p>
      </div>
      <div className="mt-8">
        <RegisterStudentForm residences={residences} next={next} />
      </div>
      <p className="mt-6 text-center text-sm text-ink-soft">
        ¿Ya tenés cuenta?{" "}
        <Link
          href={loginHref}
          className="font-semibold text-forest-700 hover:text-forest-700"
        >
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}

async function InviteRegistration({ token }: { token: string }) {
  const admin = getSupabaseAdmin();
  const peek = admin ? await peekResidentInvitation(admin, token) : ({ ok: false, message: "No está disponible en este momento. Probá más tarde." } as const);

  if (!peek.ok) {
    return (
      <div className="mx-auto max-w-xl px-4 py-14 sm:py-20">
        <Card className="p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-2 text-ink-faint">
            <Icon name="link_off" className="text-3xl" />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-ink">No pudimos abrir tu invitación</h1>
          <p className="mt-2 text-sm text-ink-soft">{peek.message}</p>
          <Link href="/register/student" className="mt-6 inline-block text-sm font-semibold text-forest-700 hover:underline">
            Crear una cuenta sin invitación
          </Link>
        </Card>
      </div>
    );
  }

  const needsCode = peek.otpRequired && !peek.otpVerified;
  const maskedEmail = peek.verifiedMaskedEmail ?? peek.maskedEmail ?? "";
  const loginHref = `/login?next=${encodeURIComponent(`/students/residency/invite?invite=${token}`)}`;

  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:py-20">
      <div className="text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-forest-tint px-3 py-1 text-xs font-bold text-forest-700">
          <Icon name="how_to_reg" className="text-base" /> Invitación personal
        </p>
        <h1 className="mt-3 text-3xl font-bold text-ink">
          {peek.firstName ? `${peek.firstName}, ` : ""}
          {peek.residenceName} te invitó a EstuRed
        </h1>
        <p className="mt-2 text-sm text-ink-soft">Creá tu cuenta y tu estadía queda vinculada. Tu apellido, fecha de nacimiento y universidad son privados.</p>
      </div>

      <div className="mt-8">
        {needsCode ? (
          <Card className="p-6 sm:p-8">
            <InviteCodeStep token={token} maskedEmail={peek.maskedEmail} askEmail={!peek.maskedEmail} />
          </Card>
        ) : (
          <RegisterStudentForm invite={{ token, maskedEmail }} />
        )}
      </div>

      <div className="mt-6 space-y-3 text-center text-sm text-ink-soft">
        <p>
          ¿Ya tenés cuenta?{" "}
          <Link href={loginHref} className="font-semibold text-forest-700 hover:underline">
            Iniciá sesión y activamos tu estadía
          </Link>
        </p>
        <div className="flex justify-center">
          <DeclineInvite token={token} />
        </div>
        <p className="text-xs text-ink-faint">El enlace es personal y se usa una sola vez.</p>
      </div>
    </div>
  );
}
