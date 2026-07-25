import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Ciclo 41quinquies: el detalle de solicitud se unificó dentro del
 * inbox de 3 columnas de /applications (selección por ?app=). Esta
 * ruta se deja como redirect para no romper links existentes (ej. la
 * tabla "Solicitudes recientes" del panel, o el redirect de
 * negotiation/actions.ts tras enviar una propuesta).
 */
export default async function ResidenceApplicationDetailRedirect({
  params,
}: {
  params: Promise<{ residence_id: string; id: string }>;
}) {
  const { residence_id: residenceId, id } = await params;
  redirect(`/residence/${residenceId}/applications?app=${id}`);
}
