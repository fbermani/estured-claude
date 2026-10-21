import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertResidenceAccess } from "@/lib/residences/access";
import { buildWhatsappUrl } from "@/lib/applications/whatsapp";
import { ACTIVE_APPLICATION_STATUSES } from "@/lib/applications/types";
import { loadReservationInfoByApplication } from "@/lib/applications/loadReservationInfo";
import { ApplicationsInbox, type FullApplication } from "@/app/residence/[residence_id]/applications/ApplicationsInbox";

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

  const hasAccess = await assertResidenceAccess(admin, sessionUser.id, residenceId);
  if (!hasAccess) notFound();

  const [{ data: residence }, { data: applications }, { data: waitlistEntries }] = await Promise.all([
    admin.from("residences").select("name").eq("id", residenceId).maybeSingle(),
    admin
      .from("application_requests")
      .select(
        "id, status, contact_target, desired_start_date, initial_duration_months, academic_objective, rejection_reason_code, family_link_id, created_by_user_id, snapshot_original_id, room_type_id, expires_at, payment_deadline_at, created_at, room_types(name), student_profiles(first_name, last_initial, nationality, origin_city)",
      )
      .eq("residence_id", residenceId)
      .order("created_at", { ascending: false }),
    admin.from("waitlist_entries").select("room_type_id").eq("residence_id", residenceId).in("status", WAITLIST_ACTIVE_STATUSES),
  ]);

  const rows = applications ?? [];

  const waitlistCountByType = new Map<string, number>();
  for (const w of waitlistEntries ?? []) {
    if (!w.room_type_id) continue;
    waitlistCountByType.set(w.room_type_id, (waitlistCountByType.get(w.room_type_id) ?? 0) + 1);
  }

  const snapshotIds = [...new Set(rows.map((a) => a.snapshot_original_id).filter(Boolean))];
  const { data: snapshots } = snapshotIds.length
    ? await admin
        .from("application_snapshots")
        .select("id, monthly_price_usd, reservation_payment_amount_usd")
        .in("id", snapshotIds)
    : { data: [] };
  const snapshotById = new Map((snapshots ?? []).map((s) => [s.id, s]));

  // H01: estado visible = solicitud + reserva asociada (la reserva manda).
  const reservationInfoByAppId = await loadReservationInfoByApplication(
    admin,
    rows.filter((a) => a.status === "converted_to_reservation").map((a) => a.id),
  );

  const familyLinkIds = [...new Set(rows.filter((a) => a.contact_target === "family_member" && a.family_link_id).map((a) => a.family_link_id!))];
  const { data: familyLinks } = familyLinkIds.length
    ? await admin.from("family_links").select("id, family_members(phone)").in("id", familyLinkIds)
    : { data: [] };
  const phoneByFamilyLinkId = new Map(
    (familyLinks ?? []).map((l) => [l.id, (l.family_members as unknown as { phone: string | null } | null)?.phone ?? null]),
  );

  const userIds = [...new Set(rows.filter((a) => a.contact_target !== "family_member").map((a) => a.created_by_user_id))];
  const { data: users } = userIds.length ? await admin.from("users").select("id, phone").in("id", userIds) : { data: [] };
  const phoneByUserId = new Map((users ?? []).map((u) => [u.id, u.phone]));

  const fullApplications: FullApplication[] = rows.map((a) => {
    const student = a.student_profiles as unknown as {
      first_name: string;
      last_initial: string;
      nationality: string;
      origin_city: string;
    } | null;
    const roomType = a.room_types as unknown as { name: string } | null;
    const snapshot = snapshotById.get(a.snapshot_original_id) ?? null;
    const reservationInfo = reservationInfoByAppId.get(a.id) ?? null;

    const contactPhone =
      a.contact_target === "family_member" && a.family_link_id
        ? (phoneByFamilyLinkId.get(a.family_link_id) ?? null)
        : (phoneByUserId.get(a.created_by_user_id) ?? null);

    const whatsappUrl =
      contactPhone && student
        ? buildWhatsappUrl({
            phone: contactPhone,
            studentName: `${student.first_name} ${student.last_initial}`,
            residenceName: residence?.name ?? "",
            roomTypeName: roomType?.name ?? "",
            desiredStartDate: a.desired_start_date,
            durationMonths: a.initial_duration_months,
            reservationAmountUsd: Number(snapshot?.reservation_payment_amount_usd ?? snapshot?.monthly_price_usd ?? 0),
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
      studentName: student ? `${student.first_name} ${student.last_initial}` : "Estudiante",
      studentNationality: student?.nationality ?? null,
      studentOriginCity: student?.origin_city ?? null,
      expiresAt: a.expires_at,
      paymentDeadlineAt: a.payment_deadline_at,
      createdAt: a.created_at,
      priceUsd: snapshot ? Number(snapshot.monthly_price_usd) : null,
      reservation: reservationInfo
        ? {
            status: reservationInfo.status,
            cancellationReasonCode: reservationInfo.cancellationReasonCode,
            feePaymentStatus: reservationInfo.feePaymentStatus,
            hasReceipt: reservationInfo.hasReceipt,
          }
        : null,
      whatsappUrl,
      waitlistRelatedCount: a.room_type_id ? (waitlistCountByType.get(a.room_type_id) ?? 0) : 0,
      isActive: (ACTIVE_APPLICATION_STATUSES as readonly string[]).includes(a.status),
    };
  });

  return (
    <ApplicationsInbox
      residenceId={residenceId}
      applications={fullApplications}
      initialSelectedId={selectedId ?? null}
    />
  );
}
