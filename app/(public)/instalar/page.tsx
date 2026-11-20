import QRCode from "qrcode";
import { InstallGuide } from "@/components/install/InstallGuide";
import { pageMetadata } from "@/lib/seo/pageMeta";
import { SITE_URL } from "@/lib/siteUrl";

export const metadata = pageMetadata({
  title: "Instalá la app de EstuRed",
  description:
    "Instalá EstuRed en tu celular, en Android o iPhone: ícono en la pantalla principal y avisos cuando una residencia responde tu solicitud. Paso a paso.",
  path: "/instalar",
});

export default async function InstalarPage() {
  // QR generado en el servidor (SVG) hacia esta misma página: desde la computadora se escanea y se instala desde el celular.
  const qrSvg = await QRCode.toString(`${SITE_URL}/instalar`, { type: "svg", margin: 1, color: { dark: "#0c3a2c", light: "#0000" } });
  return <InstallGuide qrSvg={qrSvg} />;
}
