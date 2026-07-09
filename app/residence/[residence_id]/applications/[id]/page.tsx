import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertResidenceAccess } from "@/lib/residences/access";
import { buildWhatsappUrl } from "@/lib/applications/whatsapp";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatUsd } from "@/lib/mock/exchange";
import { ApplicationActions } from "@/app/residence/[residence_id]/applications/[id]/ApplicationActions";

export const metadata: Metadata = { title: "Detalle de solicitud" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  submitted: "Nueva",
  under_review: "En revisión",
  contact_established: "Contacto establecido",
  offer_pending_student_acceptance: "Propuesta enviada — esperando al estudiante",
  conditions_accepted: "Condiciones aceptadas",
  residence_payment_pending: "Esperando pago del estudiante",
  residence_payment_reported: "Pago recibido — reserva creada",
  converted_to_reservation: "Reserva creada — fee pendiente",
  paused_due_to_other_active_request: "Pausada",
  rejected: "Rechazada",
  expired_no_residence_response: "Vencida",
  cancelled_by_student: "Cancelada por el estudiante",
};

export default async function ResidenceApplicationDetailPage({
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

  const { data: residence } = await admin.from("residences").select("name").eq("id", residenceId).maybeSingle();

  const { data: application } = await admin
    .from("application_requests")
    .select(
      "id, status, contact_target, desired_start_date, initial_duration_months, academic_objective, rejection_reason_code, family_link_id, created_by_user_id, snapshot_original_id, room_types(name), student_profiles(first_name, last_initial, nationality, origin_city)",
    )
    .eq("id", id)
    .eq("residence_id", residenceId)
    .maybeSingle();
  if (!application) notFound();

  const student = application.student_profiles as unknown as {
    first_name: string;
    last_initial: string;
    nationality: string;
    origin_city: string;
  } | null;
  const roomType = application.room_types as unknown as { name: string } | null;
  const { data: snapshot } = await admin
    .from("application_snapshots")
    .select("monthly_price_usd, reservation_payment_amount_usd")
    .eq("id", application.snapshot_original_id)
    .maybeSingle();

  // Teléfono del destinatario del contacto — nunca se expone al cliente
  // directamente, se resuelve server-side para armar el link de WhatsApp.
  let contactPhone: string | null = null;
  if (application.contact_target === "family_member" && application.family_link_id) {
    const { data: link } = await admin
      .from("family_links")
      .select("family_members(phone)")
      .eq("id", application.family_link_id)
      .maybeSingle();
    contactPhone = (link?.family_members as unknown as { phone: string | null } | null)?.phone ?? null;
  } else {
    const { data: appUser } = await admin
      .from("users")
      .select("phone")
      .eq("id", application.created_by_user_id)
      .maybeSingle();
    contactPhone = appUser?.phone ?? null;
  }

  const whatsappUrl =
    contactPhone && student
      ? buildWhatsappUrl({
          phone: contactPhone,
          studentName: `${student.first_name} ${student.last_initial}`,
          residenceName: residence?.name ?? "",
          roomTypeName: roomType?.name ?? "",
          desiredStartDate: application.desired_start_date,
          durationMonths: application.initial_duration_months,
          reservationAmountUsd: Number(snapshot?.reservation_payment_amount_usd ?? snapshot?.monthly_price_usd ?? 0),
        })
      : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Card className="p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-petrol-800">
              {student?.first_name} {student?.last_initial}
            </h1>
            <p className="text-sm text-ink-soft">
              {student?.nationality} · {student?.origin_city} · {roomType?.name}
            </p>
          </div>
          <Badge tone="petrol">{STATUS_LABEL[application.status] ?? application.status}</Badge>
        </div>

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between border-b border-sand-200 pb-2">
            <dt className="text-ink-faint">Fecha de ingreso deseada</dt>
            <dd className="font-medium text-ink">{application.desired_start_date}</dd>
          </div>
          <div className="flex justify-between border-b border-sand-200 pb-2">
            <dt className="text-ink-faint">Duración estimada</dt>
            <dd className="font-medium text-ink">{application.initial_duration_months} meses</dd>
          </div>
          <div className="flex justify-between border-b border-sand-200 pb-2">
            <dt className="text-ink-faint">Tarifa acordada</dt>
            <dd className="font-medium text-ink">
              {snapshot ? formatUsd(Number(snapshot.monthly_price_usd)) : "—"}
            </dd>
          </div>
          <div className="flex justify-between border-b border-sand-200 pb-2">
            <dt className="text-ink-faint">Contacto dirigido a</dt>
            <dd className="font-medium text-ink">
              {application.contact_target === "family_member" ? "Familiar vinculado" : "Estudiante"}
            </dd>
          </div>
        </dl>

        <p className="mt-6 text-sm text-ink-soft">
          <span className="font-semibold text-ink">Objetivo académico:</span> {application.academic_objective}
        </p>

        <div className="mt-8 border-t border-sand-200 pt-6">
          <ApplicationActions
            applicationId={application.id}
            residenceId={residenceId}
            status={application.status}
            whatsappUrl={whatsappUrl}
          />
        </div>
      </Card>
    </div>
  );
}
