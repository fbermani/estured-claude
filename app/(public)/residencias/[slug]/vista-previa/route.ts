import { renderShareImage } from "../_og/renderShareImage";

/**
 * La misma imagen que el `og:image` de la ficha, en una URL estable (`/residencias/<slug>/vista-previa`) para la miniatura de
 * «Compartir tu ficha». La URL del `og:image` lleva un sufijo que cambia si se mueve la carpeta.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderShareImage(slug);
}
