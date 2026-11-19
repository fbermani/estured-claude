import { SITE_URL } from "@/lib/siteUrl";
import { CONTACT_EMAIL } from "@/lib/constants/contact";

/** /.well-known/security.txt (RFC 9116): canal para reportar vulnerabilidades. `Expires` es obligatorio: ~1 año desde el build. */
export function GET() {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const body = [
    `Contact: mailto:${CONTACT_EMAIL}`,
    `Expires: ${expires}`,
    "Preferred-Languages: es, en",
    `Canonical: ${SITE_URL}/.well-known/security.txt`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
