import { NextResponse } from "next/server";
import { getSessionUser, roleHome } from "@/lib/auth/session";

/**
 * Estado de sesión mínimo para la navbar pública (H15, auditoría
 * 2026-10-20). Las páginas públicas se prerenderizan estáticas, así que
 * la barra no puede leer cookies en el servidor sin volverlas dinámicas:
 * el componente cliente consulta este endpoint solo cuando hay indicio
 * de sesión. Devuelve únicamente datos del propio usuario (su home y la
 * inicial de su email), nunca roles ni identificadores.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  const body = user
    ? {
        signedIn: true as const,
        href: roleHome(user),
        initial: (user.email.trim()[0] ?? "?").toUpperCase(),
      }
    : { signedIn: false as const };
  // `private` + `Vary: Cookie`: defensa en profundidad para que ningún proxy/CDN comparta la respuesta
  // de un usuario con otro (la ruta ya es dinámica y `no-store` ya lo prohíbe).
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } });
}
