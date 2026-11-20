import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { loadCurrentRegulation } from "@/lib/regulations/current";
import { REGULATION_PDF_BUCKET } from "@/lib/regulations/pdfFile";
import { renderToBuffer } from "@react-pdf/renderer";
import { RegulationPdfDocument } from "@/lib/regulations/RegulationPdfDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Descarga del reglamento vigente de una residencia publicada en PDF (DR18). Es el mismo contenido público que se lee en la
 * ficha (propio o, si no tiene, el modelo de EstuRed). Residencias no publicadas: 404.
 *
 * Si la residencia no tiene reglamento propio pero subió su PDF (`residence_rules_document`, ya aprobado y público por diseño, igual
 * que antes en la ficha), se redirige a un enlace firmado de 60 s generado en este momento: así el botón de la ficha no vence aunque la
 * pestaña quede abierta (antes se firmaba por 10 min al renderizar la página). El service role nunca sale del servidor.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = getSupabaseAdmin();
  if (!admin) return new Response("No disponible.", { status: 503 });

  const { data: residence } = await admin
    .from("residences")
    .select("id, name, status")
    .eq("slug", slug)
    .eq("status", "verified_active")
    .maybeSingle();
  if (!residence) return new Response("No encontramos esta residencia.", { status: 404 });

  const result = await loadCurrentRegulation(admin, residence.id as string);
  // DR62 a: si la versión vigente ES un PDF, se entrega ese archivo (el mismo que acepta el estudiante).
  if (result.ok && result.view.pdf) {
    const safeName = slug.replace(/[^a-z0-9-]/gi, "").slice(0, 80) || "residencia";
    const { data: signed, error: signedError } = await admin.storage
      .from(REGULATION_PDF_BUCKET)
      .createSignedUrl(result.view.pdf.path, 60, { download: `reglamento-${safeName}.pdf` });
    if (signedError || !signed?.signedUrl) {
      console.error("[reglamento] no se pudo firmar el PDF de la versión:", signedError);
      return new Response("No pudimos cargar el reglamento. Probá de nuevo en unos minutos.", { status: 503 });
    }
    return Response.redirect(signed.signedUrl, 302);
  }
  const hasOwnRegulation = result.ok && !result.view.isBaseModel;
  if (!hasOwnRegulation) {
    const { data: file } = await admin
      .from("files")
      .select("storage_path")
      .eq("related_entity_type", "residences")
      .eq("related_entity_id", residence.id as string)
      .eq("document_type", "residence_rules_document")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (file?.storage_path) {
      const safeName = slug.replace(/[^a-z0-9-]/gi, "").slice(0, 80) || "residencia";
      const { data: signed, error: signedError } = await admin.storage
        .from("private-residence-documents")
        .createSignedUrl(file.storage_path as string, 60, { download: `reglamento-${safeName}.pdf` });
      if (signedError) console.error("[reglamento] no se pudo firmar el PDF:", signedError);
      if (signed?.signedUrl) return Response.redirect(signed.signedUrl, 302);
    }
  }
  if (!result.ok) return new Response("No pudimos cargar el reglamento. Probá de nuevo en unos minutos.", { status: 503 });
  const { view } = result;

  const buffer = await renderToBuffer(
    RegulationPdfDocument({
      residenceName: residence.name as string,
      text: view.text,
      versionNumber: view.versionNumber,
      isBaseModel: view.isBaseModel,
    }),
  );
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, "").slice(0, 80) || "residencia";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="reglamento-${safeSlug}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
