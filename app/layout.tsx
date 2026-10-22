import type { Metadata } from "next";
import { Suspense } from "react";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import { DemoSwitcherGate } from "@/components/dev/DemoSwitcherGate";
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
    "EstuRed te ayuda a elegir con confianza dónde empieza tu nueva etapa: residencias estudiantiles verificadas en CABA, con solicitudes claras y comprobantes respaldados.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning className={`${hanken.variable} ${bricolage.variable}`}>
      <head>
        {/* H15: si hay cookie de sesión de Supabase, marca <html> antes del primer pintado para que la
            navbar pública no muestre "Ingresar / Crear cuenta" a quien ya está logueado. La navbar
            lo quita cuando /api/session confirma la sesión. Las páginas siguen siendo estáticas. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(/(?:^|;\\s*)sb-[^=;]*auth-token/.test(document.cookie)){document.documentElement.setAttribute("data-session-hint","1")}}catch(e){}`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Material Symbols Outlined (design-references/fresh-style.md §1.2) — librería de íconos única del proyecto.
            eslint-disable-next-line: no-page-custom-font es una regla de Pages Router (Next 12) que no
            reconoce el App Router — este <head> es el del root layout, así que SÍ aplica a toda la app. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="antialiased">
        {children}
        {process.env.DEMO_LOGIN_ENABLED === "true" && (
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
