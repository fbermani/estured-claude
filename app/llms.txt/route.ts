import { SITE_URL } from "@/lib/siteUrl";
import { getAllGuides } from "@/lib/guides/load";

/**
 * /llms.txt: resumen del sitio para buscadores y asistentes de IA (convención llmstxt.org).
 * Reglas de copy del proyecto: «visitadas en persona» (LEG-017: sin «verificadas» mientras no haya publicadas), «solicitud sujeta a confirmación», «Soporte»; sin promesas de disponibilidad.
 */
export function GET() {
  const guides = getAllGuides();
  const body = [
    "# EstuRed",
    "",
    "> EstuRed conecta a estudiantes y familias con residencias estudiantiles de la Ciudad Autónoma de Buenos Aires (CABA) que visita en persona antes de publicarlas. Las solicitudes quedan registradas y sujetas a confirmación de cada residencia; la reserva se confirma con un comprobante de reserva. EstuRed es una plataforma intermediaria: no es una residencia ni garantiza disponibilidad.",
    "",
    "## Páginas principales",
    `- [Buscar residencias](${SITE_URL}/search): catálogo de residencias publicadas tras la visita presencial, con filtros por barrio, universidad, servicios y precio.`,
    `- [Para estudiantes y familias](${SITE_URL}/for-students): cómo funciona una solicitud y qué queda registrado.`,
    `- [Para residencias](${SITE_URL}/for-residences): cómo publicar una residencia en EstuRed.`,
    `- [Nosotros y cómo verificamos](${SITE_URL}/nosotros): qué es EstuRed y qué revisa la visita presencial a cada residencia.`,
    `- [Verificar un comprobante](${SITE_URL}/verify): comprobación de comprobantes de reserva.`,
    "",
    "## Guías",
    `- [Centro de Guías](${SITE_URL}/guias): recursos gratuitos para elegir residencia, mudarte a Buenos Aires y convivir mejor.`,
    ...guides.map((g) => `- [${g.title}](${SITE_URL}/guias/${g.slug}): ${g.description}`),
    "",
    "## Legal",
    `- [Términos y condiciones](${SITE_URL}/terms)`,
    `- [Política de privacidad](${SITE_URL}/privacy)`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600, s-maxage=3600" } });
}
