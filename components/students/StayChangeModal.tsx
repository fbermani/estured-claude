"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Input, Textarea } from "@/components/ui/Input";
import { StayChangeSubmit } from "@/components/students/StayChangeSubmit";
import { createStayChangeIntentAction, type StayChangeActionState } from "@/app/students/residency/stayChangeActions";
import { MAX_STUDENT_MESSAGE } from "@/lib/stayChange/validate";
import { UNPAID_DISCLAIMER } from "@/lib/stayChange/copy";

const initialState: StayChangeActionState = { status: "idle" };

function todayArIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

/**
 * "Avisale a tu residencia que buscás un cambio" (SPEC §3.3; `docs/08` §6.16). Modal en desktop y hoja inferior en
 * mobile. La confirmación explícita (checkbox sin marcar) es obligatoria: sin ella el botón queda `aria-disabled` con la
 * ayuda visible. La lógica y las validaciones viven en el servidor (`createStayChangeIntent`); acá solo se informa.
 */
export function StayChangeModal({
  residenceName,
  contractEndLabel,
  contractEndDate,
  familyName,
  isMinor,
  advanceHours,
  blockedUntilIso = null,
  triggerLabel = "Quiero cambiar",
  triggerVariant = "primary",
  triggerSize = "md",
}: {
  residenceName: string;
  contractEndLabel: string;
  /** "YYYY-MM-DD", para el aviso suave si la fecha estimada es posterior al fin de contrato. */
  contractEndDate: string | null;
  familyName: string | null;
  isMinor: boolean;
  /** Horas de preaviso antes de poder avanzar al pago de una reserva nueva (viene del servidor). */
  advanceHours: number;
  /** Cooldown de 24 h entre avisos: si rige, el botón se deshabilita con la fecha desde la que puede volver a avisar. */
  blockedUntilIso?: string | null;
  triggerLabel?: string;
  triggerVariant?: "primary" | "outline" | "secondary";
  triggerSize?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createStayChangeIntentAction, initialState);
  const [confirmed, setConfirmed] = useState(false);
  const [exitDate, setExitDate] = useState("");
  const [message, setMessage] = useState("");
  const titleId = useId();
  const descId = useId();
  const helpId = useId();
  const dateWarnId = useId();

  useEffect(() => {
    if (state.status === "saved") setOpen(false);
  }, [state.status]);

  const pastContract = !!exitDate && !!contractEndDate && exitDate > contractEndDate;

  return (
    <>
      <Button type="button" variant={triggerVariant} size={triggerSize} onClick={() => setOpen(true)} disabled={!!blockedUntilIso}>
        <Icon name="swap_horiz" className="text-lg" />
        {triggerLabel}
      </Button>
      {blockedUntilIso && (
        <p className="mt-2 text-xs text-ink-faint">
          Podés volver a avisar desde{" "}
          {new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(blockedUntilIso))}
          .
        </p>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} labelledBy={titleId} describedBy={descId} maxWidthClass="sm:max-w-xl">
        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-bold text-ink">
                Avisale a tu residencia que buscás un cambio
              </h2>
              <p id={descId} className="mt-1 text-sm text-ink-soft">
                {residenceName} va a recibir este aviso. Tu reserva, tu lugar y tus pagos siguen igual.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              <Icon name="close" className="text-xl" />
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            {state.status === "error" && (
              <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
                {state.message}
              </p>
            )}

            <Input
              label="¿Cuándo te gustaría mudarte? (opcional)"
              name="estimated_exit_date"
              type="date"
              min={todayArIso()}
              value={exitDate}
              onChange={(e) => setExitDate(e.target.value)}
              aria-describedby={pastContract ? dateWarnId : undefined}
              data-autofocus
              hint="Es una estimación para que la residencia se organice. La fecha exacta la acuerdan entre ustedes."
            />
            {pastContract && (
              <p id={dateWarnId} className="-mt-3 rounded-field bg-info-bg px-3.5 py-2.5 text-xs leading-relaxed text-info-fg">
                Esa fecha es posterior al fin de tu contrato ({contractEndLabel}). No hace falta avisar para mudarte después: ya podés enviar tu solicitud de reserva para esas fechas.
              </p>
            )}

            <div>
              <Textarea
                label="Mensaje para tu residencia (opcional)"
                name="student_message"
                rows={3}
                maxLength={MAX_STUDENT_MESSAGE}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Por ejemplo: “Me cambio de facultad y busco algo más cerca de Ciudad Universitaria.”"
                hint="Tu residencia lo lee. Contar el motivo la ayuda a entender y, si puede, a ofrecerte otra opción."
              />
              <p className="mt-1 text-right text-xs text-ink-faint" aria-live="off">
                {message.length}/{MAX_STUDENT_MESSAGE}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-field border border-line bg-cream-2/60 p-4">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-forest-700">
                  <Icon name="visibility" className="text-sm" /> Tu residencia ve
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-ink-soft">
                  <li>Que estás buscando un cambio</li>
                  <li>Tu fecha estimada de salida</li>
                  <li>Tu mensaje, si escribís uno</li>
                </ul>
              </div>
              <div className="rounded-field border border-line bg-cream-2/60 p-4">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-700">
                  <Icon name="visibility_off" className="text-sm" /> Tu residencia no ve
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-ink-soft">
                  <li>A qué residencia te mudás</li>
                  <li>A qué residencias escribís</li>
                  <li>Tus solicitudes ni tus listas de espera</li>
                </ul>
              </div>
            </div>

            <div className="space-y-2 rounded-field border border-line bg-paper p-4 text-xs leading-relaxed text-ink-soft">
              <p className="font-bold text-ink">Qué tenés que saber</p>
              <ul className="list-disc space-y-1.5 pl-4">
                <li>
                  Las residencias que consultes van a ver que estás en proceso de mudanza, sin el nombre de tu residencia actual. Lo que cuentes en tu
                  solicitud es voluntario.
                </li>
                <li>
                  Desde ahora podés consultar, enviar solicitudes y sumarte a listas de espera con fechas superpuestas. Para avanzar al pago de una reserva
                  nueva tienen que pasar {advanceHours} horas desde este aviso.
                </li>
                <li>Quien confirma y paga una reserva nueva se tiene que mudar: la baja de tu estadía actual la registra tu residencia.</li>
                <li>{UNPAID_DISCLAIMER}</li>
              </ul>
            </div>

            {familyName && (
              <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
                <Icon name="family_restroom" className="mt-0.5 shrink-0 text-base text-forest-700" />
                {familyName}, tu familiar vinculado, también va a ver tu aviso y la respuesta de la residencia, pero no tu mensaje.
              </p>
            )}
            {isMinor && (
              <p className="flex items-start gap-2 rounded-field bg-info-bg px-3.5 py-2.5 text-xs leading-relaxed text-info-fg">
                <Icon name="how_to_reg" className="mt-0.5 shrink-0 text-base" />
                Sos menor de edad: tu familiar vinculado tiene que confirmar el aviso antes de que se lo enviemos a tu residencia.
              </p>
            )}

            <label className="flex cursor-pointer items-start gap-3 rounded-field border-[1.5px] border-line-2 bg-cream-2/40 p-4 text-sm leading-relaxed text-ink">
              <input
                type="checkbox"
                name="confirm_understood"
                value="on"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                aria-describedby={helpId}
                className="mt-0.5 size-5 shrink-0 accent-[var(--color-forest)]"
              />
              <span>
                Entiendo que avisar <strong>no cancela mi reserva</strong>, no me asegura lugar en otra residencia y que los costos de salida los informa mi
                residencia, no EstuRed.
              </span>
            </label>
            {!confirmed && (
              <p id={helpId} className="-mt-3 text-xs font-semibold text-orange-700">
                Marcalo para poder avisar.
              </p>
            )}
            {confirmed && <span id={helpId} className="sr-only">Confirmación marcada.</span>}
          </div>

          <footer className="flex flex-col-reverse gap-2 border-t border-line bg-cream-2 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end sm:px-6">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Volver
            </Button>
            <StayChangeSubmit pendingLabel="Avisando a tu residencia…" blocked={!confirmed}>
              Avisar a mi residencia
            </StayChangeSubmit>
          </footer>
        </form>
      </Dialog>
    </>
  );
}
