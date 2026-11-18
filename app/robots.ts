import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

const PRIVATE = ["/admin/", "/students/", "/residence/", "/family/", "/api/", "/register/"];

/** Solo el dominio definitivo se indexa: staging y previews (que usan otro NEXT_PUBLIC_SITE_URL) quedan cerrados a los buscadores. */
const IS_PRODUCTION_HOST = new URL(SITE_URL).hostname.replace(/^www\./, "") === "estured.com";

/** Crawlers de IA: permitidos a propósito (citan guías y fichas), con las mismas áreas privadas bloqueadas. */
const AI_CRAWLERS = ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Google-Extended"];

export default function robots(): MetadataRoute.Robots {
  if (!IS_PRODUCTION_HOST) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
