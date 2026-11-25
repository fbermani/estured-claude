import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * DR65 (d): destino del enlace de confirmación del alta. Verifica el token de un solo uso con la sesión del navegador (cookies): Supabase
 * marca el email como confirmado y abre la sesión. Sin token válido, vuelve al login con un aviso.
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const fail = new URL("/login?confirmar=error", request.url);
  if (!tokenHash || type !== "magiclink") return NextResponse.redirect(fail);
  const supabase = await getSupabaseServer();
  if (!supabase) return NextResponse.redirect(fail);
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (error) {
    console.warn("[email-confirm] verifyOtp:", error.code ?? error.status);
    return NextResponse.redirect(fail);
  }
  return NextResponse.redirect(new URL("/students/dashboard", request.url));
}
