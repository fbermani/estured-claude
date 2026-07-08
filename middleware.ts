import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSafeUser } from "@/lib/supabase/safe-get-user";

/**
 * Middleware de sesión y protección de áreas autenticadas.
 *
 * - Refresca el token de Supabase en cada request (patrón @supabase/ssr).
 * - Exige sesión para /students, /residence y /admin; sin sesión
 *   redirige a /login?next=<ruta>.
 * - La validación de ROL fina se hace server-side en el layout de cada
 *   área (docs/11 §7: el middleware no alcanza como única barrera).
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const user = await getSafeUser(supabase);

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/students/:path*", "/residence/:path*", "/admin/:path*"],
};
