import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = { title: "Verificar comprobante" };
export const dynamic = "force-dynamic";

/**
 * Docs/08 §4.6 — pública, sin login. Proyecta a mano solo los campos
 * mínimos permitidos (nunca montos, documentos ni datos de contacto) —
 * lee con el service role porque `booking_receipts`/`renewal_receipts`
 * no tienen policy para `anon` a propósito (ver migración 0011/0016).
 *
 * Un mismo `verification_code` nunca puede existir en ambas tablas
 * (cada una genera el suyo con `crypto.randomUUID()` en el momento de
 * emitir) — se prueba `booking_receipts` primero y solo se cae a
 * `renewal_receipts` si no hubo match, no hace falta desambiguar.
 */
export default async function VerifyReceiptPage({
  params,
}: {
  params: Promise<{ verification_code: string }>;
}) {
  const { verification_code: code } = await params;
  const admin = getSupabaseAdmin();

  const bookingReceipt = admin
    ? (
        await admin
          .from("booking_receipts")
          .select("status, receipt_number, issued_at, voided_at, residence_id, receipt_payload, residences(name)")
          .eq("verification_code", code)
          .maybeSingle()
      ).data
    : null;

  const renewalReceipt =
    admin && !bookingReceipt
      ? (
          await admin
            .from("renewal_receipts")
            .select("status, receipt_number, issued_at, voided_at, receipt_payload")
            .eq("verification_code", code)
            .maybeSingle()
        ).data
      : null;

  const receipt = bookingReceipt ?? renewalReceipt;
  const isRenewal = !bookingReceipt && !!renewalReceipt;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-14 sm:px-6">
      <Card className="w-full p-8 text-center">
        {!receipt ? (
          <>
            <Badge tone="neutral">Código inválido</Badge>
            <h1 className="mt-4 text-xl font-bold text-petrol-800">No encontramos ese comprobante</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Revisá que el código o el enlace estén completos. Si creés que es un error, contactá a
              soporte de EstuRed.
            </p>
          </>
        ) : receipt.status === "voided" ? (
          <>
            <Badge tone="danger">Anulado</Badge>
            <h1 className="mt-4 text-xl font-bold text-petrol-800">Este comprobante fue anulado</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Ya no es válido como respaldo de una reserva confirmada.
            </p>
          </>
        ) : receipt.status === "reissued" ? (
          <>
            <Badge tone="neutral">Reemitido</Badge>
            <h1 className="mt-4 text-xl font-bold text-petrol-800">Este comprobante fue reemitido</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Ya no es el vigente. Pedile al titular el enlace del comprobante actualizado.
            </p>
          </>
        ) : (
          <>
            <Badge tone="sage">Válido</Badge>
            <h1 className="mt-4 text-xl font-bold text-petrol-800">
              {isRenewal ? "Comprobante de Renovación Confirmada" : "Comprobante de Reserva Confirmada"}
            </h1>
            <dl className="mt-6 space-y-3 text-left text-sm">
              <div className="flex justify-between border-b border-sand-200 pb-2">
                <dt className="text-ink-faint">Residencia</dt>
                <dd className="font-medium text-ink">
                  {isRenewal
                    ? (receipt.receipt_payload as { residence?: { name?: string } })?.residence?.name
                    : (("residences" in receipt ? receipt.residences : null) as { name: string } | null)?.name}
                </dd>
              </div>
              <div className="flex justify-between border-b border-sand-200 pb-2">
                <dt className="text-ink-faint">Estudiante</dt>
                <dd className="font-medium text-ink">
                  {(receipt.receipt_payload as { student?: { first_name?: string; last_initial?: string } })
                    ?.student?.first_name}{" "}
                  {(receipt.receipt_payload as { student?: { last_initial?: string } })?.student?.last_initial}
                </dd>
              </div>
              {isRenewal ? (
                <>
                  <div className="flex justify-between border-b border-sand-200 pb-2">
                    <dt className="text-ink-faint">Nuevo período</dt>
                    <dd className="font-medium text-ink">
                      {(receipt.receipt_payload as { period_start_date?: string })?.period_start_date} →{" "}
                      {(receipt.receipt_payload as { period_end_date?: string })?.period_end_date}
                    </dd>
                  </div>
                  <div className="flex justify-between border-b border-sand-200 pb-2">
                    <dt className="text-ink-faint">Duración</dt>
                    <dd className="font-medium text-ink">
                      {(receipt.receipt_payload as { duration_months?: number })?.duration_months} meses
                    </dd>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between border-b border-sand-200 pb-2">
                    <dt className="text-ink-faint">Tipo de habitación</dt>
                    <dd className="font-medium text-ink">
                      {(receipt.receipt_payload as { room_type?: string })?.room_type}
                    </dd>
                  </div>
                  <div className="flex justify-between border-b border-sand-200 pb-2">
                    <dt className="text-ink-faint">Fecha de ingreso</dt>
                    <dd className="font-medium text-ink">
                      {(receipt.receipt_payload as { desired_start_date?: string })?.desired_start_date}
                    </dd>
                  </div>
                  <div className="flex justify-between border-b border-sand-200 pb-2">
                    <dt className="text-ink-faint">Duración inicial</dt>
                    <dd className="font-medium text-ink">
                      {(receipt.receipt_payload as { initial_duration_months?: number })?.initial_duration_months}{" "}
                      meses
                    </dd>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-faint">Emitido</dt>
                <dd className="font-medium text-ink">
                  {receipt.issued_at && new Date(receipt.issued_at).toLocaleDateString("es-AR")}
                </dd>
              </div>
            </dl>
            <p className="mt-6 text-xs text-ink-faint">Comprobante N.º {receipt.receipt_number}</p>
          </>
        )}
      </Card>
      <p className="mt-6 text-center text-xs text-ink-faint">
        EstuRed actúa como plataforma intermediaria. No presta directamente el alojamiento ni
        garantiza la conducta de las partes.
      </p>
    </div>
  );
}
