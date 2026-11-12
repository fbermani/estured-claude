import type React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { body, C, display, ICON_FAMILY } from "./theme";

/** Layout: v = vertical (9:16). u = unidad de escala (1 = 1080 px de ancho útil). */
export const useLayout = () => {
  const { width, height } = useVideoConfig();
  const v = height > width;
  return { v, u: v ? width / 1080 : height / 1080, width, height };
};

/** Spring suave y sin rebote (damping alto). */
export const useEnter = (delay = 0, durationInFrames = 24) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame: frame - delay,
    fps,
    durationInFrames,
    config: { damping: 200 },
  });
};

/** Fade de salida al final de la escena. */
export const useExit = (frames = 10) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return interpolate(frame, [durationInFrames - frames, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

/** Sube y aparece con un spring suave. */
export const Rise: React.FC<{
  delay?: number;
  distance?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ delay = 0, distance = 28, style, children }) => {
  const p = useEnter(delay);
  return (
    <div
      style={{
        opacity: p,
        translate: `0px ${(1 - p) * distance}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Icon: React.FC<{
  name: string;
  size: number;
  color?: string;
  fill?: boolean;
  style?: React.CSSProperties;
}> = ({ name, size, color, fill, style }) => (
  <span
    style={{
      fontFamily: ICON_FAMILY,
      fontSize: size,
      lineHeight: 1,
      color,
      fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 500, 'opsz' 24`,
      display: "inline-block",
      ...style,
    }}
  >
    {name}
  </span>
);

/** Título por palabras: cada palabra sube con 3 frames de diferencia. */
export const Headline: React.FC<{
  text: string;
  accent?: string; // sufijo resaltado
  accentColor?: string;
  size: number;
  color?: string;
  delay?: number;
  align?: "left" | "center";
  maxWidth?: number;
}> = ({ text, accent, accentColor = C.orange, size, color = C.ink, delay = 0, align = "left", maxWidth }) => {
  const words = text.split(" ");
  const accentWords = accent ? accent.split(" ") : [];
  const all = [...words.map((w) => ({ w, a: false })), ...accentWords.map((w) => ({ w, a: true }))];
  return (
    <h1
      style={{
        fontFamily: display,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1.06,
        letterSpacing: "-0.025em",
        color,
        margin: 0,
        textAlign: align,
        maxWidth,
        textWrap: "balance",
      }}
    >
      {all.map((x, i) => (
        <Word key={i} delay={delay + i * 3} color={x.a ? accentColor : undefined}>
          {x.w}
        </Word>
      ))}
    </h1>
  );
};

const Word: React.FC<{ delay: number; color?: string; children: React.ReactNode }> = ({
  delay,
  color,
  children,
}) => {
  const p = useEnter(delay, 22);
  return (
    <span
      style={{
        display: "inline-block",
        opacity: p,
        translate: `0px ${(1 - p) * 0.35}em`,
        color,
        marginRight: "0.24em",
      }}
    >
      {children}
    </span>
  );
};

export const Sub: React.FC<{ size: number; color?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({
  size,
  color = C.inkSoft,
  children,
  style,
}) => (
  <p
    style={{
      fontFamily: body,
      fontWeight: 500,
      fontSize: size,
      lineHeight: 1.3,
      color,
      margin: 0,
      textWrap: "balance",
      ...style,
    }}
  >
    {children}
  </p>
);

/** Captura real de la app dentro de una tarjeta con borde y sombra. */
export const Shot: React.FC<{
  src: string;
  width: number;
  height?: number;
  radius?: number;
  objectPosition?: string;
  style?: React.CSSProperties;
  imgStyle?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ src, width, height, radius = 28, objectPosition = "top center", style, imgStyle, children }) => (
  <div
    style={{
      position: "relative",
      width,
      height,
      borderRadius: radius,
      overflow: "hidden",
      background: C.paper,
      border: `2px solid ${C.line}`,
      boxShadow: "0 30px 80px -30px rgba(12,58,44,.35), 0 8px 24px -12px rgba(12,58,44,.18)",
      ...style,
    }}
  >
    <Img
      src={staticFile(src)}
      style={{
        width: "100%",
        height: height ? "100%" : "auto",
        objectFit: "cover",
        objectPosition,
        display: "block",
        ...imgStyle,
      }}
    />
    {children}
  </div>
);

/** Chip «Residencia Verificada» (mismo look que TrustBadge). */
export const VerifiedChip: React.FC<{ u: number; scale?: number }> = ({ u, scale = 1 }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10 * u * scale,
      padding: `${12 * u * scale}px ${22 * u * scale}px ${12 * u * scale}px ${16 * u * scale}px`,
      borderRadius: 999,
      background: C.forestTint,
      color: C.forestHover,
      fontFamily: body,
      fontWeight: 700,
      fontSize: 30 * u * scale,
      boxShadow: "0 10px 30px -12px rgba(12,58,44,.45)",
      whiteSpace: "nowrap",
    }}
  >
    <Icon name="verified" size={38 * u * scale} color={C.forest} fill />
    Residencia Verificada
  </span>
);

/** Kicker numerado de cada beneficio. */
export const Kicker: React.FC<{ u: number; n: string; label: string; dark?: boolean }> = ({ u, n, label, dark }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 14 * u,
      fontFamily: body,
      fontWeight: 700,
      fontSize: 26 * u,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: dark ? C.orangeLight : C.orange,
    }}
  >
    <span
      style={{
        fontFamily: display,
        fontWeight: 800,
        fontSize: 26 * u,
        letterSpacing: 0,
        width: 52 * u,
        height: 52 * u,
        borderRadius: 999,
        display: "grid",
        placeItems: "center",
        background: dark ? "rgba(255,255,255,.1)" : C.orangeTint,
      }}
    >
      {n}
    </span>
    {label}
  </div>
);

/** Fondo crema con un brillo suave. */
export const CreamBg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(circle at 85% 10%, ${C.orangeTint} 0%, transparent 38%), radial-gradient(circle at 10% 95%, ${C.forestTint} 0%, transparent 40%), ${C.cream}`,
    }}
  >
    {children}
  </AbsoluteFill>
);

/** Fondo del hero: forest-ink → forest, glow orange y trama de puntos. */
export const HeroBg: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { u } = useLayout();
  return (
    <AbsoluteFill style={{ background: `linear-gradient(135deg, ${C.forestInk} 0%, #14553f 55%, ${C.forest} 100%)` }}>
      <div
        style={{
          position: "absolute",
          right: -260 * u,
          top: -340 * u,
          width: 1100 * u,
          height: 1100 * u,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(239,133,81,.5), transparent 65%)",
          translate: `${Math.sin(frame / 60) * 24 * u}px ${Math.cos(frame / 70) * 18 * u}px`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,.09) 1.4px, transparent 1.8px)",
          backgroundSize: `${30 * u}px ${30 * u}px`,
          maskImage: "linear-gradient(#000, transparent 80%)",
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

/** Logo de EstuRed (copia del BrandSymbol de la app: casa + R + cama). */
export const BrandMark: React.FC<{ size: number; dark?: boolean }> = ({ size, dark }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.28 }}>
    <svg width={size} height={size} viewBox="0 0 64 64">
      <rect width="64" height="64" rx="15" fill={C.cream} />
      <g fill="none" stroke={C.ink} strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M27 50H14V25L32 11L50 25V37" />
        <path d="M28 25H37A7.5 7.5 0 0 1 37 40H33M36 40L48 52" />
      </g>
      <rect x="17" y="35" width="6" height="4.5" rx="2.2" fill="#c4ad8d" />
      <rect x="17" y="40" width="12" height="6" rx="1.6" fill="#c4ad8d" />
    </svg>
    <span
      style={{
        fontFamily: display,
        fontWeight: 800,
        letterSpacing: "-0.02em",
        fontSize: size * 0.68,
        color: dark ? "#fff" : C.ink,
      }}
    >
      Estu<span style={{ color: dark ? "rgba(255,255,255,.6)" : "#7b867f" }}>Red</span>
    </span>
  </span>
);
