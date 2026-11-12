import type React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { body, C } from "../theme";
import { BrandMark, Headline, HeroBg, Icon, Rise, useEnter, useLayout } from "../ui";

/** Cierre: logo + H1 de la home + CTA «Buscar residencias». Queda quieto al final. */
export const Close: React.FC = () => {
  const { v, u } = useLayout();
  const logo = useEnter(4, 30);
  const cta = useEnter(46, 26);
  return (
    <HeroBg>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: 56 * u,
          padding: v ? `${170 * u}px ${80 * u}px` : `${100 * u}px ${200 * u}px`,
        }}
      >
        <div style={{ opacity: logo, scale: `${interpolate(logo, [0, 1], [0.92, 1])}` }}>
          <BrandMark size={v ? 120 * u : 110 * u} dark />
        </div>
        <Headline
          text="Elegí tu residencia a distancia,"
          accent="sin adivinar."
          accentColor={C.heroAccent}
          color="#fff"
          size={v ? 104 * u : 100 * u}
          align="center"
          delay={18}
          maxWidth={v ? 920 * u : 1400 * u}
        />
        <div style={{ opacity: cta, translate: `0px ${(1 - cta) * 30 * u}px` }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 16 * u,
              background: C.orange,
              color: "#fff",
              fontFamily: body,
              fontWeight: 700,
              fontSize: v ? 46 * u : 42 * u,
              padding: `${28 * u}px ${56 * u}px`,
              borderRadius: 999,
              boxShadow: "0 24px 50px -18px rgba(192,82,29,.7)",
            }}
          >
            <Icon name="search" size={(v ? 50 : 46) * u} color="#fff" />
            Buscar residencias
          </span>
        </div>
        <Rise delay={60}>
          <p style={{ margin: 0, fontFamily: body, fontWeight: 500, fontSize: (v ? 32 : 28) * u, color: C.forestTint }}>
            Explorar es gratis. Solicitud sujeta a confirmación.
          </p>
        </Rise>
      </AbsoluteFill>
    </HeroBg>
  );
};
