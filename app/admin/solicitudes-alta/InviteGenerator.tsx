"use client";

import { useActionState, useState } from "react";
import { generateInviteAction, type InviteState } from "@/app/admin/solicitudes-alta/actions";

const initialState: InviteState = { status: "idle" };

/** Genera el enlace de un solo uso y lo muestra una vez. El envío es manual (copiar o abrir WhatsApp desde tu celular). */
export function InviteGenerator({ id, contactName, residenceName, phone, hasPending }: { id: string; contactName: string; residenceName: string; phone: string; hasPending: boolean }) {
  const [state, formAction, pending] = useActionState(generateInviteAction.bind(null, id), initialState);
  const [copied, setCopied] = useState(false);
  const digits = phone.replace(/\D/g, "");
  const wa =
    state.link && digits.length >= 8 && digits.length <= 15
      ? `https://wa.me/${digits}?text=${encodeURIComponent(`Hola ${contactName}, te escribo del equipo de EstuRed. Este es tu enlace personal para crear la cuenta de ${residenceName} (se usa una sola vez y vence en 7 días): ${state.link}`)}`
      : null;

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <button type="submit" disabled={pending} className="cursor-pointer rounded-full bg-[#1f2937] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
          {pending ? "Generando…" : hasPending ? "Generar invitación nueva" : "Generar invitación"}
        </button>
        {hasPending && state.status !== "ready" && <span className="ml-2 text-xs text-[#6b7280]">Hay un enlace vigente; generar otro invalida el anterior.</span>}
      </form>
      {state.status === "error" && <p role="alert" className="text-xs font-semibold text-red-700">{state.message}</p>}
      {state.status === "ready" && state.link && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-900">Copialo ahora: no se vuelve a mostrar. Enviáselo vos a la residencia (vence el {new Date(state.expiresAt ?? "").toLocaleDateString("es-AR")}).</p>
          <input readOnly value={state.link} aria-label="Enlace de invitación" onFocus={(e) => e.currentTarget.select()} className="w-full rounded border border-amber-300 bg-white px-2 py-1 text-xs" />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(state.link!);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
              className="cursor-pointer rounded-full border border-amber-400 px-3 py-1 text-xs font-bold text-amber-900"
            >
              {copied ? "Copiado" : "Copiar enlace"}
            </button>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="rounded-full border border-amber-400 px-3 py-1 text-xs font-bold text-amber-900">
                Abrir WhatsApp (envío manual)
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
