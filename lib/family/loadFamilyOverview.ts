import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getVisibleStatus, type VisibleStatusTone } from "@/lib/applications/visibleStatus";
import { formatShortName } from "@/lib/format/shortName";
import { familyStatusLabel } from "@/lib/family/familyStatusLabel";
import { loadReservationInfoByApplication } from "@/lib/applications/loadReservationInfo";
import { resolveFeePayerView, type FeePayerView } from "@/lib/payments/feeUrgentBanner";

/**
 * Lo que el familiar vinculado SIGUE del estudiante (DR4, docs/00 §31): estado de sus solicitudes y reservas y la próxima
 * acción que le toca a ÉL (pagar el fee si es el pagador designado). Solo lectura. NO incluye documentos, mensajes
 * privados ni el objetivo académico. Corre con service role: el llamador ya verificó la sesión y el rol, y acá se filtra
 * por vínculos ACTIVOS del propio familiar (nunca por un id que venga del cliente).
 */

export type FamilyApplicationNextAction =
  | { kind: "pay_fee"; href: string; expiresAt: string | null }
  | { kind: "waiting_fee_payment"; payerView: FeePayerView; expiresAt: string | null }
  | { kind: "view_receipt"; href: string }
  | null;

export type FamilyApplicationView = {
  id: string;
  residenceName: string;
  roomTypeName: string | null;
  area: string | null;
  desiredStartDate: string;
  statusLabel: string;
  statusTone: VisibleStatusTone;
  isClosed: boolean;
  nextAction: FamilyApplicationNextAction;
};

export type FamilyStudentOverview = {
  linkId: string;
  studentProfileId: string;
  studentFirstName: string;
  studentShortName: string;
  applications: FamilyApplicationView[];
  /** Propuestas del familiar a este estudiante que esperan su respuesta (el estudiante decide). */
  pendingProposals: { id: string; residenceName: string }[];
};

type LinkRow = {
  id: string;
  student_profile_id: string;
  permissions: Record<string, unknown> | null;
  student_profiles: { first_name: string; last_initial: string | null; user_id: string | null } | null;
  family_members: { user_id: string } | null;
};

export async function loadFamilyOverview(admin: SupabaseClient, familyUserId: string): Promise<FamilyStudentOverview[]> {
  const { data: linkData, error: linkError } = await admin
    .from("family_links")
    .select("id, student_profile_id, permissions, student_profiles(first_name, last_initial, user_id), family_members!inner(user_id)")
    .eq("status", "active")
    .eq("family_members.user_id", familyUserId)
    .order("created_at", { ascending: false });
  if (linkError) {
    console.error("[family] overview: no se pudieron leer los vínculos:", linkError);
    return [];
  }
  const links = (linkData ?? []) as unknown as LinkRow[];
  if (links.length === 0) return [];
  const studentIds = links.map((l) => l.student_profile_id);

  const { data: appData, error: appError } = await admin
    .from("application_requests")
    .select("id, status, student_profile_id, desired_start_date, created_at, residences(name, public_area), room_types(name)")
    .in("student_profile_id", studentIds)
    .order("created_at", { ascending: false });
  if (appError) console.error("[family] overview: no se pudieron leer las solicitudes:", appError);
  const apps = (appData ?? []) as unknown as {
    id: string;
    status: string;
    student_profile_id: string;
    desired_start_date: string;
    residences: { name: string; public_area: string | null } | null;
    room_types: { name: string } | null;
  }[];

  const convertedIds = apps.filter((a) => a.status === "converted_to_reservation").map((a) => a.id);
  const reservationByApp = await loadReservationInfoByApplication(admin, convertedIds);
  const reservationIds = [...reservationByApp.values()].map((r) => r.reservationId);
  const payerByReservation = new Map<string, string>();
  if (reservationIds.length > 0) {
    const { data: fees } = await admin.from("estured_fee_payments").select("reservation_id, payer_user_id").in("reservation_id", reservationIds);
    for (const f of fees ?? []) payerByReservation.set(f.reservation_id as string, f.payer_user_id as string);
  }

  const { data: proposalData } = await admin
    .from("family_application_proposals")
    .select("id, student_profile_id, residences(name), family_members!inner(user_id)")
    .eq("status", "pending_student_approval")
    .eq("family_members.user_id", familyUserId)
    .in("student_profile_id", studentIds);
  const proposals = (proposalData ?? []) as unknown as { id: string; student_profile_id: string; residences: { name: string } | null }[];

  return links.map((l) => {
    const first = l.student_profiles?.first_name ?? "Tu familiar";
    const initial = l.student_profiles?.last_initial;
    const applications: FamilyApplicationView[] = apps
      .filter((a) => a.student_profile_id === l.student_profile_id)
      .map((a) => {
        const reservation = reservationByApp.get(a.id) ?? null;
        const info = getVisibleStatus({ applicationStatus: a.status, reservation, viewer: "student" });
        let nextAction: FamilyApplicationNextAction = null;
        if (reservation?.status === "pending_estured_fee" && reservation.feePaymentStatus === "pending_payment_method") {
          const payerView = resolveFeePayerView({
            payerUserId: payerByReservation.get(reservation.reservationId),
            viewerUserId: familyUserId,
            studentUserId: l.student_profiles?.user_id,
            viewerCanPay: l.permissions?.can_pay_estured_fee === true,
          });
          nextAction =
            payerView === "viewer_pays"
              ? { kind: "pay_fee", href: `/students/applications/${a.id}/fee`, expiresAt: reservation.feeExpiresAt }
              : { kind: "waiting_fee_payment", payerView, expiresAt: reservation.feeExpiresAt };
        } else if (info.nextAction === "view_receipt" && reservation?.bookingReceiptId) {
          nextAction = { kind: "view_receipt", href: `/students/receipts/${reservation.bookingReceiptId}` };
        }
        return {
          id: a.id,
          residenceName: a.residences?.name ?? "Residencia",
          roomTypeName: a.room_types?.name ?? null,
          area: a.residences?.public_area ?? null,
          desiredStartDate: a.desired_start_date,
          statusLabel: familyStatusLabel(info.label),
          statusTone: info.tone,
          isClosed: info.isClosed,
          nextAction,
        };
      });
    return {
      linkId: l.id,
      studentProfileId: l.student_profile_id,
      studentFirstName: first,
      studentShortName: formatShortName(first, initial),
      applications,
      pendingProposals: proposals
        .filter((p) => p.student_profile_id === l.student_profile_id)
        .map((p) => ({ id: p.id, residenceName: p.residences?.name ?? "una residencia" })),
    };
  });
}
