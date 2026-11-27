import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { loadSharePreview } from "@/lib/residences/sharePreview";
import { OG_SIZE } from "@/lib/share/ogCard";
import { ShareCard } from "./ShareCard";

/**
 * Arma el JPEG 1200×630 de la vista previa del link de la ficha. Lo usan `opengraph-image.tsx` (el `og:image`) y `vista-previa/route.ts`
 * (la miniatura de «Compartir tu ficha»). Si la residencia no existe devuelve la tarjeta de marca.
 */

// En el runtime Node `fetch(new URL("./archivo", import.meta.url))` no sirve: el build lo vuelve una ruta relativa (`/_next/static/media/…`)
// y `fetch` la rechaza (500 en Vercel). Se leen del disco; `outputFileTracingIncludes` (next.config.ts) los mete en la función.
const asset = (file: string) => readFile(join(process.cwd(), "app/(public)/residencias/[slug]/_og", file));
const dataUri = (mime: string, bytes: Buffer) => `data:${mime};base64,${bytes.toString("base64")}`;

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

export async function renderShareImage(slug: string): Promise<Response> {
  const [preview, bricolage, hanken, sealPng, markSvg] = await Promise.all([
    loadSharePreview(slug),
    asset("Bricolage-800.ttf"),
    asset("Hanken-600.ttf"),
    asset("sello-verificada.png"),
    asset("estured-mark-crema.svg"),
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
