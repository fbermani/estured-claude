"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input, Textarea } from "@/components/ui/Input";
import {
  PAYMENT_DETAILS_MAX,
  PAYMENT_LABEL_MAX,
  PAYMENT_METHODS,
  maskPaymentDetails,
  validatePaymentDetails,
  validatePaymentLabel,
  type PaymentMethodInfo,
  type PaymentMethodKey,
} from "@/lib/payments/paymentMethods";
import {
  METHOD_DATA_STATE_LABELS,
  RESERVATION_MODE_LABELS,
  type MethodDataState,
  type ReservationPaymentMode,
} from "@/lib/residences/reservationCollection";
import { saveReservationCollectionAction } from "@/app/residence/[residence_id]/collection/actions";

/** Un medio con sus datos actuales (los pendientes si hay, si no los aprobados). SOLO llega al navegador del dueño. */
export type CollectionEditorAccount = {
  methodKey: string;
  state: MethodDataState;
  /** Hay datos aprobados vigentes (el cambio nuevo queda pendiente y rigen estos). */
  hasApproved: boolean;
  /** Motivo con que el admin rechazó el último cambio (solo cuando `state` es «rejected»). */
  rejectedReason: string | null;
  details: string;
  label: string;
};

type Values = Record<string, { details: string; label: string }>;

const STATE_TONE: Record<MethodDataState, "neutral" | "amber" | "sage" | "danger"> = { none: "neutral", pending: "amber", approved: "sage", rejected: "danger" };

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Edición del «Cobro de la reserva» (DR63), SOLO para el dueño. Dos opciones activables a la vez: «Cobro con medios habilitados» (medios
 * del catálogo + datos de cobro de cada uno) y «Contacto directo por WhatsApp». Los datos de cobro se ven enmascarados hasta tocar
 * «Mostrar». DR65 (c): los datos rigen al guardar (EstuRed no los aprueba; la residencia responde por ellos); el cliente solo
 * manda lo que el dueño tocó. Una sola acción primaria: «Guardar y volver».
 */
export function CollectionEditor({
  residenceId,
  initialModes,
  initialMethods,
  accounts,
}: {
  residenceId: string;
  initialModes: ReservationPaymentMode[];
  initialMethods: PaymentMethodKey[];
  accounts: CollectionEditorAccount[];
}) {
  const router = useRouter();
  const baseId = useId();
  const initialValues: Values = Object.fromEntries(accounts.map((a) => [a.methodKey, { details: a.details, label: a.label }]));
  const accountByKey = Object.fromEntries(accounts.map((a) => [a.methodKey, a]));

  const [modes, setModes] = useState<ReservationPaymentMode[]>(initialModes);
  const [methods, setMethods] = useState<PaymentMethodKey[]>(initialMethods);
  const [values, setValues] = useState<Values>(initialValues);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabled = modes.includes("enabled_methods");
  const whatsapp = modes.includes("whatsapp_direct");
  const valueOf = (key: string) => values[key] ?? { details: "", label: "" };
  const isTouched = (key: string) => {
    const now = valueOf(key);
    const before = initialValues[key] ?? { details: "", label: "" };
    return now.details !== before.details || now.label !== before.label;
  };
  const selectedInOrder = PAYMENT_METHODS.filter((m) => methods.includes(m.key));
  const dirty = !sameList(modes, initialModes) || !sameList(methods, initialMethods) || (enabled && selectedInOrder.some((m) => isTouched(m.key)));

  function toggleMode(mode: ReservationPaymentMode, on: boolean) {
    setError(null);
    setModes((prev) => {
      const next = on ? [...prev.filter((m) => m !== mode), mode] : prev.filter((m) => m !== mode);
      // Orden canónico: medios habilitados primero.
      return next.sort((a, b) => (a === b ? 0 : a === "enabled_methods" ? -1 : 1));
    });
  }

  function toggleMethod(key: PaymentMethodKey, on: boolean) {
    setError(null);
    setMethods((prev) => (on ? [...prev.filter((k) => k !== key), key] : prev.filter((k) => k !== key)));
  }

  function setField(key: string, patch: Partial<{ details: string; label: string }>) {
    setError(null);
    setValues((prev) => ({ ...prev, [key]: { ...(prev[key] ?? { details: "", label: "" }), ...patch } }));
  }

  /** Mismos chequeos que el servidor, para avisar antes de enviar. El servidor igual valida todo. */
  function clientProblem(): string | null {
    if (modes.length === 0) return "Elegí al menos una opción para cobrar la reserva.";
    if (!enabled) return null;
    if (methods.length === 0) return "Elegí al menos un medio de cobro, o desactivá «Cobro con medios habilitados».";
    for (const m of selectedInOrder) {
      const v = valueOf(m.key);
      const details = validatePaymentDetails(v.details, m.label);
      if (!details.ok) return details.error;
      if (m.requiresLabel) {
        const label = validatePaymentLabel(v.label);
        if (!label.ok) return label.error;
      }
    }
    return null;
  }

  async function save() {
    if (!dirty) {
      router.push(`/residence/${residenceId}/profile`);
      return;
    }
    const problem = clientProblem();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    const touched: Record<string, { details: string; label?: string }> = {};
    if (enabled) {
      for (const m of selectedInOrder) {
        if (!isTouched(m.key)) continue;
        const v = valueOf(m.key);
        touched[m.key] = m.requiresLabel ? { details: v.details, label: v.label } : { details: v.details };
      }
    }
    try {
      const result = await saveReservationCollectionAction(residenceId, { modes, methods: enabled ? methods : [], accounts: touched });
      if (result.status === "error") {
        setError(result.message);
        setBusy(false);
        return;
      }
      router.push(`/residence/${residenceId}/profile`);
      router.refresh();
    } catch {
      setError("No pudimos guardar el cobro de la reserva. Revisá tu conexión e intentá de nuevo.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-8">
      <section aria-labelledby={`${baseId}-modes`}>
        <h2 id={`${baseId}-modes`} className="text-lg font-bold text-ink">
          Cómo cobrás la reserva
        </h2>
        <p className="mt-1 text-sm text-ink-soft">Podés activar una opción o las dos.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <OptionCard
            checked={enabled}
            onChange={(on) => toggleMode("enabled_methods", on)}
            title={RESERVATION_MODE_LABELS.enabled_methods}
            lines={["Elegís los medios que aceptás y cargás tus datos de cobro una sola vez.", "Con medios habilitados, EstuRed te evita ese chat hasta la confirmación final."]}
          />
          <OptionCard
            checked={whatsapp}
            onChange={(on) => toggleMode("whatsapp_direct", on)}
            title={RESERVATION_MODE_LABELS.whatsapp_direct}
            lines={[
              "Vos le escribís al estudiante y coordinás el pago. EstuRed no interviene en ese chat.",
              "Con contacto directo, la coordinación del pago queda en tu equipo. Es el trabajo que EstuRed busca ahorrarte.",
              "La responsabilidad de coordinar el pago es de tu residencia.",
            ]}
          />
        </div>
        {enabled && whatsapp && <p className="mt-3 rounded-field bg-forest-tint px-4 py-3 text-sm text-ink">Con las dos opciones activas, elegís el camino en cada solicitud, al aceptarla.</p>}
      </section>

      {enabled && (
        <section aria-labelledby={`${baseId}-methods`}>
          <h2 id={`${baseId}-methods`} className="text-lg font-bold text-ink">
            Medios que aceptás
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Vos cargás estos datos y respondés por ellos. EstuRed no los revisa ni los aprueba: rigen apenas los guardás, para las
            próximas solicitudes. Las solicitudes con el pago ya habilitado conservan los datos que vieron.
          </p>
          <fieldset className="mt-4 min-w-0">
            <legend className="sr-only">Medios de cobro del catálogo</legend>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => {
                const on = methods.includes(m.key);
                return (
                  <label
                    key={m.key}
                    className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-4 text-sm font-semibold transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-forest ${
                      on ? "border-forest bg-forest-tint text-forest-700" : "border-line bg-paper text-ink hover:border-forest"
                    }`}
                  >
                    <input type="checkbox" className="size-4 accent-forest" checked={on} onChange={(e) => toggleMethod(m.key, e.target.checked)} />
                    {m.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {selectedInOrder.length === 0 ? (
            <p role="status" className="mt-4 rounded-field bg-cream-2 px-4 py-3 text-sm text-ink-soft">
              Todavía no elegiste ningún medio. Marcá los que aceptás y cargá sus datos de cobro.
            </p>
          ) : (
            <ul className="mt-5 space-y-4">
              {selectedInOrder.map((m) => (
                <li key={m.key}>
                  <MethodPanel
                    info={m}
                    account={accountByKey[m.key]}
                    value={valueOf(m.key)}
                    touched={isTouched(m.key)}
                    revealed={revealed.includes(m.key)}
                    onReveal={(on) => setRevealed((prev) => (on ? [...prev.filter((k) => k !== m.key), m.key] : prev.filter((k) => k !== m.key)))}
                    onChange={(patch) => setField(m.key, patch)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby={`${baseId}-save`} className="rounded-card border-[1.5px] border-line bg-cream p-5">
        <h2 id={`${baseId}-save`} className="text-lg font-bold text-ink">
          Guardar y volver
        </h2>
        <p className="mt-1 text-sm text-ink-soft">Guarda el cobro de la reserva y te lleva a tu configuración.</p>
        <p aria-live="polite" className={`mt-3 text-sm font-semibold ${dirty ? "text-warning-fg" : "text-ink-soft"}`}>
          {dirty ? "Tenés cambios sin guardar." : "No tenés cambios sin guardar."}
        </p>
        {error && (
          <p role="alert" className="mt-3 rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
            {error}
          </p>
        )}
        <div className="mt-4">
          <Button type="button" variant="primary" onClick={save} disabled={busy}>
            {busy ? "Guardando…" : "Guardar y volver"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function OptionCard({ checked, onChange, title, lines }: { checked: boolean; onChange: (on: boolean) => void; title: string; lines: string[] }) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-card border-[1.5px] p-5 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-forest ${
        checked ? "border-forest bg-forest-tint" : "border-line bg-paper hover:border-forest"
      }`}
    >
      <input type="checkbox" className="mt-1 size-5 shrink-0 accent-forest" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0">
        <span className="block font-bold text-ink">{title}</span>
        {lines.map((line) => (
          <span key={line} className="mt-1.5 block text-sm text-ink-soft">
            {line}
          </span>
        ))}
      </span>
    </label>
  );
}

function MethodPanel({
  info,
  account,
  value,
  touched,
  revealed,
  onReveal,
  onChange,
}: {
  info: PaymentMethodInfo;
  account: CollectionEditorAccount | undefined;
  value: { details: string; label: string };
  touched: boolean;
  revealed: boolean;
  onReveal: (on: boolean) => void;
  onChange: (patch: Partial<{ details: string; label: string }>) => void;
}) {
  const fieldId = useId();
  const state: MethodDataState = account?.state ?? "none";
  const hasStored = (account?.details ?? "").length > 0;
  // Con datos ya cargados, el contenido queda enmascarado hasta tocar «Mostrar y editar». Sin datos, el campo se ve directo.
  const showField = !hasStored || revealed;

  return (
    <div className="rounded-card border-[1.5px] border-line bg-paper p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-ink">{info.label}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {touched && <Badge tone="neutral">Cambios sin guardar</Badge>}
          <Badge tone={STATE_TONE[state]}>{METHOD_DATA_STATE_LABELS[state]}</Badge>
        </div>
      </div>
      {info.requiresLabel && (
        <div className="mt-4">
          <Input
            label="Nombre del medio"
            value={value.label}
            maxLength={PAYMENT_LABEL_MAX}
            onChange={(e) => onChange({ label: e.target.value })}
            hint="Por ejemplo, el nombre de la billetera o del banco. Se muestra al estudiante cuando habilitás el pago."
          />
        </div>
      )}

      <div className="mt-4">
        {showField ? (
          <>
            <Textarea
              id={`${fieldId}-details`}
              label="Datos de cobro"
              value={value.details}
              maxLength={PAYMENT_DETAILS_MAX}
              rows={3}
              autoComplete="off"
              onChange={(e) => onChange({ details: e.target.value })}
              hint={`${info.detailsHint} (${value.details.length} de ${PAYMENT_DETAILS_MAX})`}
            />
            {hasStored && (
              <button
                type="button"
                onClick={() => onReveal(false)}
                className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-field text-sm font-semibold text-forest-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              >
                <Icon name="visibility_off" className="text-lg" aria-hidden />
                Ocultar
              </button>
            )}
          </>
        ) : (
          <div>
            <p className="text-sm font-bold text-ink-soft">Datos de cobro</p>
            <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-ink">
              <span className="tabular-nums" aria-label="Datos de cobro ocultos">
                {maskPaymentDetails(value.details)}
              </span>
              <button
                type="button"
                aria-expanded={false}
                onClick={() => onReveal(true)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-field text-sm font-semibold text-forest-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              >
                <Icon name="visibility" className="text-lg" aria-hidden />
                Mostrar y editar
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
