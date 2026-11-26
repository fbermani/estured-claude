import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { DEFAULT_OG_IMAGE } from "@/lib/seo/ogImage";
import { OG_SIZE } from "@/lib/share/ogCard";

/**
 * Imagen de marca de la vista previa del link (Open Graph, 1200×630): lo que se ve al pegar el link de EstuRed en WhatsApp.
 * Apaisada y de 600 px o más para que salga en grande. Se genera al compilar; la ficha de residencia tiene la suya.
 * Colores = tokens de `app/globals.css` (satori no lee variables CSS). El logo y la bajada entran en el cuadrado central,
 * por si la app recorta la miniatura.
 */
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = DEFAULT_OG_IMAGE.alt;

const CREAM = "#fbf6ec";
const INK = "#1d2722";
const INK_FAINT = "#5f6c65";
const FOREST = "#1f7d5c";
const PAPER = "#fffdf8";

const asset = (path: string) => readFile(join(process.cwd(), path));

export default async function Image() {
  const [bricolage, hanken, markSvg] = await Promise.all([
    asset("app/(public)/residencias/[slug]/_og/Bricolage-800.ttf"),
    asset("app/(public)/residencias/[slug]/_og/Hanken-600.ttf"),
    asset("public/brand/estured-mark.svg"),
  ]);
  const mark = `data:image/svg+xml;base64,${markSvg.toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundColor: CREAM }}>
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, alignItems: "center", justifyContent: "center" }}>
          <img src={mark} alt="" width={274} height={280} />
          <div style={{ display: "flex", marginTop: 8, fontFamily: "Bricolage", fontSize: 128, letterSpacing: -4, lineHeight: 1.1, color: INK }}>
            Estu<span style={{ color: INK_FAINT }}>Red</span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            height: 130,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: FOREST,
            color: PAPER,
            fontFamily: "Hanken",
            fontSize: 32,
          }}
        >
          Residencias estudiantiles en Buenos Aires
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Bricolage", data: bricolage, weight: 800, style: "normal" },
        { name: "Hanken", data: hanken, weight: 600, style: "normal" },
      ],
    },
  );
}
