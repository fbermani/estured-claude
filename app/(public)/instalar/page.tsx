import { InstallGuide } from "@/components/install/InstallGuide";
import { pageMetadata } from "@/lib/seo/pageMeta";

export const metadata = pageMetadata({
  title: "Instalá la app de EstuRed",
  description:
    "Instalá EstuRed en tu celular, en Android o iPhone: ícono en la pantalla principal y avisos cuando una residencia responde tu solicitud. Paso a paso.",
  path: "/instalar",
});

export default function InstalarPage() {
  return <InstallGuide />;
}
