"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input, Select, Textarea } from "@/components/ui/Input";
import {
  cancelLinkRequestAction,
  submitLinkRequestAction,
  submitMissingResidenceAction,
  type ResidencyActionState,
} from "@/app/students/residency/actions";
import { LINK_REQUEST_MESSAGE_MAX, LINK_REQUEST_STATUS_LABELS, type LinkRequestStatus } from "@/lib/residents/linkRequestRules";

const initialState: ResidencyActionState = { status: "idle" };

export type MyLinkRequest = { id: string; status: LinkRequestStatus; residenceName: string; createdAt: string };

function CancelButton({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(cancelLinkRequestAction.bind(null, requestId), initialState);
  return (
    <form action={action} className="inline">
      <button type="submit" disabled={pending} className="cursor-pointer text-xs font-semibold text-ink-faint underline hover:text-danger-fg disabled:opacity-50">
        {pending ? "Retirando…" : "Retirar"}
      </button>
      {state.status === "error" && <span className="ml-2 text-xs font-medium text-danger-fg">{state.message}</span>}
    </form>
  );
}

const chipTone: Record<LinkRequestStatus, string> = {
  pending: "bg-warning-bg text-warning-fg",
  approved: "bg-forest-tint text-forest-700",
  rejected: "bg-danger-bg text-danger-fg",
};

/**
 * «Ya vivo en una residencia» (DR19). El estudiante que se registró solo pide que su residencia lo vincule, eligiéndola de la lista o con
 * el código de casa. Nada queda vinculado hasta que la residencia aprueba. Si su residencia no está en EstuRed, deja nombre y contacto.
 */
export function LinkRequestSection({ residences, requests }: { residences: { id: string; name: string; area: string | null }[]; requests: MyLinkRequest[] }) {
  const [state, action, pending] = useActionState(submitLinkRequestAction, initialState);
  const [missingState, missingAction, missingPending] = useActionState(submitMissingResidenceAction, initialState);

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Icon name="apartment" className="mt-0.5 text-2xl text-forest-700" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-ink">¿Ya vivís en una residencia?</h2>
          <p className="mt-1 text-sm text-ink-soft">Pedile a tu residencia que te vincule: apenas lo apruebe, figurás como residente.</p>

          {requests.length > 0 && (
            <ul className="mt-4 space-y-2">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-field border border-line-2 bg-paper px-3.5 py-2.5 text-sm">
                  <span className="font-semibold text-ink">{r.residenceName}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${chipTone[r.status]}`}>{LINK_REQUEST_STATUS_LABELS[r.status]}</span>
                  {r.status === "pending" && <CancelButton requestId={r.id} />}
                </li>
              ))}
            </ul>
          )}

          <form action={action} className="mt-4 space-y-4">
            <Select label="Tu residencia" name="residence_id" defaultValue="">
              <option value="">Elegí una…</option>
              {residences.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.area ? ` · ${r.area}` : ""}
                </option>
              ))}
            </Select>
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-ink-soft hover:text-ink">Tengo un código de casa</summary>
              <div className="mt-2 max-w-48">
                <Input label="Código de casa" name="house_code" maxLength={8} autoCapitalize="characters" hint="Te lo da tu residencia. Igual tiene que aprobarte." />
              </div>
            </details>
            <Textarea
              label="Mensaje (opcional)"
              name="message"
              rows={2}
              maxLength={LINK_REQUEST_MESSAGE_MAX}
              hint="Por ejemplo, tu habitación o desde cuándo vivís ahí."
            />
            <Button type="submit" disabled={pending}>
              {pending ? "Enviando…" : "Pedir que me vinculen"}
            </Button>
            {state.status === "error" && (
              <p role="alert" className="rounded-field bg-danger-bg px-3.5 py-2.5 text-sm font-medium text-danger-fg">
                {state.message}
              </p>
            )}
            {state.status === "saved" && state.message && <p className="text-sm font-medium text-forest-700">{state.message}</p>}
          </form>

          <details className="mt-5 border-t border-line pt-4">
            <summary className="cursor-pointer text-sm font-semibold text-ink-soft hover:text-ink">Mi residencia no está</summary>
            <form action={missingAction} className="mt-3 space-y-3">
              <Input label="Nombre de tu residencia" name="residence_name" maxLength={120} required />
              <Input label="Contacto (opcional)" name="contact" maxLength={120} hint="Mail o teléfono de la residencia, para invitarla a EstuRed." />
              <Button type="submit" variant="outline" size="sm" disabled={missingPending}>
                {missingPending ? "Enviando…" : "Avisar a EstuRed"}
              </Button>
              {missingState.status === "error" && <p role="alert" className="text-sm font-medium text-danger-fg">{missingState.message}</p>}
              {missingState.status === "saved" && <p className="text-sm font-medium text-forest-700">{missingState.message}</p>}
            </form>
          </details>
        </div>
      </div>
    </Card>
  );
}
