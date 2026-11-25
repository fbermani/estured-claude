"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { loadMetaPixelWithConsent, trackMetaEvent } from "@/lib/analytics/metaPixel";
import { CONSENT_EVENT, readConsent, type Consent } from "@/lib/analytics/consent";

/**
 * Carga el pixel solo si el servidor pasó un ID (producción con la variable) Y la persona aceptó las cookies (`er-consent=granted`).
 * Cuenta `PageView` en cada navegación. Si acepta en la misma sesión, arranca sin recargar y cuenta la pantalla actual.
 * Con `denied` o sin elección no carga el script ni dispara eventos.
 */
export function MetaPixel({ pixelId }: { pixelId: string | null }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<Consent | null>(null);

  useEffect(() => {
    setConsent(readConsent());
    const onChange = () => setConsent(readConsent());
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!loadMetaPixelWithConsent(pixelId, consent)) return;
    trackMetaEvent("PageView");
  }, [pixelId, pathname, consent]);

  return null;
}
