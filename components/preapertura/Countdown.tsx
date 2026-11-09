"use client";

import { useEffect, useState } from "react";

function remaining(closesAt: string, now: number) {
  const ms = Math.max(0, Date.parse(closesAt) - now);
  const totalMinutes = Math.floor(ms / 60_000);
  return { days: Math.floor(totalMinutes / 1440), hours: Math.floor((totalMinutes % 1440) / 60), minutes: totalMinutes % 60, over: ms === 0 };
}

/**
 * Cuenta regresiva a la fecha REAL de cierre de fundadoras (`FOUNDERS_CLOSE_AT`, DR46.2). Solo se dibuja si el servidor mandó una
 * fecha futura; nunca hay fecha por defecto. Se calcula recién en el navegador (evita desajuste de hidratación) y se actualiza una
 * vez por minuto. Texto accesible completo en `aria-label`; los números visibles no se anuncian a cada tick.
 */
export function Countdown({ closesAt }: { closesAt: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  if (now == null) return <div className="min-h-[52px]" aria-hidden="true" />;
  const r = remaining(closesAt, now);
  if (r.over) return null;
  const parts = [
    { value: r.days, label: "días" },
    { value: r.hours, label: "horas" },
    { value: r.minutes, label: "min" },
  ];
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={`Cierra en ${r.days} días, ${r.hours} horas y ${r.minutes} minutos`}>
      <span className="mr-1 text-sm text-white/85">Cierra en</span>
      {parts.map((p) => (
        <span key={p.label} className="grid min-w-[46px] justify-items-center rounded-field bg-white/10 px-2 py-1.5">
          <b className="font-display text-base leading-none tabular-nums">{String(p.value).padStart(2, "0")}</b>
          <small className="text-xs text-white/85">{p.label}</small>
        </span>
      ))}
    </div>
  );
}
