"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatArs, formatUsd, usdToArs } from "@/lib/mock/exchange";
import { calculateFeeEstimate } from "@/lib/applications/fee";
import {
  createApplicationRequest,
  type CreateApplicationState,
} from "@/app/students/applications/actions";
import { JoinWaitlistForm } from "@/app/(public)/residencias/[slug]/JoinWaitlistForm";

interface RoomTypeOption {
  id: string;
  name: string;
  monthly_price_usd: number;
  enrollment_fee_usd?: number | null;
  deposit_usd?: number | null;
  profile_availability: { status: string } | null;
}

const initialState: CreateApplicationState = { status: "idle" };

/**
 * Formulario de solicitud con resumen de costos en vivo — a semejanza
 * del panel "Tu Solicitud de Reserva" de la referencia
 * `estured_search_results_buenos_aires_3`. Diferencia deliberada con la
 * referencia: acá NO hay "total a pagar ahora" — enviar la solicitud no
 * cuesta nada y el fee se abona recién si la residencia confirma
 * (docs/00 §12), así que el fee se muestra como estimado informativo.
 */
export function ApplyForm({
  residenceId,
  roomTypes,
  arsPerUsd,
  preselectedRoomTypeId,
}: {
  residenceId: string;
  roomTypes: RoomTypeOption[];
  arsPerUsd: number;
  preselectedRoomTypeId?: string;
}) {
  const action = createApplicationRequest.bind(null, residenceId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  const availableTypes = roomTypes.filter((rt) => rt.profile_availability?.status !== "full");
  const validPreselected = availableTypes.some((rt) => rt.id === preselectedRoomTypeId)
    ? (preselectedRoomTypeId as string)
    : "";
  const [roomTypeId, setRoomTypeId] = useState(validPreselected);
  const [duration, setDuration] = useState(6);

  if (roomTypes.length === 0) {
    return <p className="text-sm text-ink-soft">Esta residencia todavía no cargó tipos de habitación.</p>;
  }
  if (availableTypes.length === 0) {
    return <JoinWaitlistForm residenceId={residenceId} roomTypes={roomTypes} />;
  }

  const selected = availableTypes.find((rt) => rt.id === roomTypeId) ?? null;
  const monthlyUsd = selected ? Number(selected.monthly_price_usd) : 0;
  const enrollmentUsd = selected?.enrollment_fee_usd != null ? Number(selected.enrollment_fee_usd) : null;
  const depositUsd = selected?.deposit_usd != null ? Number(selected.deposit_usd) : null;
  const fee =
    selected && duration > 0
      ? calculateFeeEstimate({
          monthlyPriceUsd: monthlyUsd,
          durationMonths: duration,
          enrollmentFeeUsd: enrollmentUsd,
          arsPerUsd,
        })
      : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h3 className="font-bold text-ink">Enviar solicitud de reserva</h3>
      <Select
        label="Tipo de habitación"
        id="apply-room-type"
        name="room_type_id"
        required
        value={roomTypeId}
        onChange={(e) => setRoomTypeId(e.target.value)}
      >
        <option value="" disabled>
          Elegí una opción
        </option>
        {availableTypes.map((rt) => (
          <option key={rt.id} value={rt.id}>
            {rt.name} — {formatUsd(Number(rt.monthly_price_usd))}/mes
          </option>
        ))}
      </Select>
      <Input
        label="Fecha de ingreso deseada"
        id="apply-start-date"
        name="desired_start_date"
        type="date"
        required
      />
      <Input
        label="Duración estimada (meses)"
        id="apply-duration"
        name="initial_duration_months"
        type="number"
        min={1}
        max={24}
        value={duration}
        onChange={(e) => setDuration(Number(e.target.value) || 0)}
        required
      />

      {selected && (
        <div className="rounded-field border border-line bg-cream-2 p-4 text-sm">
          <div className="flex items-center justify-between py-1">
            <span className="text-ink-soft">Renta mensual</span>
            <span className="text-right font-bold text-ink">
              {formatUsd(monthlyUsd)}
              <span className="block text-xs font-normal text-ink-faint">
                ≈ {formatArs(usdToArs(monthlyUsd, arsPerUsd))}
              </span>
            </span>
          </div>
          {enrollmentUsd != null && enrollmentUsd > 0 && (
            <div className="flex items-center justify-between border-t border-line py-1.5">
              <span className="text-ink-soft">Matrícula (única vez)</span>
              <span className="font-bold text-ink">{formatUsd(enrollmentUsd)}</span>
            </div>
          )}
          {depositUsd != null && depositUsd > 0 && (
            <div className="flex items-center justify-between border-t border-line py-1.5">
              <span className="text-ink-soft">Depósito (reembolsable)</span>
              <span className="font-bold text-ink">{formatUsd(depositUsd)}</span>
            </div>
          )}
          {fee && duration > 0 && (
            <div className="mt-1 rounded-field bg-forest-tint/60 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-forest-700">Fee EstuRed estimado (5%)</span>
                <span className="font-bold text-forest-700">{formatArs(fee.estimatedFeeArs)}</span>
              </div>
              <p className="mt-1 text-xs leading-snug text-forest-700/90">
                Sobre {duration} {duration === 1 ? "mes" : "meses"} de estadía. Enviar la solicitud no
                cuesta nada: el fee se abona recién si la residencia confirma tu reserva.
              </p>
            </div>
          )}
        </div>
      )}

      <Textarea
        label="¿Cuál es tu objetivo académico?"
        id="apply-objective"
        name="academic_objective"
        rows={3}
        placeholder="Ej: Iniciar mi carrera universitaria en CABA durante el ciclo lectivo actual."
        hint="Obligatorio — se usa para tu comprobante de reserva."
        required
      />

      {state.status === "error" && (
        <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Enviando…" : "Enviar solicitud de reserva"}
      </Button>
    </form>
  );
}
