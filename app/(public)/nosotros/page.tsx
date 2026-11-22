import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/constants/contact";
import { pageMetadata } from "@/lib/seo/pageMeta";
import { SITE_URL } from "@/lib/siteUrl";

export const metadata: Metadata = pageMetadata({
  title: "Nosotros y cómo verificamos",
  description:
    "Qué es EstuRed y cómo verificamos cada residencia: identidad, dirección y fotos revisadas en una visita presencial. Y qué no garantiza el sello.",
  path: "/nosotros",
});

const h2 = "mt-10 text-2xl font-bold text-ink";
const p = "mt-3 text-base leading-relaxed text-ink-soft";
const li = "mt-2 text-base leading-relaxed text-ink-soft";

/** Página institucional + «Cómo verificamos». El contenido sale de docs/03 §5.2–5.4 y docs/19 §6.6; sin datos inventados. */
export default function NosotrosPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        "@id": `${SITE_URL}/nosotros#pagina`,
        url: `${SITE_URL}/nosotros`,
        name: "Nosotros y cómo verificamos",
        inLanguage: "es-AR",
        about: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Nosotros", item: `${SITE_URL}/nosotros` },
        ],
      },
    ],
  };
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <h1 className="text-3xl font-bold text-ink sm:text-4xl">Nosotros y cómo verificamos</h1>
      <p className={p}>
        EstuRed es una plataforma que conecta a estudiantes con residencias estudiantiles verificadas en persona en la Ciudad de
        Buenos Aires. No somos una residencia: ordenamos las solicitudes y dejamos todo registrado, para que elijas con más
        información y menos incertidumbre.
      </p>

      <h2 className={h2}>Cómo verificamos cada residencia</h2>
      <p className={p}>
        Una residencia aparece como verificada solo después de una visita presencial. Esto es lo que revisamos antes de publicarla:
      </p>
      <ul className="mt-2 list-disc pl-6">
        <li className={li}>La identidad del responsable de la residencia y, si lo hay, del coordinador.</li>
        <li className={li}>Que la dirección existe y que la residencia funciona ahí.</li>
        <li className={li}>Que las fotos publicadas se parecen razonablemente al lugar real.</li>
      </ul>

      <h2 className={h2}>La visita presencial</h2>
      <p className={p}>
        Es obligatoria y la hace una persona de EstuRed en la residencia. Usamos una lista de control en cada visita y queda registrada la
        fecha.
      </p>

      <h2 className={h2}>Cada cuánto se renueva</h2>
      <p className={p}>
        La verificación se renueva todos los años. Si vence sin renovarse, la residencia puede perder el sello y dejar de mostrarse
        en la búsqueda.
      </p>

      <h2 className={h2}>Qué no garantiza el sello</h2>
      <p className={p}>
        Verificada no significa garantía de calidad, de convivencia ni de que se cumpla todo lo legal. No certifica habilitaciones,
        seguridad edilicia ni seguros. Tampoco garantiza que los precios o las condiciones no cambien. Verificamos identidad,
        ubicación y fotos mediante control presencial.
      </p>

      <h2 className={h2}>Si algo no coincide con lo publicado</h2>
      <p className={p}>
        Abrís un caso de Soporte desde tu reserva. Revisamos lo que pasó, hablamos con la residencia y, si hace falta, te acompañamos
        para encontrar otra opción.
      </p>

      <h2 className={h2}>Contacto</h2>
      <p className={p}>
        ¿Dudas? Escribinos a{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold underline">
          {CONTACT_EMAIL}
        </a>
        . Mientras tanto, podés <Link href="/search" className="font-semibold underline">explorar las residencias</Link> o leer
        nuestras <Link href="/guias" className="font-semibold underline">guías</Link>.
      </p>
    </div>
  );
}
