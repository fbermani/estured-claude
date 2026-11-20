import type { Metadata } from "next";
import { PreaperturaStage } from "@/components/preapertura/PreaperturaStage";
import { HomeBackdrop } from "@/components/preapertura/HomeBackdrop";
import { BackLink } from "@/components/preapertura/BackLink";
import { ConsentLines, PreaperturaPrivacyBody, PreaperturaTermsBody } from "@/components/preapertura/legal/LegalPreapertura";

export const metadata: Metadata = {
  title: "Términos y privacidad",
  description: "Lo que aceptás al sumarte a la preapertura de EstuRed, en claro: términos, búsqueda para residencias, comunidad pública y privacidad.",
};

const TOC = [
  { href: "#cuenta", label: "Lo que aceptás" },
  { href: "#terminos", label: "Términos" },
  { href: "#privacidad", label: "Privacidad" },
] as const;

const section = "scroll-mt-32 border-t border-line px-5 py-6 sm:px-9";
const h2 = "mb-3 font-display text-2xl font-bold tracking-tight text-ink";

/**
 * Pantalla de consentimientos de la preapertura (SPEC pantalla 8, DR45): las líneas del flujo, los Términos (con la búsqueda para
 * residencias y la comunidad pública) y la política de privacidad. Popup sobre la landing blureada con pestañas fijas arriba. Los
 * mismos textos viven como sección «Preapertura» en `/terms` y `/privacy`. Se abre en pestaña nueva desde el casillero del paso 1.
 */
export default function ConsentimientosPage() {
  return (
    <PreaperturaStage preview={<HomeBackdrop />} labelledBy="pre-legal-title" size="md" initialFocus="#pre-legal-back">
      <div>
        <div className="sticky top-0 z-[2] border-b border-line bg-paper px-5 pb-2 pt-3 sm:px-9">
          <BackLink id="pre-legal-back" />
          <nav aria-label="En esta página">
            <ul className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
              {TOC.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-cream px-4 text-sm font-bold text-ink-soft hover:bg-cream-2 hover:text-ink focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <header className="px-5 pb-5 pt-5 sm:px-9">
          <h1 id="pre-legal-title" className="font-display text-[clamp(28px,7vw,36px)] leading-tight tracking-tight text-ink">
            Términos y privacidad
          </h1>
          <p className="mt-2 text-ink-soft">Lo que aceptás al sumarte, en claro. En el registro solo ves una línea con casillero.</p>
        </header>

        <section id="cuenta" aria-labelledby="pre-legal-cuenta" className={section}>
          <h2 id="pre-legal-cuenta" className={h2}>
            Lo que aceptás al sumarte
          </h2>
          <ConsentLines />
        </section>

        <section id="terminos" aria-labelledby="pre-legal-terminos" className={section}>
          <h2 id="pre-legal-terminos" className={h2}>
            Términos de la preapertura
          </h2>
          <PreaperturaTermsBody />
        </section>

        <section id="privacidad" aria-labelledby="pre-legal-privacidad" className={`${section} pb-8`}>
          <h2 id="pre-legal-privacidad" className={h2}>
            Política de privacidad
          </h2>
          <PreaperturaPrivacyBody />
        </section>
      </div>
    </PreaperturaStage>
  );
}
