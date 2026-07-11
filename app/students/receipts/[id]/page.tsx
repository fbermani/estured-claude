import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getSupabaseServer } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatUsd, formatArs } from "@/lib/mock/exchange";
import { CopyVerificationLink } from "@/app/students/receipts/[id]/CopyVerificationLink";

export const metadata: Metadata = { title: "Comprobante de Reserva Confirmada" };
export const dynamic = "force-dynamic";

type Payload = {
  student?: { first_name?: string; last_initial?: string };
  residence?: { name?: string; public_area?: string };
  room_type?: string;
  desired_start_date?: string;
  initial_duration_months?: number;
  academic_objective?: string;
  final_conditions?: { monthly_price_usd?: number; enrollment_fee_usd?: number; deposit_usd?: number };
  estured_fee?: { amount_ars?: number; currency?: string; paid_at?: string };
  adjustment_policy?: string;
  disclaimer?: string;
};

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServer();
  if (!supabase) notFound();

  const { data: receipt } = await supabase
    .from("booking_receipts")
    .select("status, receipt_number, verification_code, qr_code_value, issued_at, voided_at, receipt_payload")
    .eq("id", id)
    .maybeSingle();
  if (!receipt) notFound();

  const payload = receipt.receipt_payload as Payload;
  const qrDataUrl = await QRCode.toDataURL(receipt.qr_code_value, { margin: 1, width: 160 });

  const newReceipt =
    receipt.status === "reissued"
      ? (
          await supabase
            .from("booking_receipts")
            .select("id")
            .eq("reissued_from_receipt_id", id)
            .maybeSingle()
        ).data
      : null;

  const statusBadge =
    receipt.status === "voided"
      ? { tone: "danger" as const, label: "Anulado" }
      : receipt.status === "reissued"
        ? { tone: "neutral" as const, label: "Reemitido" }
        : { tone: "sage" as const, label: "Válido" };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-petrol-800">Comprobante de Reserva Confirmada</h1>
        <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>
      </div>
      <p className="mt-1 text-sm text-ink-faint">N.º {receipt.receipt_number}</p>

      {receipt.status === "reissued" && (
        <p className="mt-4 rounded-field bg-sand-100 px-4 py-3 text-sm text-ink-soft">
          Este comprobante fue reemitido y ya no es el vigente.{" "}
          {newReceipt && (
            <a href={`/students/receipts/${newReceipt.id}`} className="font-semibold text-petrol-700 underline">
              Ver el comprobante vigente
            </a>
          )}
        </p>
      )}

      <Card className="mt-6 p-6">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between border-b border-sand-200 pb-2">
            <dt className="text-ink-faint">Estudiante</dt>
            <dd className="font-medium text-ink">
              {payload.student?.first_name} {payload.student?.last_initial}
            </dd>
          </div>
          <div className="flex justify-between border-b border-sand-200 pb-2">
            <dt className="text-ink-faint">Residencia</dt>
            <dd className="font-medium text-ink">
              {payload.residence?.name} · {payload.residence?.public_area}
            </dd>
          </div>
          <div className="flex justify-between border-b border-sand-200 pb-2">
            <dt className="text-ink-faint">Tipo de habitación</dt>
            <dd className="font-medium text-ink">{payload.room_type}</dd>
          </div>
          <div className="flex justify-between border-b border-sand-200 pb-2">
            <dt className="text-ink-faint">Fecha de ingreso</dt>
            <dd className="font-medium text-ink">{payload.desired_start_date}</dd>
          </div>
          <div className="flex justify-between border-b border-sand-200 pb-2">
            <dt className="text-ink-faint">Duración inicial</dt>
            <dd className="font-medium text-ink">{payload.initial_duration_months} meses</dd>
          </div>
          <div className="flex justify-between border-b border-sand-200 pb-2">
            <dt className="text-ink-faint">Tarifa mensual acordada</dt>
            <dd className="font-medium text-ink">
              {payload.final_conditions?.monthly_price_usd && formatUsd(payload.final_conditions.monthly_price_usd)}
            </dd>
          </div>
          <div className="flex justify-between border-b border-sand-200 pb-2">
            <dt className="text-ink-faint">Fee EstuRed pagado</dt>
            <dd className="font-medium text-ink">
              {payload.estured_fee?.amount_ars && formatArs(payload.estured_fee.amount_ars)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-faint">Emitido</dt>
            <dd className="font-medium text-ink">
              {receipt.issued_at && new Date(receipt.issued_at).toLocaleDateString("es-AR")}
            </dd>
          </div>
        </dl>

        {payload.academic_objective && (
          <p className="mt-4 text-sm text-ink-soft">
            <span className="font-semibold text-ink">Objetivo académico:</span> {payload.academic_objective}
          </p>
        )}
      </Card>

      <p className="mt-4 rounded-field bg-sand-100 px-4 py-3 text-xs text-ink-faint">
        {payload.disclaimer}
      </p>

      <Card className="mt-6 flex flex-col items-center gap-3 p-6 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Código QR de verificación" width={96} height={96} className="rounded-field border border-sand-200" />
          <p className="max-w-xs text-xs text-ink-faint">
            Escaneá el código o compartí el enlace para que cualquiera pueda verificar este comprobante en{" "}
            <span className="font-medium text-ink">/verify</span>.
          </p>
        </div>
        <a
          href={`/students/receipts/${id}/pdf`}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-petrol-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-petrol-700 hover:shadow"
        >
          Descargar PDF
        </a>
      </Card>

      <CopyVerificationLink qrCodeValue={receipt.qr_code_value} />

      <p className="mt-4 text-xs text-ink-faint">
        Descarga de Factura C disponible cuando exista la integración de facturación fiscal real.
      </p>
    </div>
  );
}
