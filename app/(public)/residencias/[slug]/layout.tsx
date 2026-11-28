import { notFound } from "next/navigation";
import { loadPublicFicha } from "@/lib/residences/loadFicha";

/**
 * El código HTTP se decide acá, por encima del `loading.tsx` del segmento: si `notFound()` corre dentro de la página, la respuesta ya
 * empezó (skeleton) y una ficha inexistente sale 200. Cubre también las direcciones viejas que llegan por `/r/[slug]`.
 * `loadPublicFicha` está cacheada: no repite consultas con la página.
 */
export default async function PublicResidenceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await loadPublicFicha(slug))) notFound();
  return children;
}
