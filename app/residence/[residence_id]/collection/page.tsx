import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackToProfileLink } from "@/components/residences/BackToProfileLink";
import { ResidenceHero } from "@/components/residences/ResidenceHero";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getResidenceMembership } from "@/lib/residences/access";
import { isPaymentMethodKey, type PaymentMethodKey } from "@/lib/payments/paymentMethods";
import { explicitReservationModes } from "@/lib/residences/reservationCollection";
import { loadCollectionAccountsForOwner } from "@/lib/residences/reservationCollectionDb";
import { CollectionEditor, type CollectionEditorAccount } from "@/app/residence/[residence_id]/collection/CollectionEditor";

export const metadata: Metadata = { title: "Cobro de la reserva" };
export const dynamic = "force-dynamic";

/**
 * «Cobro de la reserva» (DR63, `docs/08` §7.2): cómo cobra la residencia la reserva y con qué datos. SOLO el dueño la ve y la edita. El
 * staff ve el aviso y nada más: esta pantalla ni siquiera consulta `residence_collection_accounts` para él.
 */
export default async function ResidenceCollectionPage({ params }: { params: Promise<{ residence_id: string }> }) {
  const { residence_id: residenceId } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser) notFound();
  const admin = getSupabaseAdmin();
  if (!admin) notFound();
  const membership = await getResidenceMembership(admin, sessionUser.id, residenceId);
  if (!membership) notFound();
  const isOwner = membership.role === "owner";

  const owner = isOwner ? await loadCollectionAccountsForOwner(admin, residenceId) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <BackToProfileLink residenceId={residenceId} className="mb-2" />
      <ResidenceHero icon="payments" title="Cobro de la reserva" subtitle="Cómo cobrás la reserva a quien se queda con tu residencia." />

      <p className="text-sm text-ink-soft">Esto define solo el pago de la reserva. Los pagos siguientes los acordás con cada estudiante.</p>
      <p className="mt-3 flex items-start gap-2 rounded-field bg-amber-soft-100 px-4 py-3 text-sm text-ink">
        <Icon name="info" className="mt-px shrink-0 text-lg" />
        <span>EstuRed no es responsable de ningún pago ni del medio de pago elegido, y no custodia fondos.</span>
      </p>

      {!isOwner ? (
        <div className="mt-6">
          <EmptyState icon="lock" title="Solo el dueño puede ver y editar los datos de cobro" description="Pedile al dueño de la residencia que configure el cobro de la reserva." />
        </div>
      ) : owner === null || !owner.ok ? (
        <div className="mt-6">
          <EmptyState icon="error" title="No pudimos cargar el cobro de la reserva" description="Probá de nuevo en unos minutos. Si sigue pasando, avisale a Soporte." />
        </div>
      ) : !owner.ready ? (
        <div className="mt-6">
          <EmptyState
            icon="hourglass_top"
            title="El cobro de la reserva todavía no está disponible"
            description="Lo estamos terminando de preparar en este entorno. Volvé en unos minutos."
          />
        </div>
      ) : (
        <CollectionEditor
          residenceId={residenceId}
          initialModes={explicitReservationModes(owner.modes)}
          initialMethods={(owner.acceptedMethods ?? []).filter((k): k is PaymentMethodKey => isPaymentMethodKey(k))}
          accounts={owner.accounts.map(
            (a): CollectionEditorAccount => ({
              methodKey: a.methodKey,
              state: a.state,
              hasApproved: (a.details ?? "").trim().length > 0,
              rejectedReason: a.state === "rejected" ? a.rejectedReason : null,
              // Lo que se edita: lo pendiente si hay; si no, lo aprobado.
              details: (a.pendingDetails ?? a.details ?? "") as string,
              label: (a.pendingMethodLabel ?? a.methodLabel ?? "") as string,
            }),
          )}
        />
      )}
    </div>
  );
}
