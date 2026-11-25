"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatArs, formatUsd } from "@/lib/mock/exchange";
import type { CollectionChoiceView } from "@/lib/applications/collectionChoiceView";
import {
  COLLECTION_PATH_TITLES,
  studentCollectionPreview,
  type CollectionPath,
  type ResolvedCollection,
} from "@/lib/applications/reservationCollectionChoice";
import { COLLECTION_ALTERNATIVE_RESIDENCE_LABEL, COLLECTION_LIABILITY_NOTICE } from "@/lib/residences/offeredPaymentMethods";
import {
  submitChooseResidencePaymentCollection,
  submitEnableResidencePayment,
  type ApplicationActionState,
} from "@/app/residence/[residence_id]/applications/actions";

const initialState: ApplicationActionState = { status: "idle" };

/**
 * «Habilitar el pago de la reserva» (DR63 (d)). La residencia define, por solicitud, cómo se cobra: «Cobro con medios habilitados»
 * (elige un medio entre los aprobados; el monto sale de las condiciones acordadas y NO se edita acá) o «Contacto directo por WhatsApp».
 * Radios nativos (`collection_mode`, `chosen_method`) y un solo botón principal. El servidor valida todo de nuevo: esto es solo
 * presentación. No recibe ni muestra datos de cobro: solo nombres de medio y montos.
 * `mode="choose"`: la solicitud ya espera el pago pero sin camino definido (tras una propuesta de ajuste); al elegir, el plazo de 48 h se reinicia.
 */
export function CollectionPaymentPanel({
  applicationId,
  collection,
  canAct,
  mode,
}: {
  applicationId: string;
  collection: CollectionChoiceView;
  /** Permiso `payments.residence` (solo presentación). */
  canAct: boolean;
  mode: "enable" | "choose";
}) {
  const action = (mode === "enable" ? submitEnableResidencePayment : submitChooseResidencePaymentCollection).bind(null, applicationId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  const { paths, methods, isOwner, isMinor } = collection;
  const [pathChoice, setPathChoice] = useState<CollectionPath | "">(paths.length === 1 ? paths[0] : "");
  const [methodChoice, setMethodChoice] = useState<string>(collection.preferredKey ?? (methods.length === 1 ? methods[0].key : ""));

  const onlyMethods = paths.length === 1 && paths[0] === "enabled_methods";
  const methodsBlocked = !isOwner; // el staff no ve ni congela datos de cobro
  const blockedByRole = onlyMethods && methodsBlocked;

  let resolved: ResolvedCollection | null = null;
  if (pathChoice === "whatsapp_direct") resolved = { mode: "whatsapp_direct" };
  else if (pathChoice === "enabled_methods" && methodChoice) {
    const method = methods.find((m) => m.key === methodChoice);
    if (method) resolved = { mode: "enabled_methods", methodKey: method.key as never, methodLabel: method.label };
  }

  const title = mode === "enable" ? "Habilitar el pago de la reserva" : "Definí cómo cobrar la reserva";
  const submitLabel = mode === "enable" ? "Habilitar el pago" : "Confirmar el cobro";
  const canSubmit = canAct && !blockedByRole && resolved !== null && !isPending;

  return (
    <form action={formAction} className="rounded-card border border-sand-200 bg-sand-50 p-4">
      <fieldset disabled={!canAct} className="m-0 min-w-0 space-y-4 border-0 p-0">
        <div>
          <h3 className="font-bold text-ink">{title}</h3>
          {mode === "choose" && (
            <p className="mt-1 text-xs text-ink-soft">
              Las condiciones ya están acordadas. Al confirmar, el plazo de 48 h para el pago se reinicia.
            </p>
          )}
        </div>

        {collection.amountUsd !== null && (
          <p className="text-sm text-ink">
            <span className="font-bold tabular-nums">{formatUsd(collection.amountUsd)}</span>
            {collection.amountArs !== null && <span className="tabular-nums text-ink-soft"> · {formatArs(collection.amountArs)}</span>}
            <span className="block text-xs text-ink-soft">
              Monto de la reserva según las condiciones acordadas. Para cambiarlo, enviá una propuesta de ajuste.
            </span>
          </p>
        )}

        {collection.preferredAlternative && (
          <p className="flex items-start gap-2 text-sm text-ink">
            <Icon name="info" className="mt-0.5 shrink-0 text-base" />
            <span>
              <span className="font-bold">{COLLECTION_ALTERNATIVE_RESIDENCE_LABEL}</span>
              <span className="block text-xs text-ink-soft">
                Ningún medio de los que ofrecés le sirve al estudiante. Contactalo {isMinor ? "a su familiar vinculado " : ""}para definir cómo paga.
              </span>
            </span>
          </p>
        )}

        {collection.degraded && (
          <p className="flex items-start gap-2 text-xs text-ink-soft">
            <Icon name="info" className="mt-0.5 text-base" />
            <span>Tus medios de cobro todavía no tienen datos aprobados, así que esta reserva se coordina por contacto directo.</span>
          </p>
        )}

        {paths.length > 1 && (
          <fieldset className="min-w-0">
            <legend className="text-sm font-semibold text-ink">¿Cómo cobrás esta reserva?</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {paths.map((p) => {
                const disabled = p === "enabled_methods" && methodsBlocked;
                return (
                  <label
                    key={p}
                    className={`flex cursor-pointer items-start gap-2 rounded-field border border-line-2 bg-paper p-3 text-sm has-[:checked]:border-forest has-[:checked]:bg-forest-tint has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <input
                      type="radio"
                      name="collection_mode"
                      value={p}
                      checked={pathChoice === p}
                      disabled={disabled}
                      onChange={() => setPathChoice(p)}
                      className="mt-0.5 h-4 w-4 accent-forest"
                    />
                    <span>
                      <span className="block font-semibold text-ink">{COLLECTION_PATH_TITLES[p]}</span>
                      {disabled && <span className="block text-xs text-ink-soft">Solo el dueño puede cobrar con medios habilitados.</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        {paths.length === 1 && <input type="hidden" name="collection_mode" value={paths[0]} />}

        {pathChoice === "enabled_methods" && (
          <fieldset className="min-w-0" disabled={methodsBlocked}>
            <legend className="text-sm font-semibold text-ink">Medio de pago</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {methods.map((m) => (
                <label key={m.key} className="relative cursor-pointer">
                  <input
                    type="radio"
                    name="chosen_method"
                    value={m.key}
                    checked={methodChoice === m.key}
                    onChange={() => setMethodChoice(m.key)}
                    className="peer sr-only"
                  />
                  <span className="block rounded-full border border-line-2 bg-paper px-3.5 py-1.5 text-sm font-semibold text-ink-soft peer-checked:border-forest peer-checked:bg-forest-tint peer-checked:text-forest-700 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-forest">
                    {m.label}
                    {collection.preferredKey === m.key && <span className="font-normal"> · lo prefirió el estudiante</span>}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {blockedByRole && (
          <p className="flex items-start gap-2 text-xs text-ink-soft">
            <Icon name="lock" className="mt-0.5 text-base" />
            <span>Pedile al dueño de la residencia que habilite el pago: solo él puede cobrar con medios habilitados.</span>
          </p>
        )}

        <div className="rounded-field border border-line-2 bg-paper p-3">
          <p className="text-xs font-bold text-ink">Esto ve {isMinor ? "la familia" : "el estudiante"}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {resolved ? studentCollectionPreview(resolved, isMinor) : "Elegí cómo cobrás para ver qué le llega."}
          </p>
          <p className="mt-2 flex items-start gap-2 text-xs text-ink-soft">
            <Icon name="shield" className="mt-0.5 text-base text-forest-700" />
            <span>{COLLECTION_LIABILITY_NOTICE}</span>
          </p>
        </div>

        {state.status === "error" && (
          <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
            {state.message}
          </p>
        )}

        <Button type="submit" disabled={!canSubmit}>
          {isPending ? "Guardando…" : submitLabel}
        </Button>
      </fieldset>
    </form>
  );
}
