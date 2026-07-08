import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertResidenceAccess } from "@/lib/residences/access";
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

  const hasAccess = await assertResidenceAccess(admin, sessionUser.id, residenceId);
  if (!hasAccess) notFound();

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

  const student = application.student_profiles as unknown as { first_name: string; last_initial: string } | null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-petrol-800">
        Propuesta de ajuste para {student?.first_name} {student?.last_initial}
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Formalizá dentro de EstuRed los cambios que hayas acordado con el estudiante por WhatsApp.
      </p>
      <NegotiationForm applicationId={id} residenceId={residenceId} original={original} />
    </div>
  );
}
