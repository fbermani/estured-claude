import type { CSSProperties } from "react";
import { OG_SIZE, arsReferenceLabel, plateNameLayout, priceLabel } from "@/lib/share/ogCard";

/**
 * Imagen de vista previa del link de la ficha (1200×630), para `ImageResponse` (satori): solo flexbox y estilos en línea, sin clases de
 * Tailwind. «La placa»: el nombre en una placa forest-ink con doble filete, el precio «desde» como pastilla naranja con su referencia en
 * pesos, y el sello «Verificada». Colores = tokens de `app/globals.css` (satori no lee variables CSS).
 */
const FOREST_INK = "#0c3a2c";
const PAPER = "#fffdf8";
const ORANGE = "#c0521d";

export type ShareCardProps = {
  name: string;
  zone: string | null;
  priceUsd: number | null;
  priceArs: number | null;
  /** Portada ya reducida (data URI JPEG). Sin foto, fondo de marca. */
  photo: string | null;
  seal: string;
  /** Marca crema como data URI SVG. */
  mark: string;
};

export function ShareCard({ name, zone, priceUsd, priceArs, photo, seal, mark }: ShareCardProps) {
  const { fontSize, lines } = plateNameLayout(name);
  const fill: CSSProperties = { position: "absolute", top: 0, left: 0, width: OG_SIZE.width, height: OG_SIZE.height };
  return (
    <div style={{ ...fill, display: "flex", position: "relative", backgroundColor: FOREST_INK, fontFamily: "Hanken" }}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- satori (ImageResponse) no usa next/image
        <img src={photo} alt="" width={OG_SIZE.width} height={OG_SIZE.height} style={{ ...fill, objectFit: "cover" }} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mark} alt="" width={560} height={573} style={{ position: "absolute", top: 40, right: -70, opacity: 0.07 }} />
      )}
      <div style={{ ...fill, display: "flex", backgroundColor: photo ? "rgba(12, 58, 44, 0.5)" : "rgba(12, 58, 44, 0)" }} />

      {/* Marca */}
      <div style={{ position: "absolute", top: 48, left: 60, display: "flex", alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mark} alt="" width={50} height={51} />
        <div style={{ display: "flex", marginLeft: 14, fontFamily: "Bricolage", fontSize: 40, color: PAPER, letterSpacing: -1 }}>EstuRed</div>
      </div>

      {/* Precio «desde» + referencia en pesos */}
      {priceUsd != null && (
        <div style={{ position: "absolute", top: 40, right: 60, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div
            style={{
              display: "flex",
              padding: "12px 30px",
              borderRadius: 999,
              backgroundColor: ORANGE,
              color: PAPER,
              fontFamily: "Bricolage",
              fontSize: 40,
            }}
          >
            {priceLabel(priceUsd)}
          </div>
          {priceArs != null && (
            <div
              style={{
                display: "flex",
                marginTop: 10,
                padding: "5px 16px",
                borderRadius: 999,
                backgroundColor: "rgba(12, 58, 44, 0.88)",
                color: PAPER,
                fontSize: 22,
              }}
            >
              {arsReferenceLabel(priceArs)}
            </div>
          )}
        </div>
      )}

      {/* La placa */}
      <div
        style={{
          position: "absolute",
          left: 60,
          bottom: 56,
          width: 820,
          display: "flex",
          padding: 6,
          borderRadius: 20,
          border: "2px solid rgba(255, 253, 248, 0.45)",
          backgroundColor: "rgba(12, 58, 44, 0.94)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            padding: "26px 34px 28px",
            borderRadius: 13,
            border: "1.5px solid rgba(255, 253, 248, 0.2)",
          }}
        >
          {zone && <div style={{ display: "flex", fontSize: 26, color: "rgba(255, 253, 248, 0.88)" }}>{`${zone}, CABA`}</div>}
          <div
            style={{
              display: "flex",
              marginTop: 6,
              fontFamily: "Bricolage",
              fontSize,
              lineHeight: 1.02,
              letterSpacing: -2,
              color: PAPER,
              maxHeight: lines === 2 ? fontSize * 2.1 : fontSize * 1.1,
              overflow: "hidden",
            }}
          >
            {name}
          </div>
          <div style={{ display: "flex", marginTop: 12, fontSize: 26, color: "rgba(255, 253, 248, 0.88)" }}>
            Verificada por EstuRed, la visitamos en persona
          </div>
        </div>
      </div>

      {/* Sello */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={seal} alt="" width={240} height={240} style={{ position: "absolute", right: 56, bottom: 36 }} />
    </div>
  );
}
