"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

/** Hay cookie de sesión de Supabase (no prueba que sea válida: eso lo confirma /api/session). */
function hasSessionCookie(): boolean {
  return document.cookie
    .split(";")
    .some((c) => {
      const name = c.trim().split("=")[0];
      return name.startsWith("sb-") && name.includes("auth-token");
    });
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

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
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
              className={`rounded-full px-3.5 py-2 text-sm font-bold transition-all duration-300 ease-bounce focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${
                pathname === link.href
                  ? "bg-forest-tint text-forest-700"
                  : "text-ink-soft hover:bg-cream-2 hover:text-forest-700"
              }`}
            >
              {link.extra ? (
                <span className="flex flex-col items-center leading-tight">
                  {link.label}
                  <span className="text-[11px] font-semibold opacity-75">{link.extra}</span>
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
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-tint text-sm font-extrabold text-forest-700"
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
        <Button href="/search" size="sm" className="!h-10 !px-4">
          Buscar
        </Button>
        <button
          className="rounded-full p-2 text-ink-soft transition-colors hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
        >
          <Icon name={open ? "close" : "menu"} className="text-2xl" />
        </button>
        </div>
      </nav>

      {open && (
        <div id="mobile-menu" className="border-t border-line bg-paper px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-1">
            {mobileLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded-field px-3 py-2.5 text-sm font-bold ${
                  pathname === link.href
                    ? "bg-forest-tint text-forest-700"
                    : "text-ink-soft"
                }`}
              >
                {link.label}
                {link.extra && <span className="ml-1 text-xs font-semibold opacity-75">{link.extra}</span>}
              </Link>
            ))}
            {session.status === "guest" && (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-field px-3 py-2.5 text-sm font-bold text-ink-soft"
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
