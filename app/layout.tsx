import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
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
    <html lang="es">
      <body className={`${inter.variable} ${manrope.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
