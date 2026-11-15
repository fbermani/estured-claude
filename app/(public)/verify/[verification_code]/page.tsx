import { formatDate } from "@/lib/dates/format";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BrandMark } from "@/components/ui/BrandMark";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import {
  lookupPublicReceipt,
  parseReceiptReference,
  type PublicReceiptResult,
} from "@/lib/receipts/verifyLookup";
import { clientKeyFromHeaders, verifyByNumberAllowed } from "@/lib/receipts/verifyRateLimit";

export const metadata: Metadata = { title: "Verificar comprobante" };
export const dynamic = "force-dynamic";

/**
 * Docs/08 §4.6 — pública, sin login. Acepta el código del QR/enlace (UUID) o
 * el número impreso en el comprobante (`ER-2026-XXXXX-XXXXX`, H14). Proyecta a mano
 * solo los campos mínimos permitidos (nunca montos, documentos ni datos de
 * contacto) — ver `lookupPublicReceipt` para la política completa: por número
 * se muestra aún menos que por código, porque el número es más corto y
 * por lo tanto más fácil de barrer.
 */
export default async function VerifyReceiptPage({
  params,
}: {
  params: Promise<{ verification_code: string }>;
}) {
  const { verification_code: raw } = await params;
  const reference = parseReceiptReference(raw);

  let rateLimited = false;
  let result: PublicReceiptResult = { found: false };

  if (reference) {
    if (reference.kind === "number") {
      if (!verifyByNumberAllowed(clientKeyFromHeaders(await headers()))) rateLimited = true;
    }
    if (!rateLimited) {
      const admin = getSupabaseAdmin();
      // Sin cliente admin (env vars faltantes) tampoco se pudo consultar: no es "no existe".
      result = admin ? await lookupPublicReceipt(admin, reference) : { found: false, unavailable: true };
    }
  }
  const byNumber = reference?.kind === "number";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-14 sm:px-6">
      <Card className="w-full p-8 text-center">
        <BrandMark size={28} className="mb-5 justify-center" />
        {rateLimited ? (
          <>
            <Badge tone="neutral">Demasiadas consultas</Badge>
            <h1 className="mt-4 text-xl font-bold text-ink">Esperá un minuto y probá de nuevo</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Hiciste varias consultas seguidas. Si tenés el enlace o el QR del comprobante, usalo directamente.
            </p>
          </>
        ) : !result.found && result.unavailable ? (
          <>
            <Badge tone="neutral">No disponible</Badge>
            <h1 className="mt-4 text-xl font-bold text-ink">No pudimos verificar ahora</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Probá de nuevo en unos minutos. Si el problema sigue, escribile a Soporte de EstuRed.
            </p>
          </>
        ) : !result.found ? (
          <>
            <Badge tone="neutral">{reference ? "No encontrado" : "Código inválido"}</Badge>
            <h1 className="mt-4 text-xl font-bold text-ink">No encontramos ese comprobante</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Revisá que el número, el código o el enlace estén completos. Si creés que es un error, escribile a
              Soporte de EstuRed.
            </p>
            <Link href="/verify" className="mt-4 inline-block text-sm font-semibold text-forest-700 underline">
              Probar con otro número
            </Link>
          </>
        ) : result.status === "voided" ? (
          <>
            <Badge tone="danger">Anulado</Badge>
            <h1 className="mt-4 text-xl font-bold text-ink">Este comprobante fue anulado</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Ya no es válido como respaldo de una reserva confirmada.
            </p>
            <p className="mt-4 text-xs text-ink-faint">Comprobante N.º {result.receiptNumber}</p>
          </>
        ) : result.status === "reissued" ? (
          <>
            <Badge tone="neutral">Reemitido</Badge>
            <h1 className="mt-4 text-xl font-bold text-ink">Este comprobante fue reemitido</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Ya no es el vigente. Pedile al titular el enlace del comprobante actualizado.
            </p>
            <p className="mt-4 text-xs text-ink-faint">Comprobante N.º {result.receiptNumber}</p>
          </>
        ) : byNumber ? (
          // Por número NO se muestra "Válido": un número real no prueba que el PDF o la hoja que tenés sea
          // auténtico (alguien podría copiarlo). Solo el QR/enlace identifica a quién corresponde.
          <>
            <Badge tone="neutral">Número encontrado</Badge>
            <h1 className="mt-4 text-xl font-bold text-ink">Existe un comprobante con este número</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Para confirmar a quién corresponde, escaneá el QR del comprobante o abrí su enlace de verificación.
            </p>
            <p className="mt-4 text-xs text-ink-faint">Comprobante N.º {result.receiptNumber}</p>
          </>
        ) : (
          <>
            <Badge tone="sage">Válido</Badge>
            <h1 className="mt-4 text-xl font-bold text-ink">
              {result.receiptKind === "renewal"
                ? "Comprobante de Renovación Confirmada"
                : "Comprobante de Reserva Confirmada"}
            </h1>
            <dl className="mt-6 space-y-3 text-left text-sm">
              <div className="flex justify-between border-b border-sand-200 pb-2">
                <dt className="text-ink-faint">Residencia</dt>
                <dd className="font-medium text-ink">{result.residenceName ?? "—"}</dd>
              </div>
              {result.detail && (
                <>
                  <div className="flex justify-between border-b border-sand-200 pb-2">
                    <dt className="text-ink-faint">Estudiante</dt>
                    <dd className="font-medium text-ink">{result.detail.studentLabel ?? "—"}</dd>
                  </div>
                  {result.receiptKind === "renewal" ? (
                    <>
                      <div className="flex justify-between border-b border-sand-200 pb-2">
                        <dt className="text-ink-faint">Nuevo período</dt>
                        <dd className="font-medium text-ink">
                          {result.detail.periodStartDate} → {result.detail.periodEndDate}
                        </dd>
                      </div>
                      <div className="flex justify-between border-b border-sand-200 pb-2">
                        <dt className="text-ink-faint">Duración</dt>
                        <dd className="font-medium text-ink">{result.detail.durationMonths} meses</dd>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between border-b border-sand-200 pb-2">
                        <dt className="text-ink-faint">Tipo de habitación</dt>
                        <dd className="font-medium text-ink">{result.detail.roomType ?? "—"}</dd>
                      </div>
                      <div className="flex justify-between border-b border-sand-200 pb-2">
                        <dt className="text-ink-faint">Fecha de ingreso</dt>
                        <dd className="font-medium text-ink">
                          {result.detail.desiredStartDate ? formatDateOnly(result.detail.desiredStartDate) : "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between border-b border-sand-200 pb-2">
                        <dt className="text-ink-faint">Duración inicial</dt>
                        <dd className="font-medium text-ink">{result.detail.initialDurationMonths} meses</dd>
                      </div>
                    </>
                  )}
                </>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-faint">Emitido</dt>
                <dd className="font-medium text-ink">
                  {result.issuedAt ? formatDate(result.issuedAt) : "—"}
                </dd>
              </div>
            </dl>
            <p className="mt-6 text-xs text-ink-faint">Comprobante N.º {result.receiptNumber}</p>
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
