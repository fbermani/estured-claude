import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { loadCurrentRegulation } from "@/lib/regulations/current";
import { renderPlaceholders } from "@/lib/regulations/modelTemplate";

export const dynamic = "force-dynamic";

/**
 * Descarga del reglamento vigente de una residencia publicada como archivo de texto (DR18). Es el mismo contenido público que se lee en la
 * ficha (propio o, si no tiene, el modelo de EstuRed). Sin dependencias nuevas ni PDF. Residencias no publicadas: 404.
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

  const header = [
    `Reglamento de convivencia — ${residence.name as string}`,
    view.isBaseModel
      ? "Esta residencia todavía no cargó su propio reglamento: este es el modelo de convivencia de EstuRed. Consultá con la residencia los puntos que quieras confirmar."
      : view.versionNumber != null
        ? `Versión ${view.versionNumber}`
        : "",
    "",
  ].filter((l, i) => l !== "" || i === 2);
  const body = `${header.join("\n")}\n${renderPlaceholders(view.text)}\n`;
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, "").slice(0, 80) || "residencia";
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="reglamento-${safeSlug}.txt"`,
      "Cache-Control": "no-store",
    },
  });
}
