import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo/pageMeta";
import { RESIDENCE_TERMS_SECTIONS } from "@/lib/legal/residenceTermsText";
import { LEGAL_DOCUMENTS } from "@/lib/legal/versions";
import { OPERATOR_SECTION_HREF } from "@/lib/legal/operator";
import { CONTACT_EMAIL } from "@/lib/constants/contact";

export const metadata: Metadata = pageMetadata({
  title: "Condiciones para residencias",
  description: "Las condiciones entre EstuRed y las residencias que publican en la plataforma: verificación, cobros, datos y contenido.",
  path: "/terms/residencias",
});

/** LEG-013: condiciones propias de las residencias (TP-04). El texto vive en `lib/legal/residenceTermsText.ts`. */
export default function ResidenceTermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-bold text-ink sm:text-4xl">Condiciones para residencias</h1>
      <p className="mt-3 text-sm text-ink-faint">
        Última actualización: {LEGAL_DOCUMENTS.residence_terms.updatedLabel}. Datos del titular en{" "}
        <Link href={OPERATOR_SECTION_HREF} className="font-semibold underline">
          Términos y condiciones › Quiénes somos
        </Link>
        . Consultas:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold underline">
          {CONTACT_EMAIL}
        </a>
        .
      </p>

      <p className="mt-8 text-ink-soft">
        Estas condiciones las acepta cada residencia al darse de alta en EstuRed. Los estudiantes y las familias se rigen por los{" "}
        <Link href="/terms" className="font-semibold text-forest-700 underline">
          Términos y condiciones
        </Link>{" "}
        y la{" "}
        <Link href="/privacy" className="font-semibold text-forest-700 underline">
          Política de privacidad
        </Link>
        .
      </p>

      <div className="mt-10 space-y-10">
        {RESIDENCE_TERMS_SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="text-xl font-bold text-ink">{s.title}</h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-soft sm:text-base">
              {s.paras?.map((p) => <p key={p}>{p}</p>)}
              {s.items && (
                <ul className="list-disc space-y-1.5 pl-5">
                  {s.items.map((i) => <li key={i}>{i}</li>)}
                </ul>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
