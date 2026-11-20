import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { formatDate } from "@/lib/dates/format";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { familyStatusLabel } from "@/lib/family/familyStatusLabel";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { loadActiveFamilyLink } from "@/lib/family/access";
import { getSessionUser } from "@/lib/auth/session";
import { DrawCheck } from "@/components/ui/DrawCheck";
import { PushPermissionCard } from "@/components/push/PushPermissionCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PaymentProofUpload } from "@/app/students/applications/[id]/payment/PaymentProofUpload";
import { getVisibleStatus } from "@/lib/applications/visibleStatus";
import { loadReservationInfoByApplication } from "@/lib/applications/loadReservationInfo";
import { loadAgreedConditionsByApplication } from "@/lib/applications/loadApplicationSnapshots";
import { buildApplicationTimeline } from "@/lib/applications/timeline";
import { ApplicationTimeline } from "@/components/applications/ApplicationTimeline";
import { effectiveContactDeadline } from "@/lib/applications/paymentDeadline";
import { ContactDeadlineNote } from "@/components/applications/ContactDeadlineNote";
import { AgreedConditionsCard } from "@/components/applications/AgreedConditionsCard";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { buildTerminalSummary, isRevokedReservation, isTerminalVisibleStatus } from "@/lib/applications/terminalState";
import { advanceGateMessage, stayChangeAdvanceAt } from "@/lib/stayChange/advanceGate";
import { getRegulationGate } from "@/lib/regulations/gate";
import { loadCurrentRegulation } from "@/lib/regulations/current";
import { RegulationText } from "@/components/regulations/RegulationText";
import { RegulationPdfLink } from "@/components/regulations/RegulationPdfLink";
import { AcceptRegulationForm } from "@/app/students/applications/[id]/AcceptRegulationForm";

/** Estados en los que las condiciones ya fueron aceptadas (docs/04 §5.2). */
const CONDITIONS_AGREED_STATUSES = new Set([
  "conditions_accepted",
  "residence_payment_pending",
  "residence_payment_reported",
  "converted_to_reservation",
]);

export const metadata: Metadata = { title: "Detalle de solicitud" };
export const dynamic = "force-dynamic";

export default async function StudentApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ enviada?: string }>;
}) {
  const { id } = await params;
  const justSent = (await searchParams).enviada === "1";
  const supabase = await getSupabaseServer();
  if (!supabase) notFound();
  // DR4: el familiar vinculado SIGUE la solicitud en solo lectura (RLS `is_family_member_of_student`): sin respuestas a
  // propuestas, sin comprobantes a la residencia y sin el texto en segunda persona del estudiante.
  const sessionUser = await getSessionUser();
  const isFamilyViewer = !!sessionUser && sessionUser.roles.includes("family_member") && !sessionUser.roles.includes("student");

  const { data: application, error: applicationError } = await supabase
    .from("application_requests")
    .select(
      "id, status, residence_id, student_profile_id, desired_start_date, initial_duration_months, academic_objective, rejection_reason_code, created_at, contact_established_at, payment_deadline_at, snapshot_original_id, snapshot_final_id, residences(name, public_area, address_line), room_types(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (applicationError) {
    // Un fallo de la consulta (p. ej. columna inexistente) no debe verse como "no existe" (404 silencioso).
    console.error("[student-application] query failed:", applicationError.message);
    throw new Error("No pudimos cargar tu solicitud.");
  }
  if (!application) notFound();

  // Defensa en profundidad (además de RLS): el familiar solo ve la solicitud si su vínculo con el estudiante está ACTIVO.
  if (isFamilyViewer) {
    const linkAdmin = getSupabaseAdmin();
    const link = linkAdmin && sessionUser ? await loadActiveFamilyLink(linkAdmin, sessionUser.id, application.student_profile_id as string) : null;
    if (!link) notFound();
  }

  const residence = application.residences as unknown as { name: string; public_area: string; address_line: string | null } | null;
  const roomType = application.room_types as unknown as { name: string } | null;

  // H01: estado visible = solicitud + reserva asociada (la reserva manda).
  const reservation =
    application.status === "converted_to_reservation"
      ? ((await loadReservationInfoByApplication(supabase, [id])).get(id) ?? null)
      : null;
  const info = getVisibleStatus({ applicationStatus: application.status, reservation, viewer: "student" });

  // H07: montos y recorrido salen del snapshot y de los hitos reales, nunca del precio vigente de `room_types`.
  const [conditionsByApp, { data: residencePayment }, { data: reservationRow }] = await Promise.all([
    loadAgreedConditionsByApplication(supabase, [
      {
        id,
        snapshot_original_id: application.snapshot_original_id as string | null,
        snapshot_final_id: application.snapshot_final_id as string | null,
      },
    ]),
    supabase
      .from("external_residence_payments")
      .select("reported_received_at, amount_reported_usd, amount_reported_ars")
      .eq("application_request_id", id)
      .maybeSingle(),
    reservation
      ? supabase
          .from("reservations")
          .select("confirmed_at, estured_fee_payment_id")
          .eq("application_request_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const conditions = conditionsByApp.get(id) ?? null;
  const { data: feePayment } = reservationRow?.estured_fee_payment_id
    ? await supabase
        .from("estured_fee_payments")
        .select("status, fee_amount_ars, paid_at, payer_user_id")
        .eq("id", reservationRow.estured_fee_payment_id as string)
        .maybeSingle()
    : { data: null };

  // "Quiero cambiar" (DR3): si la solicitud nació bajo un aviso abierto, se explica el preaviso de 48 h antes de poder avanzar al pago.
  // Lectura aparte y degradable (sin la migración 0044 o ante un error, la pantalla sigue como siempre).
  let changeNote: { advanceMessage: string | null } | null = null;
  {
    const { data: linkRow, error: linkError } = await supabase
      .from("application_requests")
      .select("stay_change_intent_id")
      .eq("id", id)
      .maybeSingle();
    const intentId = linkError ? null : (linkRow?.stay_change_intent_id as string | null | undefined);
    if (intentId) {
      const { data: intent } = await supabase
        .from("stay_change_intents")
        .select("status, created_at, guardian_confirmed_at, payment_unlocked_at")
        .eq("id", intentId)
        .maybeSingle();
      if (intent?.status === "open") {
        const at = stayChangeAdvanceAt({
          created_at: intent.created_at as string,
          guardian_confirmed_at: (intent.guardian_confirmed_at as string | null) ?? null,
          payment_unlocked_at: (intent.payment_unlocked_at as string | null) ?? null,
        });
        changeNote = { advanceMessage: at.getTime() > Date.now() ? advanceGateMessage(at, "student") : null };
      } else {
        changeNote = { advanceMessage: null };
      }
    }
  }

  // DR14: solicitud sin aceptación del reglamento (propuesta del familiar, lista de espera, menor o fallo al registrarla): la residencia no puede
  // avanzarla hasta que se acepte. Lectura degradable (sin la migración 0053 no hay aviso).
  // DR62 c: aceptación guardada (versión, fecha y quién aceptó), de solo lectura para el estudiante y su familiar.
  let acceptedRegulation: { versionNumber: number | null; acceptedAt: string; byGuardian: boolean } | null = null;
  {
    const acceptedAdmin = getSupabaseAdmin();
    if (acceptedAdmin) {
      const { data: acc } = await acceptedAdmin
        .from("application_regulation_acceptances")
        .select("accepted_at, accepted_by_role, residence_regulation_versions(version_number)")
        .eq("application_request_id", id)
        .maybeSingle();
      if (acc) {
        const version = (acc as unknown as { residence_regulation_versions: { version_number: number } | null }).residence_regulation_versions;
        acceptedRegulation = {
          versionNumber: version?.version_number ?? null,
          acceptedAt: acc.accepted_at as string,
          byGuardian: acc.accepted_by_role === "guardian",
        };
      }
    }
  }
  let regulationNotice: { canAccept: boolean; waitingFor: "student" | "guardian"; hash: string; text: string; pdfSlug: string | null } | null = null;
  {
    const noticeAdmin = getSupabaseAdmin();
    const gate = noticeAdmin ? await getRegulationGate(noticeAdmin, id) : null;
    if (noticeAdmin && gate?.pending && !gate.checkFailed) {
      const [current, { data: profileRow }] = await Promise.all([
        loadCurrentRegulation(noticeAdmin, application.residence_id as string),
        noticeAdmin.from("student_profiles").select("is_minor").eq("id", application.student_profile_id as string).maybeSingle(),
      ]);
      if (current.ok) {
        const isMinor = profileRow?.is_minor === true;
        let pdfSlug: string | null = null;
        if (current.view.pdf) {
          const { data: slugRow } = await noticeAdmin.from("residences").select("slug").eq("id", application.residence_id as string).maybeSingle();
          pdfSlug = (slugRow?.slug as string | undefined) ?? null;
        }
        regulationNotice = {
          canAccept: isMinor ? isFamilyViewer : !isFamilyViewer,
          waitingFor: isMinor ? "guardian" : "student",
          hash: current.view.hash,
          text: current.view.text,
          pdfSlug,
        };
      }
    }
  }

  const familyIsPayer = isFamilyViewer && feePayment?.payer_user_id === sessionUser?.id;

  // Solicitud terminada (vencida, rechazada, cancelada, reserva vencida/revocada): no se dibuja el recorrido como si siguiera.
  const terminal = isTerminalVisibleStatus(info);
  const terminalSummary = terminal
    ? buildTerminalSummary({
        applicationStatus: application.status,
        createdAt: application.created_at,
        contactEstablishedAt: application.contact_established_at as string | null,
        residencePaymentReportedAt: (residencePayment?.reported_received_at as string | null) ?? null,
        feePaidAt: (feePayment?.paid_at as string | null) ?? null,
        reservationStatus: reservation?.status ?? null,
        revoked: isRevokedReservation(reservation),
      })
    : null;

  const timeline = buildApplicationTimeline({
    applicationStatus: application.status,
    createdAt: application.created_at,
    contactEstablishedAt: application.contact_established_at as string | null,
    residencePaymentReportedAt: (residencePayment?.reported_received_at as string | null) ?? null,
    feePaidAt: (feePayment?.paid_at as string | null) ?? null,
    reservationConfirmedAt: (reservationRow?.confirmed_at as string | null) ?? null,
    reservationStatus: reservation?.status ?? null,
    isClosed: info.isClosed,
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      {justSent && !isFamilyViewer && (
        <div role="status" className="mb-4 flex items-center gap-4 rounded-card border-[1.5px] border-line bg-mint px-5 py-4 text-sm text-forest-700">
          <DrawCheck className="size-12" />
          <div className="dc-rise">
            <p className="font-semibold">Enviaste tu solicitud.</p>
            <p className="mt-1">Queda sujeta a confirmación de la residencia.</p>
            <Link href="/instalar" className="mt-2 inline-flex min-h-11 items-center gap-1.5 font-bold underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest md:hidden">
              <Icon name="notifications_active" className="text-lg" />
              Instalá la app para enterarte cuando responda
            </Link>
          </div>
        </div>
      )}
      {justSent && !isFamilyViewer && (
        <div className="mb-4">
          <PushPermissionCard audience="student" />
        </div>
      )}
      <Card className="p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink">{residence?.name}</h1>
            <p className="text-sm text-ink-soft">
              {roomType?.name} · {residence?.public_area}, CABA
            </p>
          </div>
          <Badge tone={info.tone}>{isFamilyViewer ? familyStatusLabel(info.label) : info.label}</Badge>
        </div>

        {changeNote && !isFamilyViewer && (
          <div className="mt-4 flex items-start gap-2 rounded-field bg-orange-tint/60 px-4 py-3 text-sm text-ink-soft">
            <Icon name="swap_horiz" className="mt-0.5 shrink-0 text-lg text-orange-700" />
            <div>
              <p className="font-bold text-orange-700">Por tu cambio de residencia</p>
              <p className="mt-0.5 text-xs leading-relaxed">
                {changeNote.advanceMessage ??
                  "Enviaste esta solicitud con tu aviso de cambio abierto. Si la reserva se confirma, coordiná tu salida con tu residencia actual."}
              </p>
            </div>
          </div>
        )}

        {acceptedRegulation && (
          <p className="mt-4 flex items-center gap-2 rounded-field border border-line-2 bg-forest-tint px-4 py-3 text-xs font-semibold text-ink-soft">
            <Icon name="gavel" className="text-lg text-forest-700" />
            Reglamento aceptado{acceptedRegulation.versionNumber ? ` (versión ${acceptedRegulation.versionNumber})` : ""} el{" "}
            {formatDate(acceptedRegulation.acceptedAt)}
            {acceptedRegulation.byGuardian ? ", por el familiar vinculado" : ""}.
          </p>
        )}

        {regulationNotice && !terminal && (
          <div className="mt-4 rounded-field border border-line-2 bg-orange-tint/60 px-4 py-3 text-sm text-ink-soft">
            <p className="flex items-center gap-2 font-bold text-orange-700">
              <Icon name="gavel" className="text-lg" /> Falta aceptar el reglamento
            </p>
            {regulationNotice.canAccept ? (
              <>
                <p className="mt-1 text-xs leading-relaxed">
                  {regulationNotice.waitingFor === "guardian"
                    ? "Como el estudiante es menor, lo tiene que aceptar su familiar vinculado."
                    : "Para que la residencia pueda avanzar con tu solicitud, leé el reglamento y aceptalo."}
                </p>
                <AcceptRegulationForm
                  applicationId={id}
                  hash={regulationNotice.hash}
                  content={
                    <>
                      <RegulationText text={regulationNotice.text} className="max-h-72 overflow-y-auto pr-2" />
                      {regulationNotice.pdfSlug && <RegulationPdfLink slug={regulationNotice.pdfSlug} className="mt-3" />}
                    </>
                  }
                />
              </>
            ) : (
              <p className="mt-1 text-xs leading-relaxed">
                {regulationNotice.waitingFor === "guardian"
                  ? "Como sos menor de edad, lo tiene que aceptar tu familiar vinculado desde su cuenta. Hasta entonces la residencia no puede avanzar con la solicitud."
                  : isFamilyViewer
                    ? "Lo tiene que aceptar el estudiante desde su cuenta. Hasta entonces la residencia no puede avanzar con la solicitud."
                    : "Hasta entonces la residencia no puede avanzar con la solicitud."}
              </p>
            )}
          </div>
        )}

        {terminal && (
          <div className="mt-4 rounded-field border border-line bg-sand-100 px-4 py-3 text-sm text-ink-soft">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Terminó acá</p>
            <p className="mt-1">
              {isFamilyViewer ? `${familyStatusLabel(info.label)}.` : (info.helper || `${info.label}.`)}
            </p>
          </div>
        )}

        {terminal && !isFamilyViewer && terminalSummary && (terminalSummary.residencePaid || terminalSummary.feePaid) && (
          <div className="mt-3 rounded-field border border-line px-4 py-3 text-sm text-ink-soft">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Qué pasa con lo que pagaste</p>
            {terminalSummary.residencePaid && (
              <p className="mt-1">
                El pago a la residencia se acuerda con ella directamente; si necesitás ayuda, escribinos a Soporte.
              </p>
            )}
            {terminalSummary.feePaid && (
              <p className="mt-1">Sobre el fee de EstuRed, escribinos a Soporte.</p>
            )}
          </div>
        )}

        {terminal && !isFamilyViewer && (
          <Button href="/students/support" size="lg" variant="outline" className="mt-4 w-full">
            Escribir a Soporte
          </Button>
        )}

        {info.helper && !isFamilyViewer && !terminal && (
          <div className="mt-4 rounded-field bg-sand-100 px-4 py-3 text-sm text-ink-soft">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Qué sigue</p>
            <p className="mt-1">{info.helper}</p>
          </div>
        )}

        {isFamilyViewer && (
          <p className="mt-4 flex items-start gap-2 rounded-field bg-sand-100 px-4 py-3 text-sm text-ink-soft">
            <Icon name="visibility" className="mt-0.5 shrink-0 text-lg text-forest-700" />
            Seguís esta solicitud en modo lectura. Las decisiones y los documentos son del estudiante.
          </p>
        )}

        {application.status === "contact_established" && (
          <ContactDeadlineNote deadlineAt={effectiveContactDeadline(application.payment_deadline_at as string | null, application.contact_established_at as string | null)} className="mt-4" />
        )}

        {info.nextAction === "respond_offer" && !isFamilyViewer && (
          <Button href={`/students/applications/${id}/negotiation`} size="lg" className="mt-4 w-full">
            Ver propuesta de ajuste
          </Button>
        )}
        {info.nextAction === "pay_fee" && (!isFamilyViewer || familyIsPayer) && (
          <Button href={`/students/applications/${id}/fee`} size="lg" className="mt-4 w-full">
            Pagar fee EstuRed
          </Button>
        )}
        {info.nextAction === "view_fee_status" && (!isFamilyViewer || familyIsPayer) && reservation?.status === "pending_estured_fee" && (
          <Button href={`/students/applications/${id}/fee`} size="lg" variant="outline" className="mt-4 w-full">
            Ver estado del fee
          </Button>
        )}
        {info.nextAction === "view_receipt" && reservation?.bookingReceiptId && (
          <Button href={`/students/receipts/${reservation.bookingReceiptId}`} size="lg" className="mt-4 w-full">
            Ver comprobante de reserva
          </Button>
        )}
        {info.nextAction === "contact_support" && !terminal && (
          <Button href="/students/support" size="lg" variant="outline" className="mt-4 w-full">
            Escribir a Soporte
          </Button>
        )}

        <dl className="mt-6 space-y-3 text-sm">
          {residence?.address_line && (
            <div className="flex justify-between gap-4 border-b border-sand-200 pb-2">
              <dt className="text-ink-faint">Dirección de la residencia</dt>
              <dd className="text-right font-medium text-ink">{residence.address_line}</dd>
            </div>
          )}
          <div className="flex justify-between border-b border-sand-200 pb-2">
            <dt className="text-ink-faint">Fecha de ingreso deseada</dt>
            <dd className="font-medium text-ink">{formatDateOnly(application.desired_start_date)}</dd>
          </div>
          <div className="flex justify-between border-b border-sand-200 pb-2">
            <dt className="text-ink-faint">Duración estimada</dt>
            <dd className="font-medium text-ink">{application.initial_duration_months} meses</dd>
          </div>
          <div className="flex justify-between border-b border-sand-200 pb-2">
            <dt className="text-ink-faint">Enviada</dt>
            <dd className="font-medium text-ink">
              {formatDate(application.created_at)}
            </dd>
          </div>
        </dl>

        {!isFamilyViewer && (
          <p className="mt-6 text-sm text-ink-soft">
            <span className="font-semibold text-ink">Tu objetivo académico:</span>{" "}
            {application.academic_objective}
          </p>
        )}
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="text-base font-bold text-ink">{terminal ? "Lo que llegó a pasar" : "Cómo viene la solicitud"}</h2>
        <div className="mt-4">
          <ApplicationTimeline steps={terminalSummary ? terminalSummary.steps : timeline} />
        </div>
      </Card>

      {conditions ? (
        <AgreedConditionsCard
          conditions={conditions}
          terminal={terminal}
          agreed={CONDITIONS_AGREED_STATUSES.has(application.status)}
          feeRealArs={feePayment ? Number(feePayment.fee_amount_ars) : null}
          feeIsPaid={feePayment?.status === "paid"}
          residencePaymentDeadlineAt={
            application.status === "residence_payment_pending" ? (application.payment_deadline_at as string | null) : null
          }
          residencePaymentReported={
            residencePayment && (residencePayment.amount_reported_usd !== null || residencePayment.amount_reported_ars !== null)
              ? {
                  usd: residencePayment.amount_reported_usd !== null ? Number(residencePayment.amount_reported_usd) : null,
                  ars: residencePayment.amount_reported_ars !== null ? Number(residencePayment.amount_reported_ars) : null,
                }
              : null
          }
        />
      ) : (
        <Card className="mt-6 p-6 text-sm text-ink-soft">
          No pudimos cargar las condiciones de esta solicitud. Probá de nuevo en unos minutos o escribile a Soporte.
        </Card>
      )}

      {/* H01: el comprobante de pago a la residencia es del paso anterior — una vez
          que existe la reserva ya no tiene sentido ofrecerlo. */}
      {application.status === "residence_payment_pending" && !isFamilyViewer && <PaymentProofUpload applicationId={id} />}
    </div>
  );
}
