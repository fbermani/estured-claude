import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/pageMeta";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/constants/contact";
import { TERMS_SECTIONS } from "@/lib/legal/termsText";
import { LEGAL_DOCUMENTS } from "@/lib/legal/versions";
import { PreaperturaTermsBody } from "@/components/preapertura/legal/LegalPreapertura";
import { isPreaperturaOn } from "@/lib/preapertura/flag";

export const metadata: Metadata = pageMetadata({
  title: "Términos y condiciones",
  description:
    "Las reglas de uso de EstuRed para estudiantes y familias: qué es la plataforma, cómo funcionan las solicitudes, el fee y los comprobantes.",
  path: "/terms",
});

/** Términos para estudiantes y familias. El texto vive en `lib/legal/termsText.ts` (versión en `lib/legal/versions.ts`). */

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-bold text-ink sm:text-4xl">Términos y condiciones</h1>
      <p className="mt-3 text-sm text-ink-faint">
        Para estudiantes y familias. Última actualización: {LEGAL_DOCUMENTS.terms.updatedLabel}. Consultas:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold underline">
          {CONTACT_EMAIL}
        </a>
        .
      </p>

      <p className="mt-8 text-ink-soft">
        EstuRed es una plataforma intermediaria de búsqueda, solicitud, registro y comprobante de alojamiento
        estudiantil. Esta página explica las reglas que aceptás al usar la plataforma. Leela junto con la{" "}
        <Link href="/privacy" className="font-semibold text-forest-700 underline">
          política de privacidad
        </Link>
        .
      </p>

      {isPreaperturaOn() && (
        <section id="preapertura" className="mt-10 scroll-mt-20 rounded-card border-[1.5px] border-forest/30 bg-forest-tint p-5 sm:p-6">
          <h2 className="text-xl font-bold text-ink">Términos de la preapertura</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Mientras EstuRed esté en preapertura rige esta sección; lo demás aplica cuando abramos.
          </p>
          <div className="mt-3">
            <PreaperturaTermsBody />
          </div>
        </section>
      )}

      <div className="mt-10 space-y-10">
        {TERMS_SECTIONS.map((s) => (
          <section key={s.title} id={s.id} className={s.id ? "scroll-mt-20" : undefined}>
            <h2 className="text-xl font-bold text-ink">{s.title}</h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-soft sm:text-base">
              {s.paras?.map((p) => <p key={p}>{p}</p>)}
              {s.defs && (
                <dl className="space-y-3">
                  {s.defs.map(([term, text]) => (
                    <div key={term}>
                      <dt className="inline font-bold text-ink">{term}: </dt>
                      <dd className="inline">{text}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {s.items && (
                <ul className="list-disc space-y-1.5 pl-5">
                  {s.items.map((i) => <li key={i}>{i}</li>)}
                </ul>
              )}
              {s.sub && (
                <>
                  <h3 className="pt-2 text-base font-bold text-ink">{s.sub.title}</h3>
                  {s.sub.paras?.map((p) => <p key={p}>{p}</p>)}
                </>
              )}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-12 text-sm text-ink-faint">
        Volver a{" "}
        <Link href="/" className="font-semibold text-forest-700 underline">
          EstuRed
        </Link>
        .
      </p>
    </div>
  );
}
