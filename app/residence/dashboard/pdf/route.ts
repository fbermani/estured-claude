import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getOwnerResidenceCards } from "@/lib/residences/ownerDashboard";
import { PortfolioPdfDocument } from "@/lib/residences/PortfolioPdfDocument";

export const runtime = "nodejs";

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "No disponible en este momento." }, { status: 503 });

  const residences = await getOwnerResidenceCards(admin, sessionUser.id);
  if (residences.length === 0) return NextResponse.json({ error: "No tenés residencias cargadas." }, { status: 404 });

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
