import QRCode from "qrcode";
import { Icon } from "@/components/ui/Icon";
import { BrandMark } from "@/components/ui/BrandMark";
import { EsturedSeal } from "@/components/brand/EsturedSeal";
import { SITE_URL } from "@/lib/siteUrl";
import { buildReceiptRows, type ReceiptPayload } from "@/lib/receipts/receiptView";

/**
 * Miniatura del Comprobante de Reserva Confirmada para la home. Las filas salen del mismo
 * `buildReceiptRows` que usan la pantalla y el PDF reales, con datos de ejemplo (rotulados).
 * No es un comprobante emitido: el QR apunta a /verify, sin código. Lleva el logo de EstuRed arriba y el sello abajo a la derecha.
 */
const SAMPLE: ReceiptPayload = {
  student: { first_name: "Lucía", last_initial: "M." },
  residence: { name: "Casa Colegiales", public_area: "Colegiales" },
  room_type: "Doble",
  desired_start_date: "2027-03-01",
  initial_duration_months: 6,
  final_conditions: { monthly_price_usd: 250, monthly_price_ars: 375000, exchange_rate_ars_per_usd: 1500 },
  estured_fee: { amount_usd: 75, currency: "USD" },
};
const SAMPLE_NUMBER = "ER-2026-7K3QM-9XJ4A";
const SHOWN = ["Estudiante", "Residencia", "Tipo de habitación", "Fecha de ingreso", "Duración inicial", "Tarifa mensual acordada", "Fee EstuRed pagado"];

export async function ReceiptMiniature() {
  const rows = buildReceiptRows(SAMPLE).filter((r) => SHOWN.includes(r.label));
  const qr = await QRCode.toDataURL(`${SITE_URL}/verify`, { margin: 1, width: 120 });
  return (
    <figure className="relative m-0 flex h-full flex-col rounded-card border border-sand-200 bg-paper p-4 shadow-card lg:-rotate-1 lg:transition-transform lg:duration-500 lg:hover:rotate-0">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="rounded-md bg-amber-soft-100 px-2 py-0.5 text-xs font-bold text-amber-soft-700">Datos de ejemplo</span>
        <BrandMark size={22} />
      </div>
      <div className="flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-forest-tint text-forest-700">
          <Icon name="receipt_long" className="text-lg" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-sm font-bold leading-tight text-ink">Comprobante de Reserva Confirmada</p>
          <p className="text-xs text-ink-faint">
            N.º <span className="font-mono font-medium text-ink">{SAMPLE_NUMBER}</span>
          </p>
        </div>
      </div>
      <dl className="mt-3 space-y-1.5 text-xs">
        {rows.map((row, i) => (
          <div key={row.label} className={`flex justify-between gap-3 ${i < rows.length - 1 ? "border-b border-sand-200 pb-1.5" : ""}`}>
            <dt className="text-ink-faint">{row.label}</dt>
            <dd className="text-right font-medium text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-auto flex items-center gap-3 pt-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="" width={64} height={64} className="rounded-field border border-sand-200" />
        <figcaption className="min-w-0 flex-1 text-xs leading-snug text-ink-faint">
          Con código y QR propios
        </figcaption>
        <EsturedSeal size={76} className="-mb-1 -mr-1 shrink-0" />
      </div>
    </figure>
  );
}
