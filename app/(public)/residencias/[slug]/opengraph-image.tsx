import { OG_SIZE } from "@/lib/share/ogCard";
import { renderShareImage } from "./_og/renderShareImage";

/**
 * Imagen de vista previa del link de la ficha (Open Graph, 1200×630): lo que se ve al pegar `estured…/r/<slug>` en WhatsApp.
 * Next la publica sola como `og:image` de `/residencias/[slug]` (por eso `generateMetadata` ya no declara `images`).
 * Su URL lleva un sufijo que Next calcula por el grupo `(public)`: dentro de la app usar `vista-previa/`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = OG_SIZE;
// JPEG liviano (50–90 KB): WhatsApp no muestra la vista previa si la imagen pesa más de ~300 KB, y el PNG de satori con foto pasa los 400 KB.
export const contentType = "image/jpeg";
export const alt = "Ficha de residencia verificada en EstuRed";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderShareImage(slug);
}
