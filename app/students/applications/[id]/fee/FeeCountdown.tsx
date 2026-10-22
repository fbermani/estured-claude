"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { describeFeeCountdown } from "@/lib/payments/feeTransferPresentation";

/**
 * Cuenta regresiva del plazo del fee (`estured_fee_payments.expires_at`).
 * El primer render usa la hora del servidor (`nowIso`) para que no haya
 * diferencia de hidratación; después se actualiza cada 30 s.
 */
export function FeeCountdown({
  expiresAt,
  nowIso,
  supportHref,
  children,
}: {
  expiresAt: string;
  nowIso: string;
  supportHref: string;
  /** Datos de transferencia y formulario: se ocultan cuando el plazo venció. */
  children?: ReactNode;
}) {
  const [now, setNow] = useState(() => new Date(nowIso));

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const info = describeFeeCountdown(expiresAt, now);
  if (!info) return <>{children}</>;

  return (
    <>
      <p
        className={`mt-4 flex items-start gap-2 rounded-field px-4 py-3 text-sm ${
          info.urgent ? "bg-warning-bg text-warning-fg" : "bg-sand-100 text-ink-soft"
        }`}
      >
        <Icon name="schedule" className="mt-0.5 text-base" />
        <span>
          {info.expired ? (
            <>
              <span className="font-bold">El plazo para pagar venció ({info.absolute}).</span> No hace falta que
              transfieras: escribile a EstuRed desde{" "}
              <Link href={supportHref} className="font-semibold underline">
                Soporte
              </Link>{" "}
              y vemos cómo seguir.
            </>
          ) : (
            <>
              <span className="font-bold">Te quedan {info.remaining}</span> para pagar (hasta el {info.absolute},
              hora de Buenos Aires). Si no se registra el pago antes, la reserva vence.
            </>
          )}
        </span>
      </p>
      {info.expired ? null : children}
    </>
  );
}
