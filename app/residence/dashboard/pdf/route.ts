import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getOwnerResidenceCards } from "@/lib/residences/ownerDashboard";
import { OWNER_ONLY_MESSAGE } from "@/lib/residences/permissions";
import { PortfolioPdfDocument } from "@/lib/residences/PortfolioPdfDocument";

export const runtime = "nodejs";

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "No disponible en este momento." }, { status: 503 });

  // DR10: el reporte es solo del dueño y solo incluye las residencias donde la persona es dueña (el staff recibe 403).
  const residences = await getOwnerResidenceCards(admin, sessionUser.id, { ownerOnly: true });
  if (residences.length === 0) {
    // 403 si la cuenta tiene vínculos activos pero ninguno de dueño (es solo staff); 404 solo si no tiene ninguna residencia. Se decide
    // por los vínculos reales de `residence_users`, no por el rol global de la cuenta.
    const { count, error: countError } = await admin
      .from("residence_users")
      .select("id", { count: "exact", head: true })
      .eq("user_id", sessionUser.id)
      .eq("is_active", true);
    // Si la lectura falla no se sabe si la cuenta es solo staff o no tiene residencias: se responde "no disponible", no un 404 engañoso.
    if (countError) {
      console.error("[portfolio-pdf] residence_users count failed:", countError.code, countError.message);
      return NextResponse.json({ error: "No pudimos generar el reporte en este momento. Probá de nuevo en unos minutos." }, { status: 503 });
    }
    return (count ?? 0) > 0
      ? NextResponse.json({ error: OWNER_ONLY_MESSAGE }, { status: 403 })
      : NextResponse.json({ error: "No tenés residencias cargadas." }, { status: 404 });
  }

  const buffer = await renderToBuffer(
    PortfolioPdfDocument({
      ownerEmail: sessionUser.email,
      generatedAt: new Date().toISOString(),
      residences,
    }),
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="reporte-residencias-${new Date().toISOString().slice(0, 10)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
