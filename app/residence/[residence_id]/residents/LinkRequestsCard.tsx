"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Input";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  regenerateHouseCodeAction,
  resolveLinkRequestAction,
  type ResidentsActionState,
} from "@/app/residence/[residence_id]/residents/actions";

const initialState: ResidentsActionState = { status: "idle" };

export type LinkRequestItem = { id: string; studentName: string; message: string | null; viaHouseCode: boolean; createdAt: string; matchedStayId?: string | null };
export type UnlinkedStay = { id: string; label: string };

function DecisionButton({ value, tone, children }: { value: "approve" | "reject"; tone: "primary" | "ghost"; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="decision"
      value={value}
      disabled={pending}
      className={
        tone === "primary"
          ? "inline-flex cursor-pointer items-center rounded-full bg-forest px-4 py-2 text-sm font-bold text-white hover:bg-forest-600 disabled:opacity-50"
          : "inline-flex cursor-pointer items-center rounded-full border-[1.5px] border-line px-4 py-2 text-sm font-bold text-ink-soft hover:border-danger-fg hover:text-danger-fg disabled:opacity-50"
      }
    >
      {children}
    </button>
  );
}

function RequestRow({ residenceId, item, stays }: { residenceId: string; item: LinkRequestItem; stays: UnlinkedStay[] }) {
  const [state, action] = useActionState(resolveLinkRequestAction.bind(null, residenceId, item.id), initialState);
  return (
    <li className="rounded-field border border-line bg-paper p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-bold text-ink">{item.studentName}</p>
        <span className="rounded-full bg-cream-2 px-2.5 py-0.5 text-xs font-bold text-ink-soft">
          {item.matchedStayId ? "Llegó con el enlace de un residente cargado sin mail" : item.viaHouseCode ? "Usó el código de casa" : "Eligió tu residencia"}
        </span>
      </div>
      {item.message && <p className="mt-1 text-sm text-ink-soft">“{item.message}”</p>}
      <form action={action} className="mt-3 space-y-3">
        <details open={!!item.matchedStayId}>
          <summary className="cursor-pointer text-sm font-semibold text-ink-soft hover:text-ink">¿Ya lo cargaste como residente? Unirlo a esa estadía</summary>
          <div className="mt-2 max-w-sm">
            <Select label="Estadía sin cuenta" name="stay_id" defaultValue={item.matchedStayId ?? ""}>
              <option value="">No: crear una estadía nueva</option>
              {stays.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
        </details>
        <div className="flex flex-wrap items-center gap-2">
          <DecisionButton value="approve" tone="primary">
            Aprobar vínculo
          </DecisionButton>
          <DecisionButton value="reject" tone="ghost">
            Rechazar
          </DecisionButton>
        </div>
        {state.status === "error" && (
          <p role="alert" className="text-sm font-medium text-danger-fg">
            {state.message}
          </p>
        )}
        {state.status === "saved" && <p className="text-sm font-medium text-forest-700">{state.message}</p>}
      </form>
    </li>
  );
}

/**
 * Solicitudes de vínculo (DR19): estudiantes que dicen vivir acá y se registraron solos. Nada se vincula hasta que la residencia aprueba;
 * confirmá que realmente vive en la residencia antes de aprobar.
 */
export function LinkRequestsCard({ residenceId, requests, stays }: { residenceId: string; requests: LinkRequestItem[]; stays: UnlinkedStay[] }) {
  if (requests.length === 0) return null;
  return (
    <Card className="mb-6 border-2 border-amber-soft-300 p-5">
      <div className="flex items-start gap-3">
        <Icon name="how_to_reg" className="mt-0.5 text-2xl text-forest-700" />
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-ink">
            Solicitudes de vínculo <span className="ml-1 rounded-full bg-forest px-2 py-0.5 text-xs text-white">{requests.length}</span>
          </h2>
          <p className="mt-1 text-sm text-ink-soft">Dicen vivir en tu residencia. Aprobá solo si los reconocés: al aprobar figuran como residentes.</p>
          <ul className="mt-4 space-y-3">
            {requests.map((r) => (
              <RequestRow key={r.id} residenceId={residenceId} item={r} stays={stays} />
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}

/** Código de casa: se lo das a quien vive acá para que llegue directo a tu residencia (igual pasa por tu aprobación). */
export function HouseCodeCard({ residenceId, code }: { residenceId: string; code: string | null }) {
  const [state, action, pending] = useActionState(regenerateHouseCodeAction.bind(null, residenceId), initialState);
  const current = state.status === "saved" && state.message ? state.message : code;
  return (
    <Card className="mb-6 p-5">
      <div className="flex flex-wrap items-center gap-4">
        <Icon name="pin" className="text-2xl text-forest-700" />
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-ink">Código de casa</h2>
          <p className="mt-0.5 text-sm text-ink-soft">Para residentes que se registran solos: con este código llegan directo a tu residencia. Igual tenés que aprobarlos.</p>
        </div>
        {current ? (
          <div className="flex items-center gap-2">
            <span className="rounded-field bg-cream-2 px-3 py-1.5 font-mono text-lg font-bold tracking-widest text-ink">{current}</span>
            <CopyButton value={current} label="el código de casa" />
          </div>
        ) : null}
        <form action={action}>
          <button type="submit" disabled={pending} className="inline-flex cursor-pointer items-center rounded-full border-[1.5px] border-line px-4 py-2 text-sm font-bold text-ink-soft hover:border-forest hover:text-forest-700 disabled:opacity-50">
            {pending ? "Generando…" : current ? "Generar uno nuevo" : "Generar código"}
          </button>
        </form>
      </div>
      {current && <p className="mt-2 text-xs text-ink-faint">Si lo cambiás, el anterior deja de funcionar.</p>}
      {state.status === "error" && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}
    </Card>
  );
}
