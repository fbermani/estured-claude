import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FichaView } from "@/components/residences/ficha/FichaView";
import { PreviewBanner } from "@/components/residences/ficha/PreviewBanner";
import { getSessionUser } from "@/lib/auth/session";
import { loadPreviewFicha } from "@/lib/residences/loadFicha";

// Título genérico y noindex: este metadata NO usa el nombre de la residencia (es una página privada del equipo).
export const metadata: Metadata = { title: "Vista previa de tu ficha", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Vista previa de la ficha pública para el equipo de ESA residencia, en cualquier estado (borrador, cambios pedidos, en verificación,
 * publicada…), con lo último guardado. Renderiza la MISMA ficha (`FichaView`) en modo `preview`: sin sesión de estudiante, sin acciones ni
 * enlaces que dependan de que esté publicada. El acceso lo decide `loadPreviewFicha`: solo dueño o staff activo de esta residencia
 * (cualquiera de los dos, es solo lectura); a cualquier otra persona le devuelve 404 sin leer nada de la residencia.
 */
export default async function ResidencePreviewPage({ params }: { params: Promise<{ residence_id: string }> }) {
  const { residence_id: residenceId } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect(`/login?next=${encodeURIComponent(`/residence/${residenceId}/preview`)}`);

  const data = await loadPreviewFicha(sessionUser.id, residenceId);
  if (!data) notFound();
  const { residence } = data;

  return (
    <>
      <PreviewBanner residenceId={residenceId} status={String(residence.status ?? "")} />
      <main id="contenido" tabIndex={-1} className="focus:outline-none">
        <FichaView data={data} slug={String(residence.slug ?? "")} preview />
      </main>
    </>
  );
}
