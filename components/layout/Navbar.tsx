"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { BrandMark } from "@/components/ui/BrandMark";

type NavLink = { href: string; label: string; extra?: string };
const SEARCH_LINK: NavLink = { href: "/search", label: "Buscar residencias" };
const links: NavLink[] = [
  { href: "/for-students", label: "Para estudiantes", extra: "y familias" },
  { href: "/for-residences", label: "Para residencias" },
  { href: "/guias", label: "Guías" },
];
const mobileLinks = [SEARCH_LINK, ...links];

type SessionHint =
  | { status: "guest" }
  | { status: "signedIn"; href: string; initial: string };

/** Hay cookie-pista `er-has-session` (las de Supabase son httpOnly; no prueba que la sesión sea válida: eso lo confirma /api/session). */
function hasSessionCookie(): boolean {
  return document.cookie.split(";").some((c) => c.trim() === "er-has-session=1");
}

/**
 * Confirma la sesión contra /api/session (H15). Se re-evalúa en cada cambio
 * de ruta: un login con redirect blando, o un logout, no recargan la página.
 * `resolved` pasa a true cuando ya se sabe qué mostrar.
 */
function useSessionHint(pathname: string): { session: SessionHint; resolved: boolean } {
  const [session, setSession] = useState<SessionHint>({ status: "guest" });
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!hasSessionCookie()) {
      setSession((prev) => (prev.status === "guest" ? prev : { status: "guest" }));
      setResolved(true);
      return;
    }
    let cancelled = false;
    // Timeout de 4 s: si la red o la función quedan colgadas, cae en el .catch y se muestra la barra de invitado
    // (el slot de acceso nunca queda oculto de forma permanente).
    fetch("/api/session", { cache: "no-store", signal: AbortSignal.timeout(4000) })
      .then((res) => (res.ok ? res.json() : { signedIn: false }))
      .then((data) => {
        if (cancelled) return;
        setSession(
          data.signedIn
            ? { status: "signedIn", href: data.href, initial: data.initial }
            : { status: "guest" },
        );
        setResolved(true);
      })
      .catch(() => {
        if (cancelled) return;
        setSession({ status: "guest" });
        setResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return { session, resolved };
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { session, resolved } = useSessionHint(pathname);

  // Una vez confirmada la sesión se muestra el slot de acceso (el script de
  // app/layout.tsx lo deja invisible antes del primer pintado si hay cookie).
  useEffect(() => {
    if (resolved) document.documentElement.removeAttribute("data-session-hint");
  }, [resolved]);

  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  // Cierra al navegar (el menú es una hoja encima del contenido).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Hoja abierta: Esc cierra, scroll de fondo bloqueado, foco atrapado y devuelto al botón, resto de la página inerte.
  useEffect(() => {
    if (!open) return;
    const toggle = toggleRef.current;
    // Solo se inertan los bloques que NO contienen la barra: en la vista previa de preapertura (modo dev) la barra va dentro de <main>,
    // y volver inerte a su propio ancestro dejaba el menú sin respuesta y sin forma de cerrarlo.
    const outside = (el: Element | null) => (el && !el.contains(toggle) && !el.contains(menuRef.current) ? el : null);
    const main = outside(document.getElementById("main-content") ?? document.querySelector("main"));
    const footer = outside(document.querySelector("body > footer, footer"));
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    main?.setAttribute("inert", "");
    footer?.setAttribute("inert", "");
    const focusables = () =>
      Array.from(
        [toggle, ...(menuRef.current?.querySelectorAll<HTMLElement>("a[href], button") ?? [])].filter(
          (el): el is HTMLElement => !!el,
        ),
      );
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        restoreFocus.current = true;
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    // Desde lg el menú no existe: si se agranda la ventana, se cierra.
    const mq = window.matchMedia("(min-width:1024px)");
    const onMq = () => mq.matches && setOpen(false);
    mq.addEventListener("change", onMq);
    menuRef.current?.querySelector<HTMLElement>("a[href]")?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      mq.removeEventListener("change", onMq);
      document.documentElement.style.overflow = prevOverflow;
      main?.removeAttribute("inert");
      footer?.removeAttribute("inert");
      if (restoreFocus.current) toggle?.focus();
      restoreFocus.current = false;
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/86 backdrop-blur-md backdrop-saturate-150">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="EstuRed, inicio">
          <BrandMark size={34} />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-bold transition duration-200 ease-out-fresh focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${
                pathname === link.href
                  ? "bg-forest-tint text-forest-700"
                  : "text-ink-soft hover:bg-cream-2 hover:text-forest-700"
              }`}
            >
              {link.extra ? (
                <span>
                  {link.label}
                  <span className="ml-1 font-semibold opacity-75">{link.extra}</span>
                </span>
              ) : (
                link.label
              )}
            </Link>
          ))}
          <div
            className="ml-3 flex min-h-[46px] min-w-[22rem] items-center justify-end gap-2 [html[data-session-hint]_&]:invisible"
          >
            {session.status === "guest" && (
              <>
                <Button href="/login" variant="ghost" size="sm">
                  Ingresar
                </Button>
                <Button href="/register" variant="outline-forest" size="sm">
                  Crear cuenta
                </Button>
                <Button href="/search" size="sm">
                  <Icon name="search" className="text-lg" />
                  Buscar residencias
                </Button>
              </>
            )}
            {session.status === "signedIn" && (
              <>
                <Button href="/search" variant="ghost" size="sm">
                  Buscar residencias
                </Button>
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-tint text-sm font-bold text-forest-700"
                >
                  {session.initial}
                </span>
                <Button href={session.href} size="sm">
                  Mi panel
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
        <Button href="/search" size="sm" className="!px-4">
          Buscar
        </Button>
        {session.status === "signedIn" && (
          <Link
            href={session.href}
            aria-label="Mi panel"
            className="flex size-11 items-center justify-center rounded-full bg-forest-tint text-base font-bold text-forest-700 transition-colors hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            {session.initial}
          </Link>
        )}
        <button
          ref={toggleRef}
          className="flex size-12 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          onClick={() => {
            restoreFocus.current = true;
            setOpen(!open);
          }}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
        >
          <Icon name={open ? "close" : "menu"} className="text-2xl" />
        </button>
        </div>
      </nav>

      {open && (
        <div
          id="mobile-menu"
          ref={menuRef}
          className="absolute inset-x-0 top-full h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-line bg-paper px-4 py-4 lg:hidden"
        >
          <div className="flex flex-col gap-1">
            {mobileLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`flex min-h-12 items-center rounded-field px-3 text-base font-bold ${
                  pathname === link.href
                    ? "bg-forest-tint text-forest-700"
                    : "text-ink-soft"
                }`}
              >
                {link.label}
                {link.extra && <span className="ml-1 text-xs font-semibold opacity-75">{link.extra}</span>}
              </Link>
            ))}
            <Link
              href="/instalar"
              onClick={() => setOpen(false)}
              className={`flex min-h-12 items-center gap-2 rounded-field px-3 text-base font-bold ${
                pathname === "/instalar" ? "bg-forest-tint text-forest-700" : "text-ink-soft"
              }`}
            >
              <Icon name="install_mobile" className="text-xl" />
              Instalá la app
            </Link>
            {session.status === "guest" && (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 items-center rounded-field px-3 text-base font-bold text-ink-soft"
                >
                  Ingresar
                </Link>
                <Button href="/register" variant="outline-forest" size="md" className="mt-3 w-full">
                  Crear cuenta
                </Button>
              </>
            )}
            {session.status === "signedIn" && (
              <Button href={session.href} size="md" className="mt-3 w-full">
                Mi panel
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
