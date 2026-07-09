import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PaymentProofUpload } from "@/app/students/applications/[id]/payment/PaymentProofUpload";

export const metadata: Metadata = { title: "Detalle de solicitud" };
export const dynamic = "force-dynamic";

const STATUS_EXPLANATION: Record<string, { label: string; tone: "amber" | "sage" | "neutral"; helper: string }> = {
  submitted: {
    label: "Enviada — esperando respuesta",
    tone: "amber",
    helper: "La residencia tiene 48 horas para responder desde que enviaste tu solicitud.",
  },
  under_review: {
    label: "En revisión",
    tone: "amber",
    helper: "La residencia está revisando tu solicitud.",
  },
  contact_established: {
    label: "Contacto establecido",
    tone: "sage",
    helper: "La residencia va a escribirte por WhatsApp para coordinar los próximos pasos.",
  },
  offer_pending_student_acceptance: {
    label: "Te propusieron un ajuste",
    tone: "amber",
    helper: "La residencia propuso un cambio en las condiciones. Revisalo y decidí.",
  },
  conditions_accepted: {
    label: "Condiciones aceptadas",
    tone: "sage",
    helper: "Ya acordaste las condiciones finales. El pago a la residencia se habilita en la próxima etapa.",
  },
  residence_payment_pending: {
    label: "Pagá a la residencia",
    tone: "amber",
    helper:
      "Coordiná el pago directamente con la residencia (fuera de EstuRed). Cuando lo reciba, ella lo va a marcar acá.",
  },
  residence_payment_reported: {
    label: "Pago informado por la residencia",
    tone: "sage",
    helper: "La residencia confirmó que recibió tu pago. Tu reserva se está creando.",
  },
  converted_to_reservation: {
    label: "Reserva creada",
    tone: "sage",
    helper: "La residencia confirmó tu pago. Ya podés pagar el fee EstuRed para confirmar tu reserva.",
  },
  paused_due_to_other_active_request: {
    label: "Pausada",
    tone: "neutral",
    helper: "Otra de tus solicitudes avanzó primero. Esta queda en espera, no fue cancelada.",
  },
  rejected: {
    label: "Rechazada",
    tone: "neutral",
    helper: "La residencia no pudo avanzar con esta solicitud.",
  },
  expired_no_residence_response: {
    label: "Vencida — sin respuesta",
    tone: "neutral",
    helper: "La residencia no respondió dentro de las 48 horas.",
  },
  cancelled_by_student: {
    label: "Cancelada por vos",
    tone: "neutral",
    helper: "Cancelaste esta solicitud.",
  },
};

export default async function StudentApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServer();
  if (!supabase) notFound();

  const { data: application } = await supabase
    .from("application_requests")
    .select(
      "id, status, desired_start_date, initial_duration_months, academic_objective, rejection_reason_code, created_at, residences(name, public_area, responsible_contact), room_types(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!application) notFound();

  const residence = application.residences as unknown as { name: string; public_area: string } | null;
  const roomType = application.room_types as unknown as { name: string } | null;
  const info = STATUS_EXPLANATION[application.status] ?? {
    label: application.status,
    tone: "neutral" as const,
    helper: "",
  };

  let reservation: { status: string; booking_receipt_id: string | null } | null = null;
  if (application.status === "converted_to_reservation") {
    const { data } = await supabase
      .from("reservations")
      .select("status, booking_receipt_id")
      .eq("application_request_id", id)
      .maybeSingle();
    reservation = data;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <Card className="p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-petrol-800">{residence?.name}</h1>
            <p className="text-sm text-ink-soft">
              {roomType?.name} · {residence?.public_area}, CABA
            </p>
          </div>
          <Badge tone={info.tone}>{info.label}</Badge>
        </div>

        <p className="mt-4 rounded-field bg-sand-100 px-4 py-3 text-sm text-ink-soft">{info.helper}</p>

        {application.status === "offer_pending_student_acceptance" && (
          <Button href={`/students/applications/${id}/negotiation`} size="lg" className="mt-4 w-full">
            Ver propuesta de ajuste
          </Button>
        )}

        {reservation?.status === "pending_estured_fee" && (
          <Button href={`/students/applications/${id}/fee`} size="lg" className="mt-4 w-full">
            Pagar fee EstuRed
          </Button>
        )}
        {reservation?.status === "confirmed" && reservation.booking_receipt_id && (
          <Button href={`/students/receipts/${reservation.booking_receipt_id}`} size="lg" className="mt-4 w-full">
            Ver comprobante de reserva
          </Button>
        )}

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
            <dt className="text-ink-faint">Enviada</dt>
            <dd className="font-medium text-ink">
              {new Date(application.created_at).toLocaleDateString("es-AR")}
            </dd>
          </div>
        </dl>

        <p className="mt-6 text-sm text-ink-soft">
          <span className="font-semibold text-ink">Tu objetivo académico:</span>{" "}
          {application.academic_objective}
        </p>
      </Card>

      {["residence_payment_pending", "converted_to_reservation"].includes(application.status) && (
        <PaymentProofUpload applicationId={id} />
      )}
    </div>
  );
}
