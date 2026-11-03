import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { loadCurrentRegulation } from "@/lib/regulations/current";
import { renderToBuffer } from "@react-pdf/renderer";
import { RegulationPdfDocument } from "@/lib/regulations/RegulationPdfDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Descarga del reglamento vigente de una residencia publicada en PDF (DR18). Es el mismo contenido público que se lee en la
 * ficha (propio o, si no tiene, el modelo de EstuRed). Residencias no publicadas: 404.
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
