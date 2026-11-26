"use client";

import { formatShortName } from "@/lib/format/shortName";
import { useActionState, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatUsd } from "@/lib/mock/exchange";
import {
  createFamilyProposal,
  type CreateFamilyProposalState,
} from "@/app/students/family-proposals/actions";
import { useReservationSelection } from "@/components/residences/reservationSelection";
import type { VacancyOutlook } from "@/lib/applications/emptyMonths";
import { CostBreakdown, type CostBreakdownConditions } from "@/components/residences/ficha/CostBreakdown";
import { STALE_NOTICE, isStaleBlocked, isTypeRequestable, typeAvailabilityState } from "@/lib/availability/typeAvailability";

interface RoomTypeOption {
  id: string;
  name: string;
  monthly_price_usd: number;
  /** Promoción vigente (DR18 t3): % sobre la tarifa de lista; el servidor la vuelve a resolver al enviar. */
  promotion_percent?: number | null;
  /** Ocupación futura del tipo (la arma el servidor); null/ausente = «a confirmar». */
  vacancy?: VacancyOutlook | null;
  profile_availability: { status: string; hidden_from_search_at?: string | null } | null;
}
interface StudentOption {
  id: string;
  first_name: string;
  last_initial: string;
}

/** Condiciones de la residencia que alimentan el desglose de costos (DR4) y la estadía mínima. */
interface ProposeConditions extends CostBreakdownConditions {
  minimumStayMonths: number | null;
}

const initialState: CreateFamilyProposalState = { status: "idle" };

export function ProposeForm({
  residenceId,
  roomTypes,
  students,
  conditions,
  arsPerUsd,
  moveInNotice,
}: {
  residenceId: string;
  /** Aviso de lectura (guía de mudanza) antes de la fecha; lo arma el servidor. */
  moveInNotice?: ReactNode;
  roomTypes: RoomTypeOption[];
  students: StudentOption[];
  conditions: ProposeConditions;
  arsPerUsd: number;
}) {
  const action = createFamilyProposal.bind(null, residenceId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  const availableTypes = roomTypes.filter((rt) =>
    isTypeRequestable(typeAvailabilityState(rt.profile_availability?.status), !!rt.profile_availability?.hidden_from_search_at),
  );
  // El tipo elegido en la tabla de tarifas / la card llega preseleccionado (mismo estado que `ApplyForm`).
  const { roomTypeId: contextRoomTypeId, setRoomTypeId } = useReservationSelection();
  const roomTypeId = availableTypes.some((rt) => rt.id === contextRoomTypeId) ? (contextRoomTypeId as string) : "";
  const [duration, setDuration] = useState(Math.min(24, Math.max(6, conditions.minimumStayMonths ?? 1)));
  const [startDate, setStartDate] = useState("");

  const selectedType = availableTypes.find((rt) => rt.id === roomTypeId) ?? null;

  if (students.length === 0) {
    return (
      <p className="px-5 py-5 text-sm text-ink-soft sm:px-6">
        Necesitás tener al menos un estudiante vinculado activo para proponerle una residencia.
      </p>
    );
  }
  if (roomTypes.length === 0) {
    return <p className="px-5 py-5 text-sm text-ink-soft sm:px-6">Esta residencia todavía no cargó tipos de habitación.</p>;
  }
  if (availableTypes.length === 0) {
    const stale = roomTypes.some((rt) =>
      isStaleBlocked(typeAvailabilityState(rt.profile_availability?.status), !!rt.profile_availability?.hidden_from_search_at),
    );
    return (
      <p className="px-5 py-5 text-sm text-ink-soft sm:px-6">
        {stale ? STALE_NOTICE : "Ningún tipo de habitación tiene disponibilidad informada por ahora."}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 sm:px-6">
      <p className="text-xs text-ink-faint">
        Le va a llegar como sugerencia a tu estudiante — recién se convierte en solicitud real si él o ella
        la aprueba, y en ese caso la residencia te va a contactar a vos.
      </p>
      {students.length > 1 && (
        <Select label="Estudiante" id="propose-student" name="student_profile_id" required defaultValue="">
          <option value="" disabled>
            Elegí a quién le proponés esto
          </option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {formatShortName(s.first_name, s.last_initial)}
            </option>
          ))}
        </Select>
      )}
      {students.length === 1 && <input type="hidden" name="student_profile_id" value={students[0].id} />}
      <div className="grid gap-4 sm:grid-cols-2">
      <Input
        label="Fecha de ingreso propuesta"
        id="propose-start-date"
        name="desired_start_date"
        type="date"
        required
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
      />
      <Input
        label="Duración propuesta (meses)"
        id="propose-duration"
        name="initial_duration_months"
        type="number"
        inputMode="numeric"
        enterKeyHint="done"
        min={conditions.minimumStayMonths ?? 1}
        max={24}
        value={duration}
        onChange={(e) => setDuration(Number(e.target.value) || 0)}
        required
        hint={
          conditions.minimumStayMonths
            ? `Esta residencia pide una estadía mínima de ${conditions.minimumStayMonths} meses.`
            : undefined
        }
      />
      </div>
      {moveInNotice}
      <Select
        label="Tipo de habitación"
        id="propose-room-type"
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
      {selectedType && duration > 0 && (
        <CostBreakdown
          monthlyUsd={Number(selectedType.monthly_price_usd)}
          promotionPercent={selectedType.promotion_percent ?? null}
          vacancy={selectedType.vacancy ?? null}
          duration={duration}
          startDate={startDate}
          conditions={conditions}
          arsPerUsd={arsPerUsd}
          submitNoun="propuesta"
        />
      )}
      <Textarea
        label="Mensaje para tu estudiante (opcional)"
        id="propose-message"
        name="message_to_student"
        rows={3}
        placeholder="Ej: Vi esta residencia, está cerca de tu facultad y dentro del presupuesto."
      />

      </div>

      <div className="flex shrink-0 flex-col gap-3 border-t border-line bg-paper px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-6px_16px_rgb(29_39_34/0.05)] sm:px-6">
        {state.status === "error" && (
          <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
            {state.message}
          </p>
        )}
        <Button type="submit" variant="cta" size="cta" disabled={isPending}>
          {isPending ? "Enviando…" : "Enviar propuesta al estudiante"}
        </Button>
      </div>
    </form>
  );
}
