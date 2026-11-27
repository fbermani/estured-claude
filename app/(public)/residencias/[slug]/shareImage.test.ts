import { existsSync } from "node:fs";
import { join } from "node:path";
// @ts-expect-error -- Next trae su picomatch (el que usa para `outputFileTracingIncludes`) sin tipos.
import picomatch from "next/dist/compiled/picomatch";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "@/next.config";
import { loadSharePreview } from "@/lib/residences/sharePreview";
import { OG_SIZE, shareImagePreviewPath } from "@/lib/share/ogCard";
import Image from "./opengraph-image";
import { GET } from "./vista-previa/route";

vi.mock("@/lib/residences/sharePreview", () => ({ loadSharePreview: vi.fn() }));

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

/** WhatsApp no muestra la vista previa si la imagen pesa más de ~300 KB. */
async function expectShareJpeg(res: Response) {
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("image/jpeg");
  const bytes = Buffer.from(await res.arrayBuffer());
  expect(bytes.byteLength).toBeLessThan(300_000);
  const meta = await sharp(bytes).metadata();
  expect([meta.format, meta.width, meta.height]).toEqual(["jpeg", OG_SIZE.width, OG_SIZE.height]);
}

describe("imagen de vista previa de la ficha", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(loadSharePreview).mockReset();
  });

  it("sin residencia devuelve la tarjeta de marca (los archivos de la imagen se leen en el servidor)", async () => {
    vi.mocked(loadSharePreview).mockResolvedValue(null);
    await expectShareJpeg(await Image(params("no-existe")));
  });

  it("con portada PNG devuelve la tarjeta con foto", async () => {
    const cover = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#c0521d" } }).png().toBuffer();
    const fetchMock = vi.fn(async () => new Response(new Uint8Array(cover)));
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(loadSharePreview).mockResolvedValue({
      name: "Residencia Norte",
      zone: "Belgrano",
      coverUrl: "https://ejemplo.supabase.co/portada.png",
      fromPriceUsd: 190,
      fromPriceArs: 280_000,
    });
    await expectShareJpeg(await Image(params("residencia-norte-demo")));
    // El único pedido por red es la portada: tipografías, sello y marca salen del disco.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("la ruta estable del panel devuelve la misma imagen", async () => {
    vi.mocked(loadSharePreview).mockResolvedValue(null);
    await expectShareJpeg(await GET(new Request("http://localhost/"), params("no-existe")));
    expect(loadSharePreview).toHaveBeenCalledWith("no-existe");
  });

  it("la miniatura de «Compartir tu ficha» apunta a una ruta que existe", () => {
    expect(shareImagePreviewPath("casa a/b")).toBe("/residencias/casa%20a%2Fb/vista-previa");
    expect(existsSync(join(__dirname, "vista-previa", "route.ts"))).toBe(true);
  });

  it("las dos rutas llevan los archivos de `_og` en el bundle de Vercel", () => {
    const includes = Object.entries(nextConfig.outputFileTracingIncludes ?? {});
    for (const route of ["/residencias/[slug]/opengraph-image-razh9b", "/residencias/[slug]/vista-previa"]) {
      const files = includes.filter(([key]) => picomatch(key, { dot: true, contains: true })(route)).flatMap(([, globs]) => globs);
      expect(files, route).toContain("./app/**/_og/*.{ttf,png,svg}");
    }
  });
});
