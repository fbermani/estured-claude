import { describe, expect, it } from "vitest";
import { extensionForMime, resolveDocumentType, resolveEvidenceType, sniffFileType } from "./sniffFile";

const ascii = (s: string) => Array.from(s).map((c) => c.charCodeAt(0));
const bytes = (...n: number[]) => new Uint8Array(n);
const blob = (...n: number[]) => new Blob([bytes(...n)]);

describe("sniffFileType", () => {
  it("reconoce PDF e imágenes por firma", () => {
    expect(sniffFileType(bytes(...ascii("%PDF-1.7")))).toBe("application/pdf");
    expect(sniffFileType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
  });
  it("reconoce video y audio", () => {
    expect(sniffFileType(bytes(0, 0, 0, 0x20, ...ascii("ftypisom")))).toBe("video/mp4");
    expect(sniffFileType(bytes(0, 0, 0, 0x14, ...ascii("ftypqt  ")))).toBe("video/quicktime");
    expect(sniffFileType(bytes(...ascii("OggS"), 0, 2))).toBe("audio/ogg");
    expect(sniffFileType(bytes(...ascii("ID3"), 4, 0))).toBe("audio/mpeg");
    expect(sniffFileType(bytes(0xff, 0xfb, 0x90, 0))).toBe("audio/mpeg");
  });
  it("rechaza HTML, SVG y ejecutables", () => {
    expect(sniffFileType(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffFileType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(sniffFileType(bytes(0x4d, 0x5a, 0x90, 0))).toBeNull();
    expect(sniffFileType(bytes())).toBeNull();
  });
});

describe("resolveDocumentType", () => {
  it("acepta PDF e imágenes, pero no video ni audio", async () => {
    expect(await resolveDocumentType(blob(...ascii("%PDF-1.4")))).toBe("application/pdf");
    expect(await resolveDocumentType(blob(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(await resolveDocumentType(blob(0, 0, 0, 0x20, ...ascii("ftypisom")))).toBeNull();
    expect(await resolveDocumentType(new Blob(["<html></html>"]))).toBeNull();
  });
});

describe("resolveEvidenceType", () => {
  it("acepta video/audio y conserva audio/mp4 declarado", async () => {
    expect(await resolveEvidenceType(blob(0, 0, 0, 0x20, ...ascii("ftypisom")), "video/mp4")).toBe("video/mp4");
    expect(await resolveEvidenceType(blob(0, 0, 0, 0x20, ...ascii("ftypM4A ")), "audio/mp4")).toBe("audio/mp4");
    expect(await resolveEvidenceType(new Blob(["<html></html>"]), "application/pdf")).toBeNull();
  });
});

describe("extensionForMime", () => {
  it("deriva la extensión del tipo real", () => {
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("application/pdf")).toBe("pdf");
    expect(extensionForMime("video/quicktime")).toBe("mov");
  });
});
