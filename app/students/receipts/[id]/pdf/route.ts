import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { getSupabaseServer } from "@/lib/supabase/server";
import { ReceiptPdfDocument, type ReceiptPdfPayload } from "@/lib/receipts/ReceiptPdfDocument";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "No disponible." }, { status: 503 });

  const { data: receipt } = await supabase
    .from("booking_receipts")
    .select("status, receipt_number, verification_code, qr_code_value, issued_at, receipt_payload")
    .eq("id", id)
    .maybeSingle();
  if (!receipt) return NextResponse.json({ error: "Comprobante no encontrado." }, { status: 404 });

  const qrDataUrl = await QRCode.toDataURL(receipt.qr_code_value, { margin: 1, width: 240 });

  const buffer = await renderToBuffer(
    ReceiptPdfDocument({
      receiptNumber: receipt.receipt_number,
      status: receipt.status,
      issuedAt: receipt.issued_at,
      payload: receipt.receipt_payload as ReceiptPdfPayload,
      qrDataUrl,
      verificationUrl: receipt.qr_code_value,
    }),
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="comprobante-${receipt.receipt_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
