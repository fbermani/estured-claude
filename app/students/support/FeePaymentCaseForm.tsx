"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { openFeePaymentCase, type OpenCaseState } from "@/app/students/support/actions";

const initialState: OpenCaseState = { status: "idle" };

/**
 * D2 / H02 — "Tengo un problema con el pago": el fee lo cobra EstuRed, así que
 * esto es una consulta a EstuRed (no un reclamo contra la residencia): sin
 * residencia que elegir ni recordatorio de deslinde.
 */
export function FeePaymentCaseForm({
  reservationId,
  reference,
  residenceName,
  defaultDescription,
}: {
  reservationId: string;
  reference: string;
  residenceName: string | null;
  defaultDescription: string;
}) {
  const [state, formAction, isPending] = useActionState(openFeePaymentCase, initialState);

  if (state.status === "saved") {
    return (
      <div role="status" className="rounded-card border-[1.5px] border-line bg-forest-tint p-6 text-sm font-medium text-forest-700">
        {state.message}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-card border-[1.5px] border-line bg-paper p-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <Icon name="support_agent" className="text-xl text-forest-700" /> Escribile a EstuRed
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          El fee EstuRed lo cobra EstuRed, no la residencia: tu consulta llega directo a nuestro equipo y la
          residencia no la ve.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-field bg-cream-2 p-4 text-sm">
        <div>
          <dt className="text-xs text-ink-faint">Referencia de la reserva</dt>
          <dd className="font-mono font-bold text-ink">{reference}</dd>
        </div>
        {residenceName && (
          <div>
            <dt className="text-xs text-ink-faint">Reserva en</dt>
            <dd className="font-semibold text-ink">{residenceName}</dd>
          </div>
        )}
      </dl>
      <input type="hidden" name="reservation_id" value={reservationId} />

      <Textarea label="Contanos qué pasó con el pago" name="description" rows={5} required minLength={20} defaultValue={defaultDescription} />

      <div>
        <label className="text-sm font-medium text-ink" htmlFor="evidence">
          Comprobante o captura (opcional)
        </label>
        <input
          id="evidence"
          name="evidence"
          type="file"
          multiple
          accept="application/pdf,image/*"
          className="mt-1.5 block w-full text-sm text-ink-soft file:mr-3 file:rounded-field file:border-0 file:bg-forest-tint file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-forest-700"
        />
      </div>

      {state.status === "error" && (
        <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Enviando…" : "Escribirle a EstuRed"}
        </Button>
        <Link href="/students/support" className="text-sm font-semibold text-forest-700 hover:underline">
          Es un reclamo sobre una residencia
        </Link>
      </div>
    </form>
  );
}
