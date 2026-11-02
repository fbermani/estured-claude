"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Dialog } from "@/components/ui/Dialog";
import { signOut } from "@/app/(public)/login/actions";

export type TabItem = {
  href: string;
  /** Nombre completo del destino (hoja «Más» y lector de pantalla). */
  label: string;
  icon: string;
  /** Palabra corta para la barra, si el nombre completo no entra en ~75 px. */
  tabLabel?: string;
  exact?: boolean;
  badge?: number;
  badgeNoun?: string;
  /** Contenido extra a la derecha en la hoja «Más» (p. ej. `PremiumTag`). */
  trailing?: ReactNode;
};

export type MoreGroup = { title?: string; items: TabItem[] };

/** Rutas con barra de acción propia en la parte inferior: ahí la tab bar se oculta. */
const HIDE_ON = [/^\/students\/applications\/[^/]+\/(fee|payment)(\/|$)/];

function isActive(pathname: string, item: TabItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function ariaFor(item: TabItem) {
  // El nombre accesible contiene siempre el texto visible (WCAG 2.5.3).
  const base =
    item.tabLabel && !item.label.toLowerCase().includes(item.tabLabel.toLowerCase())
      ? `${item.tabLabel}, ${item.label}`
      : item.label;
  return item.badge ? `${base}, ${item.badge} ${item.badgeNoun ?? "pendientes"}` : base;
}

/**
 * Barra de pestañas inferior para estudiante, familiar y residencia (lote L7 del
 * informe móvil). Solo bajo md; desde md manda la sidebar. Muestra 4 destinos
 * fijos por rol y «Más», que abre una hoja accesible (Dialog compartido: Esc,
 * foco atrapado, scroll bloqueado) con el resto, la cuenta y «Salir». El
 * contenedor `#area-shell` queda `inert` mientras la hoja está abierta.
 */
export function MobileTabBar({
  tabs,
  groups,
  userEmail,
}: {
  tabs: TabItem[];
  groups: MoreGroup[];
  userEmail: string;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  // Cerrar la hoja al navegar.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Fuera de la hoja: inert (el Dialog va en un portal, fuera de #area-shell).
  useEffect(() => {
    if (!moreOpen) return;
    const shell = document.getElementById("area-shell");
    const button = moreButtonRef.current;
    shell?.setAttribute("inert", "");
    return () => {
      shell?.removeAttribute("inert");
      requestAnimationFrame(() => button?.focus({ preventScroll: true }));
    };
  }, [moreOpen]);

  if (HIDE_ON.some((re) => re.test(pathname))) return null;

  const moreActive = groups.some((g) => g.items.some((it) => isActive(pathname, it)));
  const moreBadge = groups.reduce((n, g) => n + g.items.reduce((m, it) => m + (it.badge ?? 0), 0), 0);

  return (
    <>
      {/* Alto total ≈ 61px + safe-area: la barra de guardado de ResidenceProfileForm se apoya en este valor (bottom-[calc(61px+…)]). */}
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-paper/95 px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      >
        {tabs.map((it) => {
          const active = isActive(pathname, it);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              aria-label={ariaFor(it)}
              className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-(--tone) active:bg-cream-2 ${
                active ? "text-(--tone-700)" : "text-ink-faint"
              }`}
            >
              <span
                className={`grid h-7 w-11 place-items-center rounded-full transition-colors ${active ? "bg-(--tone-tint)" : ""}`}
              >
                <Icon name={it.icon} className="text-xl" />
              </span>
              <span className="max-w-full truncate px-0.5">{it.tabLabel ?? it.label}</span>
              {it.badge ? (
                <span
                  aria-hidden
                  className="absolute left-1/2 top-0.5 ml-2 flex min-w-4 items-center justify-center rounded-full bg-orange px-1 text-[10px] font-extrabold leading-4 text-white"
                >
                  {it.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
        <button
          ref={moreButtonRef}
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          aria-controls="more-sheet"
          aria-label={moreBadge ? `Más, ${moreBadge} avisos pendientes` : "Más"}
          className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-(--tone) active:bg-cream-2 ${
            moreActive ? "text-(--tone-700)" : "text-ink-faint"
          }`}
        >
          <span className="grid h-7 w-11 place-items-center rounded-full">
            <Icon name="more_horiz" className="text-xl" />
          </span>
          <span>Más</span>
          {moreBadge ? (
            <span aria-hidden className="absolute left-1/2 top-1.5 ml-2.5 size-2.5 rounded-full bg-orange" />
          ) : null}
        </button>
      </nav>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} labelledBy="more-sheet-title" maxWidthClass="sm:max-w-sm">
        <div id="more-sheet" className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 id="more-sheet-title" className="text-lg font-bold text-ink">
              Más
            </h2>
            <button
              type="button"
              data-autofocus
              onClick={() => setMoreOpen(false)}
              aria-label="Cerrar"
              className="flex size-11 items-center justify-center rounded-field text-ink-soft hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--tone)"
            >
              <Icon name="close" className="text-xl" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {groups.map((g, i) => (
              <section key={g.title ?? i} className="py-1">
                {g.title ? (
                  <h3 className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-ink-faint">{g.title}</h3>
                ) : null}
                <ul>
                  {g.items.map((it) => {
                    const active = isActive(pathname, it);
                    return (
                      <li key={it.href}>
                        <Link
                          href={it.href}
                          onClick={() => setMoreOpen(false)}
                          aria-current={active ? "page" : undefined}
                          aria-label={ariaFor(it)}
                          className={`flex min-h-12 items-center gap-3 rounded-field px-3 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-(--tone) ${
                            active ? "bg-(--tone-tint) text-(--tone-700)" : "text-ink-soft active:bg-cream-2"
                          }`}
                        >
                          <Icon name={it.icon} className="shrink-0 text-xl" />
                          <span className="min-w-0 flex-1">{it.label}</span>
                          {it.trailing}
                          {it.badge ? (
                            <span
                              aria-hidden
                              className="flex min-w-5 items-center justify-center rounded-full bg-orange px-1.5 text-[11px] font-extrabold leading-5 text-white"
                            >
                              {it.badge}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            <div className="mt-1 border-t border-line pt-2">
              <p className="truncate px-3 pb-1 text-xs text-ink-faint">{userEmail}</p>
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex min-h-12 w-full items-center gap-3 rounded-field px-3 text-left text-[15px] font-semibold text-ink-soft active:bg-cream-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-(--tone)"
                >
                  <Icon name="logout" className="shrink-0 text-xl" />
                  Salir
                </button>
              </form>
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}
