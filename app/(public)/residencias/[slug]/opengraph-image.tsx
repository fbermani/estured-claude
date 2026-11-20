import { ImageResponse } from "next/og";
import sharp from "sharp";
import { loadSharePreview } from "@/lib/residences/sharePreview";
import { OG_SIZE } from "@/lib/share/ogCard";
import { ShareCard } from "./_og/ShareCard";

/**
 * Imagen de vista previa del link de la ficha (Open Graph, 1200×630): lo que se ve al pegar `estured…/r/<slug>` en WhatsApp.
 * Next la publica sola como `og:image` de `/residencias/[slug]` (por eso `generateMetadata` ya no declara `images`). Si la residencia no existe devuelve la tarjeta de marca.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = OG_SIZE;
// JPEG liviano (50–90 KB): WhatsApp no muestra la vista previa si la imagen pesa más de ~300 KB, y el PNG de satori con foto pasa los 400 KB.
export const contentType = "image/jpeg";
export const alt = "Ficha de residencia verificada en EstuRed";

const asset = (url: URL) => fetch(url).then((r) => r.arrayBuffer());
const dataUri = (mime: string, bytes: ArrayBuffer | Buffer) => `data:${mime};base64,${Buffer.from(bytes as ArrayBuffer).toString("base64")}`;

/** La portada se baja, se recorta a 1200×630 y se pasa a JPEG liviano (satori no lee WebP/AVIF). Si falla, la tarjeta sale sin foto. */
async function coverAsJpeg(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const jpeg = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(OG_SIZE.width, OG_SIZE.height, { fit: "cover" })
      .jpeg({ quality: 72 })
      .toBuffer();
    return dataUri("image/jpeg", jpeg);
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [preview, bricolage, hanken, sealPng, markSvg] = await Promise.all([
    loadSharePreview(slug),
    asset(new URL("./_og/Bricolage-800.ttf", import.meta.url)),
    asset(new URL("./_og/Hanken-600.ttf", import.meta.url)),
    asset(new URL("./_og/sello-verificada.png", import.meta.url)),
    asset(new URL("./_og/estured-mark-crema.svg", import.meta.url)),
  ]);
  const photo = preview?.coverUrl ? await coverAsJpeg(preview.coverUrl) : null;

  const png = new ImageResponse(
    (
      <ShareCard
        name={preview?.name ?? "Residencias estudiantiles verificadas"}
        zone={preview?.zone ?? null}
        priceUsd={preview?.fromPriceUsd ?? null}
        priceArs={preview?.fromPriceArs ?? null}
        photo={photo}
        seal={dataUri("image/png", sealPng)}
        mark={dataUri("image/svg+xml", markSvg)}
      />
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Bricolage", data: bricolage, weight: 800, style: "normal" },
        { name: "Hanken", data: hanken, weight: 600, style: "normal" },
      ],
    },
  );
  const jpeg = await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
  });
}
