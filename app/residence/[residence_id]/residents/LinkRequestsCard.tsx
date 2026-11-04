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
          ? "inline-flex min-h-11 cursor-pointer items-center rounded-full bg-(--tone) px-4 text-sm font-bold text-white transition duration-200 ease-out-fresh motion-safe:active:scale-[0.97] hover:-translate-y-px hover:bg-(--tone-600) focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--tone) disabled:opacity-50"
          : "inline-flex min-h-11 cursor-pointer items-center rounded-full border-[1.5px] border-line-2 bg-paper px-4 text-sm font-bold text-ink-soft hover:border-danger-fg hover:text-danger-fg focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--tone) disabled:opacity-50"
      }
    >
      {children}
    </button>
  );
}

function RequestRow({ residenceId, item, stays }: { residenceId: string; item: LinkRequestItem; stays: UnlinkedStay[] }) {
  const [state, action] = useActionState(resolveLinkRequestAction.bind(null, residenceId, item.id), initialState);
  return (
    <li className="rounded-[18px] border border-line bg-paper p-4 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="flex flex-wrap items-center gap-2.5">
        <span aria-hidden="true" className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-(--tone-tint) font-display text-[15px] font-bold text-(--tone-700)">
          {item.studentName.charAt(0).toUpperCase()}
        </span>
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
    <section aria-labelledby="vinculos-por-revisar" className="mb-6 grid gap-3 rounded-[30px] border-[1.5px] border-amber-soft-300 bg-gradient-to-b from-amber-soft-100 to-paper to-60% p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="vinculos-por-revisar" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <Icon name="link" className="text-2xl text-amber-soft-700" />
          Solicitudes de vínculo
        </h2>
        <span className="rounded-full bg-butter px-2.5 py-1 text-xs font-bold text-butter-fg">{requests.length} por revisar</span>
      </div>
      <p className="-mt-1 text-sm text-ink-soft">Dicen vivir en tu residencia. Aprobá solo si los reconocés.</p>
      <ul className="grid gap-2.5">
        {requests.map((r) => (
          <RequestRow key={r.id} residenceId={residenceId} item={r} stays={stays} />
        ))}
      </ul>
    </section>
  );
}

/** Código de casa: se lo das a quien vive acá para que llegue directo a tu residencia (igual pasa por tu aprobación). */
export function HouseCodeCard({ residenceId, code }: { residenceId: string; code: string | null }) {
  const [state, action, pending] = useActionState(regenerateHouseCodeAction.bind(null, residenceId), initialState);
  const current = state.status === "saved" && state.message ? state.message : code;
  return (
    <Card className="mb-6 p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex size-11 items-center justify-center rounded-[14px] bg-(--tone-tint) text-(--tone-700)"><Icon name="pin" className="text-2xl" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-ink">Código de casa</h2>
          <p className="mt-0.5 text-sm text-ink-soft">Con este código, quien se registra solo llega directo a tu residencia.</p>
        </div>
        {current ? (
          <div className="flex items-center gap-2">
            <span className="rounded-field bg-cream-2 px-3 py-1.5 font-mono text-lg font-bold tracking-widest text-ink">{current}</span>
            <CopyButton value={current} label="el código de casa" />
          </div>
        ) : null}
        <form action={action}>
          <button type="submit" disabled={pending} className="inline-flex min-h-11 cursor-pointer items-center rounded-full border-[1.5px] border-line-2 px-4 text-sm font-bold text-ink-soft hover:border-(--tone) hover:text-(--tone-700) focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--tone) disabled:opacity-50">
            {pending ? "Generando…" : current ? "Generar uno nuevo" : "Generar código"}
          </button>
        </form>
      </div>
      {current && <p className="mt-2 text-xs text-ink-faint">Igual tenés que aprobar cada vínculo. Si lo cambiás, el anterior deja de funcionar.</p>}
      {state.status === "error" && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}
    </Card>
  );
}
