"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

type Target = { href: string; label: string };

/**
 * CTA de la entrada de preapertura para quien YA tiene cuenta (2026-11-12): la entrada es estática (revalidate 60), así que no
 * puede leer la sesión en el servidor. Si hay cookie-pista `er-has-session`, confirma contra `/api/session` (mismo patrón que la
 * Navbar, H15) y cambia «Quiero enterarme primero» por el acceso a su lugar. Estudiantes y familiares van a «Mi lugar» (su único destino en
 * preapertura, DR42.3); admin y residencias, a su panel. Sin sesión deja el CTA original (`children`).
 */
export function SignedInEntryCta({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<Target | null>(null);

  useEffect(() => {
    if (!document.cookie.split(";").some((c) => c.trim() === "er-has-session=1")) return;
    let alive = true;
    fetch("/api/session", { cache: "no-store", signal: AbortSignal.timeout(4000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { signedIn?: boolean; href?: string } | null) => {
        if (!alive || !s?.signedIn || typeof s.href !== "string") return;
        setTarget(s.href.startsWith("/students") ? { href: "/mi-lugar", label: "Ver mi lugar" } : { href: s.href, label: "Ir a mi panel" });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!target) return <>{children}</>;
  return (
    <Button href={target.href} variant="secondary" size="lg" className="pre-cta w-full shadow-orange">
      {target.label}
      <Icon name="arrow_forward" className="text-xl" />
    </Button>
  );
}
