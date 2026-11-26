"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { DEV_SCREENS, devPrepareHref, isCurrentDevScreen } from "@/lib/preapertura/devScreens";

/**
 * «Pantallas (dev)»: navegador flotante para recorrer TODAS las pantallas del flujo de preapertura en orden, sin completar datos. SOLO
 * existe en desarrollo: el layout lo importa dentro de una rama `NODE_ENV === "development"` que el build de producción elimina.
 * Cada enlace pasa por `/dev-preapertura/preparar`, que deja la sesión que la pantalla necesita (cuenta de prueba, o sin sesión).
 * Va arriba a la izquierda, debajo del Navbar real del fondo y de la etiqueta del fondo: no tapa el CTA de fundadoras ni el selector «Simular usuario».
 */
export function DevScreenNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const params = useSearchParams();
  const index = DEV_SCREENS.findIndex((s) => isCurrentDevScreen(s, pathname, params));
  const prev = index > 0 ? DEV_SCREENS[index - 1] : null;
  const next = index >= 0 && index < DEV_SCREENS.length - 1 ? DEV_SCREENS[index + 1] : index < 0 ? DEV_SCREENS[0] : null;
  const btn =
    "inline-flex min-h-9 items-center rounded-field border border-white/40 bg-white/10 px-2.5 text-xs font-bold text-white hover:bg-white/20 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-white";

  return (
    <nav aria-label="Pantallas (dev)" className="fixed left-4 top-[4.75rem] z-[70] font-sans">
      {open ? (
        <div className="w-72 max-w-[calc(100vw-2rem)] rounded-card border-[1.5px] border-gold/60 bg-forest-ink p-3 text-white shadow-float">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-gold">Pantallas (dev)</p>
            <button type="button" onClick={() => setOpen(false)} className={btn} aria-label="Cerrar el navegador de pantallas">
              Cerrar
            </button>
          </div>
          <ol className="mt-2 grid max-h-[55vh] gap-0.5 overflow-y-auto">
            {DEV_SCREENS.map((s, i) => (
              <li key={s.id}>
                <Link
                  href={devPrepareHref(s)}
                  prefetch={false}
                  aria-current={i === index ? "page" : undefined}
                  className={`flex min-h-9 items-center gap-2 rounded-field px-2 text-xs hover:bg-white/10 focus-visible:outline-[3px] focus-visible:outline-white ${
                    i === index ? "bg-white/15 font-bold text-gold" : "text-white/90"
                  }`}
                >
                  <span className="w-5 shrink-0 text-right tabular-nums">{i + 1}</span>
                  {s.label}
                </Link>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/20 pt-2">
            {prev ? (
              <Link href={devPrepareHref(prev)} prefetch={false} className={btn}>
                Anterior
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-white/80 tabular-nums">{index >= 0 ? `${index + 1} de ${DEV_SCREENS.length}` : "fuera del flujo"}</span>
            {next ? (
              <Link href={devPrepareHref(next)} prefetch={false} className={btn}>
                Siguiente
              </Link>
            ) : (
              <span />
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex min-h-9 items-center rounded-full border-[1.5px] border-gold/70 bg-forest-ink px-3 text-xs font-bold text-gold shadow-float focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Pantallas (dev){index >= 0 ? `, ${index + 1}/${DEV_SCREENS.length}` : ""}
          </button>
          {prev && (
            <Link href={devPrepareHref(prev)} prefetch={false} aria-label={`Pantalla anterior: ${prev.label}`} className={`${btn} bg-forest-ink`}>
              ←
            </Link>
          )}
          {next && (
            <Link href={devPrepareHref(next)} prefetch={false} aria-label={`Pantalla siguiente: ${next.label}`} className={`${btn} bg-forest-ink`}>
              →
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
