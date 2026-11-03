import { describe, expect, it } from "vitest";
import { imageExtension, sniffImageType } from "./imageSniff";

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe("sniffImageType", () => {
  it("reconoce JPEG, PNG y WebP por su firma", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe("image/png");
    expect(sniffImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBP"), ...ascii("VP8 ")))).toBe("image/webp");
  });
  it("rechaza HTML, SVG, GIF y otros archivos aunque declaren image/png", () => {
    expect(sniffImageType(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImageType(bytes(...ascii("GIF89a"), 0, 0, 0, 0, 0, 0))).toBeNull();
    expect(sniffImageType(bytes(...ascii("MZ"), 0x90, 0, 3, 0))).toBeNull();
  });
  it("rechaza RIFF que no es WebP (por ejemplo WAV) y entradas cortas o vacías", () => {
    expect(sniffImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVE")))).toBeNull();
    expect(sniffImageType(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffImageType(bytes())).toBeNull();
  });
  it("imageExtension sale del tipo detectado", () => {
    expect(imageExtension("image/jpeg")).toBe("jpg");
    expect(imageExtension("image/png")).toBe("png");
    expect(imageExtension("image/webp")).toBe("webp");
  });
});
