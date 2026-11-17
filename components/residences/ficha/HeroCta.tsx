"use client";

import { Button } from "@/components/ui/Button";
import { useReservationSelection } from "@/components/residences/reservationSelection";

/**
 * CTA naranja del hero de la ficha (solo escritorio: en móvil la acción vive en la barra inferior, así una sola CTA late por pantalla).
 * - `sheet`: abre el panel de solicitud (en escritorio lleva el foco al panel, igual que «Elegir habitación» de la barra móvil).
 * - `link`: quien no puede solicitar (equipo de la residencia, etc.) sigue a las tarifas.
 * Va dentro de `ReservationSelectionProvider`.
 */
export function HeroCta({
  action,
  label,
  note,
}: {
  action: { kind: "sheet" } | { kind: "link"; href: string };
  label: string;
  /** Aclaración corta debajo del botón. */
  note?: string;
}) {
  const { openSheet } = useReservationSelection();
  const focus = "[--btn-focus:var(--color-paper)]";
  return (
    <>
      {action.kind === "sheet" ? (
        <Button type="button" variant="cta" size="cta" pulse className={focus} onClick={() => openSheet("request")}>
          {label}
        </Button>
      ) : (
        <Button href={action.href} variant="cta" size="cta" pulse className={focus}>
          {label}
        </Button>
      )}
      {note && (
        <small className="rounded-full bg-[color:var(--scrim-ink-70)] px-3 py-1 text-[13px] text-[color:var(--paper-88)]">{note}</small>
      )}
    </>
  );
}
