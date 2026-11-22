import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/pageMeta";
import Link from "next/link";
import { PRIVACY_SECTIONS } from "@/lib/legal/privacyText";
import { LEGAL_DOCUMENTS } from "@/lib/legal/versions";
import { LEGAL_OPERATOR, OPERATOR_SECTION_HREF } from "@/lib/legal/operator";
import { PreaperturaPrivacyBody } from "@/components/preapertura/legal/LegalPreapertura";
import { isPreaperturaOn } from "@/lib/preapertura/flag";

export const metadata: Metadata = pageMetadata({
  title: "Política de privacidad",
  description: "Qué datos recolecta EstuRed, para qué los usa, y cómo ejercer tus derechos sobre ellos.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-bold text-ink sm:text-4xl">Política de privacidad</h1>
      <p className="mt-3 text-sm text-ink-faint">
        Última actualización: {LEGAL_DOCUMENTS.privacy.updatedLabel}. Responsable: el titular identificado en{" "}
        <Link href={OPERATOR_SECTION_HREF} className="font-semibold underline">
          Términos y condiciones › Quiénes somos
        </Link>
        . Consultas sobre tus datos:{" "}
        <a href={`mailto:${LEGAL_OPERATOR.privacyEmail}`} className="font-semibold underline">
          {LEGAL_OPERATOR.privacyEmail}
        </a>
        .
      </p>

      <p className="mt-8 text-ink-soft">
        EstuRed es una plataforma intermediaria de búsqueda, solicitud y reserva de alojamiento estudiantil. Esta
        página explica qué datos personales recolectamos, para qué los usamos, con quién los compartimos y cuáles
        son tus derechos sobre ellos.
      </p>

      {isPreaperturaOn() && (
        <section id="preapertura" className="mt-10 scroll-mt-20 rounded-card border-[1.5px] border-forest/30 bg-forest-tint p-5 sm:p-6">
          <h2 className="text-xl font-bold text-ink">Política de privacidad de la preapertura</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Mientras EstuRed esté en preapertura rige esta sección; lo demás aplica cuando abramos.
          </p>
          <div className="mt-3">
            <PreaperturaPrivacyBody />
          </div>
        </section>
      )}

      <div className="mt-10 space-y-10">
        {PRIVACY_SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="text-xl font-bold text-ink">{s.title}</h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-soft sm:text-base">
              {s.paras?.map((p) => <p key={p}>{p}</p>)}
              {s.items && (
                <ul className="list-disc space-y-1.5 pl-5">
                  {s.items.map((i) => <li key={i}>{i}</li>)}
                </ul>
              )}
              {s.after?.map((p) => <p key={p}>{p}</p>)}
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
