import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getSupabaseServer } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  FUTURE_PAYMENTS_NOTICE,
  INVOICE_NOTICE,
  buildReceiptRows,
  type ReceiptPayload,
} from "@/lib/receipts/receiptView";
import { loadReceiptSupplement } from "@/lib/receipts/loadReceiptSupplement";
import { CopyVerificationLink } from "@/app/students/receipts/[id]/CopyVerificationLink";

export const metadata: Metadata = { title: "Comprobante de Reserva Confirmada" };
export const dynamic = "force-dynamic";

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
    .select("status, receipt_number, verification_code, qr_code_value, issued_at, voided_at, reservation_id, student_profile_id, payer_user_id, receipt_payload")
    .eq("id", id)
    .maybeSingle();
  if (!receipt) notFound();

  const payload = receipt.receipt_payload as ReceiptPayload;
  const supplement = await loadReceiptSupplement(supabase, getSupabaseAdmin(), receipt);
  const rows = buildReceiptRows(payload, supplement, receipt.issued_at);
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
        <h1 className="text-2xl font-bold text-ink">Comprobante de Reserva Confirmada</h1>
        <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>
      </div>
      <p className="mt-1 text-sm text-ink-faint">
        N.º <span className="font-mono font-medium text-ink">{receipt.receipt_number}</span>
      </p>

      {receipt.status === "reissued" && (
        <p className="mt-4 rounded-field bg-sand-100 px-4 py-3 text-sm text-ink-soft">
          Este comprobante fue reemitido y ya no es el vigente.{" "}
          {newReceipt && (
            <a href={`/students/receipts/${newReceipt.id}`} className="font-semibold text-forest-700 underline">
              Ver el comprobante vigente
            </a>
          )}
        </p>
      )}

      <Card className="mt-6 p-6">
        <dl className="space-y-3 text-sm">
          {rows.map((row, i) => (
            <div
              key={row.label}
              className={`flex justify-between gap-4 ${i < rows.length - 1 ? "border-b border-sand-200 pb-2" : ""}`}
            >
              <dt className="text-ink-faint">{row.label}</dt>
              <dd className="text-right font-medium text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>

        {payload.academic_objective && (
          <p className="mt-4 text-sm text-ink-soft">
            <span className="font-semibold text-ink">Objetivo académico:</span> {payload.academic_objective}
          </p>
        )}
      </Card>

      <div className="mt-4 space-y-2 rounded-field bg-sand-100 px-4 py-3 text-xs text-ink-faint">
        <p>{FUTURE_PAYMENTS_NOTICE}</p>
        <p>{payload.disclaimer}</p>
      </div>

      <Card className="mt-6 flex flex-col items-center gap-3 p-6 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Código QR de verificación" width={96} height={96} className="rounded-field border border-sand-200" />
          <p className="max-w-xs text-xs text-ink-faint">
            Escaneá el código o compartí el enlace para que cualquiera pueda verificar este comprobante. También
            pueden ingresar el número <span className="font-mono font-medium text-ink">{receipt.receipt_number}</span>{" "}
            en <span className="font-medium text-ink">/verify</span>.
          </p>
        </div>
        <a
          href={`/students/receipts/${id}/pdf`}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-200 ease-out-fresh hover:bg-forest-600 hover:shadow"
        >
          Descargar PDF
        </a>
      </Card>

      <CopyVerificationLink qrCodeValue={receipt.qr_code_value} />

      <p className="mt-4 text-xs text-ink-faint">{INVOICE_NOTICE}</p>
    </div>
  );
}
