import { effectiveContactDeadline } from "@/lib/applications/paymentDeadline";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getResidenceMembership } from "@/lib/residences/access";
import { can } from "@/lib/residences/permissions";
import { buildWhatsappUrl } from "@/lib/applications/whatsapp";
import { estimatedFeeUsd } from "@/lib/reservations/initialPayment";
import { ACTIVE_APPLICATION_STATUSES } from "@/lib/applications/types";
import { loadReservationInfoByApplication } from "@/lib/applications/loadReservationInfo";
import { loadCollectionViews } from "@/lib/applications/loadCollectionViews";
import { buildApplicantProfile, type ApplicantProfileSource } from "@/lib/applications/applicantProfile";
import { movingSignalFor } from "@/lib/stayChange/copy";
import { advanceGateMessage, stayChangeAdvanceAt } from "@/lib/stayChange/advanceGate";
import { ApplicationsInbox, type FullApplication } from "@/app/residence/[residence_id]/applications/ApplicationsInbox";
import { isCountableWaitlistEntry } from "@/lib/waitlist-entries/desiredMonth";
import { applicationAllowsDocuments } from "@/lib/documents/residenceDocumentAccess";
import { applicationAllowsIdentityNumber } from "@/lib/documents/studentIdentityNumberAccess";
import { computeRequirementStatuses } from "@/lib/residences/stayDocuments";
import { effectiveRequirements, loadStayDocumentsConfig, loadStudentDocumentFiles } from "@/lib/residences/stayDocumentsDb";
import type { StudentDocumentItem } from "@/components/residences/StudentDocumentChecklist";

export const metadata: Metadata = { title: "Solicitudes recibidas" };
export const dynamic = "force-dynamic";

const WAITLIST_ACTIVE_STATUSES = ["active", "availability_notification_sent", "retention_check_sent"];

export default async function ResidenceApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ residence_id: string }>;
  searchParams: Promise<{ app?: string }>;
}) {
  const { residence_id: residenceId } = await params;
  const { app: selectedId } = await searchParams;
  const sessionUser = await getSessionUser();
  if (!sessionUser) notFound();
  const admin = getSupabaseAdmin();
  if (!admin) notFound();

  const membership = await getResidenceMembership(admin, sessionUser.id, residenceId);
  if (!membership) notFound();

  const [{ data: residence }, { data: applications }, { data: waitlistEntries }] = await Promise.all([
    admin.from("residences").select("name").eq("id", residenceId).maybeSingle(),
    admin
      .from("application_requests")
      .select(
        "id, status, student_profile_id, contact_target, desired_start_date, initial_duration_months, academic_objective, rejection_reason_code, family_link_id, created_by_user_id, snapshot_original_id, snapshot_final_id, room_type_id, expires_at, payment_deadline_at, contact_established_at, created_at, room_types(name), student_profiles(first_name, last_initial, birth_date, display_age, is_minor, nationality, origin_city, origin_country, career, study_institution_private, bio, habits, interests, student_visibility_settings(is_individual_profile_visible, show_habits_to_registered, show_interests_to_registered))",
      )
      .eq("residence_id", residenceId)
      .order("created_at", { ascending: false }),
    admin.from("waitlist_entries").select("room_type_id, status, desired_start_date").eq("residence_id", residenceId).in("status", WAITLIST_ACTIVE_STATUSES),
  ]);

  const rows = applications ?? [];

  const waitlistCountByType = new Map<string, number>();
  for (const w of waitlistEntries ?? []) {
    if (!w.room_type_id || !isCountableWaitlistEntry(w as { status: string; desired_start_date: string | null })) continue;
    waitlistCountByType.set(w.room_type_id, (waitlistCountByType.get(w.room_type_id) ?? 0) + 1);
  }

  const snapshotIds = [...new Set(rows.flatMap((a) => [a.snapshot_original_id, a.snapshot_final_id]).filter(Boolean))];
  const { data: snapshots } = snapshotIds.length
    ? await admin
        .from("application_snapshots")
        .select("id, monthly_price_usd, reservation_payment_amount_usd, fee_base_usd")
        .in("id", snapshotIds)
    : { data: [] };
  const snapshotById = new Map((snapshots ?? []).map((s) => [s.id, s]));

  // H01: estado visible = solicitud + reserva asociada (la reserva manda).
  const reservationInfoByAppId = await loadReservationInfoByApplication(
    admin,
    rows.filter((a) => a.status === "converted_to_reservation").map((a) => a.id),
  );

  // DR63 (d): cómo se cobra la reserva de cada solicitud con el pago por habilitar o ya habilitado. Sin datos de cobro (solo claves, nombres y montos).
  const collectionViews = await loadCollectionViews(admin, {
    residenceId,
    isOwner: membership.role === "owner",
    apps: rows.map((a) => ({
      id: a.id,
      status: a.status,
      contactTarget: a.contact_target,
      snapshotId: (a.snapshot_final_id ?? a.snapshot_original_id) as string | null,
    })),
  });
  // El botón de WhatsApp: con contacto establecido (si la residencia puede coordinar por WhatsApp) y, con el pago habilitado, solo en
  // «Contacto directo por WhatsApp». En «Cobro con medios habilitados» no hay WhatsApp (DR63 (d)). Sin vista (migración 0102 sin aplicar): como antes.
  const showsWhatsapp = (a: (typeof rows)[number]): boolean => {
    const view = collectionViews.get(a.id);
    if (a.status === "contact_established") return view ? view.whatsappAllowed : true;
    if (a.status === "residence_payment_pending") return view ? view.whatsappAllowed : false;
    return false;
  };

  // El teléfono solo se consulta para solicitudes con contacto establecido (docs/10): antes no se lee ni se serializa.
  const contactRows = rows.filter(showsWhatsapp);
  const familyLinkIds = [...new Set(contactRows.filter((a) => a.contact_target === "family_member" && a.family_link_id).map((a) => a.family_link_id!))];
  const { data: familyLinks } = familyLinkIds.length
    ? await admin.from("family_links").select("id, family_members(phone)").in("id", familyLinkIds)
    : { data: [] };
  const phoneByFamilyLinkId = new Map(
    (familyLinks ?? []).map((l) => [l.id, (l.family_members as unknown as { phone: string | null } | null)?.phone ?? null]),
  );

  const userIds = [...new Set(contactRows.filter((a) => a.contact_target !== "family_member").map((a) => a.created_by_user_id))];
  const { data: users } = userIds.length ? await admin.from("users").select("id, phone").in("id", userIds) : { data: [] };
  const phoneByUserId = new Map((users ?? []).map((u) => [u.id, u.phone]));

  // DR3b: señal "En proceso de mudanza" (+ nota voluntaria del estudiante) en las solicitudes creadas bajo un aviso "Quiero cambiar".
  // Consulta aparte y degradable: sin la migración 0044 (o ante un error) la bandeja sigue funcionando sin la señal. La residencia
  // NUNCA recibe el aviso ni la residencia de origen: solo la señal, la nota y, mientras corre el preaviso, desde cuándo puede avanzar.
  const movingByAppId = new Map<string, { label: string; note: string | null; advanceNotice: string | null }>();
  const { data: movingRows, error: movingError } = await admin
    .from("application_requests")
    .select("id, stay_change_intent_id, move_context_note")
    .eq("residence_id", residenceId)
    .not("stay_change_intent_id", "is", null);
  if (movingError) {
    if (movingError.code !== "42703" && movingError.code !== "PGRST204") console.error("[residence/applications] moving signal lookup failed:", movingError);
  } else if (movingRows?.length) {
    const intentIds = [...new Set(movingRows.map((m) => m.stay_change_intent_id as string))];
    const { data: intents } = await admin
      .from("stay_change_intents")
      .select("id, status, created_at, guardian_confirmed_at, payment_unlocked_at")
      .in("id", intentIds);
    const intentById = new Map((intents ?? []).map((i) => [i.id as string, i]));
    for (const m of movingRows) {
      const signal = movingSignalFor({ stay_change_intent_id: m.stay_change_intent_id, move_context_note: m.move_context_note });
      if (!signal) continue;
      const intent = intentById.get(m.stay_change_intent_id as string);
      let advanceNotice: string | null = null;
      if (intent?.status === "open") {
        const at = stayChangeAdvanceAt({
          created_at: intent.created_at as string,
          guardian_confirmed_at: (intent.guardian_confirmed_at as string | null) ?? null,
          payment_unlocked_at: (intent.payment_unlocked_at as string | null) ?? null,
        });
        if (at.getTime() > Date.now()) advanceNotice = advanceGateMessage(at, "residence");
      }
      movingByAppId.set(m.id as string, { ...signal, advanceNotice });
    }
  }

  // Reserva confirmada: N.º y código verificable del comprobante (sin datos de facturación ni del pagador).
  const receiptIds = [...reservationInfoByAppId.values()]
    .filter((r) => r.status === "confirmed" && r.bookingReceiptId)
    .map((r) => r.bookingReceiptId as string);
  const receiptById = new Map<string, { receiptNumber: string; verificationCode: string }>();
  if (receiptIds.length > 0) {
    const { data: receipts, error: receiptsError } = await admin
      .from("booking_receipts")
      .select("id, receipt_number, verification_code, status")
      .in("id", receiptIds)
      .eq("residence_id", residenceId)
      .in("status", ["issued", "reissued"]);
    if (receiptsError) console.error("[residence/applications] booking_receipts query failed:", receiptsError);
    for (const r of receipts ?? []) {
      receiptById.set(r.id as string, {
        receiptNumber: r.receipt_number as string,
        verificationCode: r.verification_code as string,
      });
    }
  }

  // DR48: documentación del solicitante cuando la solicitud ya tiene el pago a la residencia habilitado (o la reserva sigue viva).
  // Todos ven el estado; solo el dueño y el staff con `payments.residence` reciben el id para «Ver» (la acción vuelve a autorizar).
  const canOpenApplicantDocs = can(membership, "payments.residence");
  const docEligibleApps = rows.filter((a) => applicationAllowsDocuments(a.status, reservationInfoByAppId.get(a.id)?.status));
  const docProfileIds = [...new Set(docEligibleApps.map((a) => a.student_profile_id as string).filter(Boolean))];
  const [stayDocsConfig, { files: applicantDocFiles, schemaReady: docsSchemaReady }] = docProfileIds.length
    ? await Promise.all([loadStayDocumentsConfig(admin, residenceId), loadStudentDocumentFiles(admin, docProfileIds)])
    : [null, { files: [], schemaReady: true }];
  const docRequirements = stayDocsConfig ? effectiveRequirements(stayDocsConfig, docsSchemaReady) : [];
  const documentsByAppId = new Map<string, StudentDocumentItem[]>();
  for (const a of docEligibleApps) {
    const files = applicantDocFiles.filter((f) => f.student_profile_id === a.student_profile_id);
    documentsByAppId.set(
      a.id,
      computeRequirementStatuses(docRequirements, files).map((st) => ({
        label: st.requirement.label,
        delivered: st.delivered,
        deliveredAt: st.deliveredAt,
        fileId: canOpenApplicantDocs ? st.fileId : null,
      })),
    );
  }

  const fullApplications: FullApplication[] = rows.map((a) => {
    // Perfil crudo: SOLO se usa acá, en el servidor. Al cliente viaja `applicant`, ya filtrado
    // por privacidad (menor / interruptores de visibilidad) y sin apellido, nacimiento ni contacto.
    const student = a.student_profiles as unknown as ApplicantProfileSource | null;
    const applicant = buildApplicantProfile(student, { contactTarget: a.contact_target });
    const roomType = a.room_types as unknown as { name: string } | null;
    // H24: la tarifa es "acordada" solo cuando hay snapshot final; antes es la solicitada.
    const snapshot = snapshotById.get(a.snapshot_final_id ?? a.snapshot_original_id) ?? null;
    const reservationInfo = reservationInfoByAppId.get(a.id) ?? null;

    const contactPhone =
      a.contact_target === "family_member" && a.family_link_id
        ? (phoneByFamilyLinkId.get(a.family_link_id) ?? null)
        : (phoneByUserId.get(a.created_by_user_id) ?? null);

    const whatsappUrl =
      // El teléfono sale recién al establecer contacto (docs/10). Con un menor es siempre el del familiar vinculado (`contact_target`).
      showsWhatsapp(a) && contactPhone && student
        ? buildWhatsappUrl({
            phone: contactPhone,
            studentName: applicant.displayName,
            residenceName: residence?.name ?? "",
            roomTypeName: roomType?.name ?? "",
            desiredStartDate: a.desired_start_date,
            durationMonths: a.initial_duration_months,
            reservationAmountUsd: Number(snapshot?.reservation_payment_amount_usd ?? snapshot?.monthly_price_usd ?? 0),
            feeUsd: snapshot?.fee_base_usd != null ? estimatedFeeUsd(Number(snapshot.fee_base_usd)) : null,
            paymentDeadlineAt: a.status === "residence_payment_pending" ? a.payment_deadline_at : null,
          })
        : null;

    return {
      id: a.id,
      status: a.status,
      contactTarget: a.contact_target,
      desiredStartDate: a.desired_start_date,
      initialDurationMonths: a.initial_duration_months,
      academicObjective: a.academic_objective,
      roomTypeId: a.room_type_id,
      roomTypeName: roomType?.name ?? null,
      studentName: applicant.displayName,
      applicant,
      expiresAt: a.expires_at,
      paymentDeadlineAt:
        a.status === "contact_established"
          ? effectiveContactDeadline(a.payment_deadline_at, a.contact_established_at)
          : a.payment_deadline_at,
      createdAt: a.created_at,
      priceUsd: snapshot ? Number(snapshot.monthly_price_usd) : null,
      priceAgreed: Boolean(a.snapshot_final_id),
      reservation: reservationInfo
        ? {
            status: reservationInfo.status,
            cancellationReasonCode: reservationInfo.cancellationReasonCode,
            feePaymentStatus: reservationInfo.feePaymentStatus,
            hasReceipt: reservationInfo.hasReceipt,
          }
        : null,
      confirmedBooking:
        reservationInfo?.status === "confirmed" && reservationInfo.bookingReceiptId
          ? (receiptById.get(reservationInfo.bookingReceiptId) ?? null)
          : null,
      whatsappUrl,
      collection: collectionViews.get(a.id) ?? null,
      waitlistRelatedCount: a.room_type_id ? (waitlistCountByType.get(a.room_type_id) ?? 0) : 0,
      isActive: (ACTIVE_APPLICATION_STATUSES as readonly string[]).includes(a.status),
      moving: movingByAppId.get(a.id) ?? null,
      documents: documentsByAppId.get(a.id) ?? null,
      identityStudentProfileId:
        canOpenApplicantDocs && a.student_profile_id && applicationAllowsIdentityNumber(a.status, reservationInfoByAppId.get(a.id)?.status)
          ? (a.student_profile_id as string)
          : null,
    };
  });

  return (
    <ApplicationsInbox
      residenceId={residenceId}
      applications={fullApplications}
      initialSelectedId={selectedId ?? null}
      allowed={{
        reviewContact: can(membership, "applications.review_contact"),
        reject: can(membership, "applications.reject"),
        residencePayment: can(membership, "payments.residence"),
        sendAdjustment: can(membership, "applications.send_adjustment"),
      }}
      documentsLimited={!docsSchemaReady}
    />
  );
}
