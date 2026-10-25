import { formatShortName } from "@/lib/format/shortName";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getResidenceMembership } from "@/lib/residences/access";
import { can, PERMISSION_DENIED_MESSAGE } from "@/lib/residences/permissions";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { normalizeInitialPaymentMode } from "@/lib/reservations/initialPayment";
import { NegotiationForm } from "@/app/residence/[residence_id]/applications/[id]/negotiation/NegotiationForm";

export const metadata: Metadata = { title: "Enviar propuesta de ajuste" };
export const dynamic = "force-dynamic";

export default async function SendNegotiationPage({
  params,
}: {
  params: Promise<{ residence_id: string; id: string }>;
}) {
  const { residence_id: residenceId, id } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser) notFound();
  const admin = getSupabaseAdmin();
  if (!admin) notFound();

  const membership = await getResidenceMembership(admin, sessionUser.id, residenceId);
  if (!membership) notFound();
  // DR11: la propuesta de ajuste requiere el permiso `applications.send_adjustment` (apagado por defecto para el staff); sin él vuelve a
  // la solicitud con un aviso claro. Es solo presentación: el servidor lo vuelve a validar al enviar.
  if (!can(membership, "applications.send_adjustment")) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <EmptyState
          icon="lock"
          title="No tenés permiso para proponer ajustes"
          description={`${PERMISSION_DENIED_MESSAGE} Mientras tanto podés habilitar el pago con las condiciones originales o rechazar la solicitud desde su detalle.`}
          action={
            <Button href={`/residence/${residenceId}/applications?app=${id}`} variant="outline" size="sm">
              Volver a la solicitud
            </Button>
          }
        />
      </div>
    );
  }

  const { data: application } = await admin
    .from("application_requests")
    .select("id, status, proposal_count, snapshot_original_id, student_profiles(first_name, last_initial)")
    .eq("id", id)
    .eq("residence_id", residenceId)
    .maybeSingle();
  if (!application) notFound();
  if (application.status !== "contact_established" || application.proposal_count > 0) {
    redirect(`/residence/${residenceId}/applications/${id}`);
  }

  const { data: original } = await admin
    .from("application_snapshots")
    .select(
      "monthly_price_usd, enrollment_fee_usd, deposit_usd, initial_duration_months, reservation_payment_amount_usd, adjustment_policy",
    )
    .eq("id", application.snapshot_original_id)
    .single();
  if (!original) notFound();

  const { data: residenceRow } = await admin.from("residences").select("*").eq("id", residenceId).maybeSingle();
  const initialPaymentMode = normalizeInitialPaymentMode(residenceRow?.reservation_initial_payment_mode);

  const student = application.student_profiles as unknown as { first_name: string; last_initial: string } | null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-ink">
        Propuesta de ajuste para {formatShortName(student?.first_name, student?.last_initial)}
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Formalizá dentro de EstuRed los cambios que hayas acordado con el estudiante por WhatsApp.
      </p>
      <NegotiationForm applicationId={id} residenceId={residenceId} original={original} initialPaymentMode={initialPaymentMode} />
    </div>
  );
}
