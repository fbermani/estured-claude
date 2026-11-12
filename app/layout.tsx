import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import { DemoSwitcherGate } from "@/components/dev/DemoSwitcherGate";
import { isDemoLoginEnabled } from "@/lib/demoLogin";
import "./globals.css";

/** Sistema visual FRESH (design-references/fresh-style.md §1.2). */
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-hanken",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
  variable: "--font-bricolage",
});

export const metadata: Metadata = {
  title: {
    default: "EstuRed — Residencias estudiantiles verificadas en CABA",
    template: "%s | EstuRed",
  },
  description:
    "EstuRed te ayuda a elegir con confianza dónde empieza tu nueva etapa: residencias estudiantiles verificadas en CABA, con solicitudes registradas y comprobantes verificables.",
};

/** Color de la barra del navegador en mobile = --color-cream. Sin bloquear el zoom (WCAG 1.4.4). */
export const viewport: Viewport = {
  themeColor: "#fbf6ec",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning className={`${hanken.variable} ${bricolage.variable}`}>
      <head>
        {/* H15: si hay cookie-pista `er-has-session` (las de Supabase son httpOnly), marca <html> antes del primer pintado para que la
            navbar pública no muestre "Ingresar / Crear cuenta" a quien ya está logueado. La navbar
            lo quita cuando /api/session confirma la sesión. Las páginas siguen siendo estáticas. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(/(?:^|;\\s*)er-has-session=1/.test(document.cookie)){document.documentElement.setAttribute("data-session-hint","1")}}catch(e){}`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Material Symbols Outlined (design-references/fresh-style.md §1.2) — librería de íconos única del proyecto.
            display=block: mientras carga la fuente no se ve el nombre del ícono como texto ("arrow_forward").
            Pendiente (GAPS.md): subset con icon_names= o self-hosting para sacarlo del camino crítico.
            eslint-disable-next-line: no-page-custom-font es una regla de Pages Router (Next 12) que no
            reconoce el App Router — este <head> es el del root layout, así que SÍ aplica a toda la app. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
      </head>
      <body className="antialiased">
        {children}
        {isDemoLoginEnabled() && (
          // Suspense evita que la lectura de cookies() del switcher (solo
          // dev) fuerce rendering dinámico en toda página pública que use
          // este layout — el resto del árbol se sigue sirviendo estático.
          <Suspense fallback={null}>
            <DemoSwitcherGate />
          </Suspense>
        )}
      </body>
    </html>
  );
}
