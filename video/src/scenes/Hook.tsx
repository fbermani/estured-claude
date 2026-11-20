import type React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { body, C } from "../theme";
import { CreamBg, Headline, Icon, Rise, Sub, useEnter, useExit, useLayout } from "../ui";

/** Esqueleto de dos columnas (texto | visual) o apilado en vertical. */
const HookFrame: React.FC<{ text: React.ReactNode; visual: React.ReactNode }> = ({ text, visual }) => {
  const { v, u } = useLayout();
  const exit = useExit();
  return (
    <CreamBg>
      <AbsoluteFill
        style={{
          opacity: exit,
          flexDirection: v ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: v ? 90 * u : 110 * u,
          padding: v ? `${170 * u}px ${90 * u}px` : `${100 * u}px ${150 * u}px`,
        }}
      >
        <div style={{ flex: v ? "0 0 auto" : "1 1 0", display: "grid", gap: 30 * u }}>{text}</div>
        <div style={{ flex: v ? "0 0 auto" : "1 1 0", display: "grid", placeItems: "center" }}>{visual}</div>
      </AbsoluteFill>
    </CreamBg>
  );
};

/** 1a — ¿Es como en las fotos? */
export const HookPhotos: React.FC = () => {
  const frame = useCurrentFrame();
  const { v, u } = useLayout();
  const card = useEnter(4, 30);
  const w = v ? 760 * u : 640 * u;
  return (
    <HookFrame
      text={<Headline text="¿Es como en las fotos?" size={v ? 112 * u : 104 * u} />}
      visual={
        <div
          style={{
            width: w,
            background: C.paper,
            borderRadius: 30 * u,
            border: `2px solid ${C.line}`,
            boxShadow: "0 30px 80px -30px rgba(12,58,44,.35)",
            overflow: "hidden",
            opacity: card,
            translate: `0px ${(1 - card) * 60 * u}px`,
            rotate: `${interpolate(frame, [0, 105], [-2.5, -1])}deg`,
          }}
        >
          {/* Encabezado genérico de post: sin nombres ni marcas */}
          <div style={{ display: "flex", alignItems: "center", gap: 18 * u, padding: 22 * u }}>
            <div style={{ width: 56 * u, height: 56 * u, borderRadius: 999, background: C.cream2 }} />
            <div style={{ display: "grid", gap: 10 * u }}>
              <div style={{ width: 220 * u, height: 16 * u, borderRadius: 99, background: C.line }} />
              <div style={{ width: 140 * u, height: 12 * u, borderRadius: 99, background: C.cream2 }} />
            </div>
          </div>
          <div style={{ position: "relative", height: w * 0.78, overflow: "hidden" }}>
            <Img
              src={staticFile("photos/sf-1.jpg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                scale: interpolate(frame, [0, 105], [1.04, 1.12]),
                filter: `saturate(${interpolate(frame, [20, 90], [1, 0.35], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}) blur(${interpolate(frame, [20, 90], [0, 2.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
              }}
            />
            <Rise
              delay={34}
              style={{
                position: "absolute",
                left: 22 * u,
                bottom: 22 * u,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10 * u,
                  background: "rgba(29,39,34,.78)",
                  color: "#fff",
                  fontFamily: body,
                  fontWeight: 600,
                  fontSize: 26 * u,
                  padding: `${10 * u}px ${18 * u}px`,
                  borderRadius: 999,
                }}
              >
                <Icon name="photo_camera" size={30 * u} color="#fff" />
                Foto de una publicación
              </span>
            </Rise>
          </div>
          <div style={{ display: "flex", gap: 22 * u, padding: 22 * u }}>
            {["favorite", "chat_bubble", "send"].map((n) => (
              <Icon key={n} name={n} size={40 * u} color={C.inkSoft} />
            ))}
          </div>
        </div>
      }
    />
  );
};

/** 1b — ¿Quiénes viven ahí? */
export const HookPeople: React.FC = () => {
  const { v, u } = useLayout();
  const size = v ? 210 * u : 190 * u;
  return (
    <HookFrame
      text={<Headline text="¿Quiénes viven ahí?" size={v ? 112 * u : 104 * u} />}
      visual={
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, auto)", gap: 36 * u }}>
          {[0, 1, 2, 3].map((i) => (
            <Avatar key={i} i={i} size={size} />
          ))}
        </div>
      }
    />
  );
};

const Avatar: React.FC<{ i: number; size: number }> = ({ i, size }) => {
  const p = useEnter(6 + i * 5, 26);
  const { u } = useLayout();
  return (
    <div
      style={{
        width: size * 1.45,
        padding: 26 * u,
        borderRadius: 30 * u,
        background: C.paper,
        border: `2px solid ${C.line}`,
        display: "grid",
        justifyItems: "center",
        gap: 18 * u,
        opacity: p,
        translate: `0px ${(1 - p) * 40 * u}px`,
      }}
    >
      <div
        style={{
          width: size * 0.62,
          height: size * 0.62,
          borderRadius: 999,
          background: C.cream2,
          display: "grid",
          placeItems: "center",
        }}
      >
        <Icon name="question_mark" size={size * 0.34} color="#a9a08f" />
      </div>
      <div style={{ width: "70%", height: 14 * u, borderRadius: 99, background: C.line }} />
      <div style={{ width: "45%", height: 12 * u, borderRadius: 99, background: C.cream2 }} />
    </div>
  );
};

/** 1c — ¿Hay que viajar para verla? */
export const HookTravel: React.FC = () => {
  const frame = useCurrentFrame();
  const { v, u } = useLayout();
  const draw = interpolate(frame, [10, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const W = v ? 860 * u : 760 * u;
  const H = v ? 640 * u : 560 * u;
  const pathLen = 1000;
  const end = useEnter(62, 24);
  return (
    <HookFrame
      text={
        <>
          <Headline text="¿Hay que viajar para verla?" size={v ? 112 * u : 104 * u} />
          <Rise delay={40}>
            <Sub size={v ? 52 * u : 46 * u}>Tu familia, lejos.</Sub>
          </Rise>
        </>
      }
      visual={
        <div style={{ position: "relative", width: W, height: H }}>
          <svg viewBox="0 0 760 560" width={W} height={H} style={{ position: "absolute", inset: 0 }}>
            <path
              d="M110 460 C 220 300, 420 470, 520 250 S 600 140, 600 130"
              fill="none"
              stroke={C.forest}
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray="2 18"
              pathLength={pathLen}
              style={{ clipPath: `inset(0 ${(1 - draw) * 100}% 0 0)` }}
            />
            <circle cx={110} cy={460} r={18} fill={C.orange} />
            <circle cx={110} cy={460} r={34} fill={C.orange} opacity={0.18} />
            <circle cx={600} cy={130} r={18 * end} fill={C.forest} />
            <circle cx={600} cy={130} r={36 * end} fill={C.forest} opacity={0.16} />
          </svg>
          <Label x={(110 / 760) * W} y={(460 / 560) * H + 50 * u} text="Tu ciudad" icon="home" delay={4} />
          <Label x={(600 / 760) * W} y={(130 / 560) * H - 110 * u} text="Buenos Aires" icon="location_city" delay={60} />
          <div
            style={{
              position: "absolute",
              left: interpolate(draw, [0, 1], [(110 / 760) * W, (560 / 760) * W]),
              top: interpolate(draw, [0, 1], [(420 / 560) * H, (140 / 560) * H]),
              opacity: interpolate(draw, [0, 0.1, 0.9, 1], [0, 1, 1, 0]),
              rotate: "40deg",
            }}
          >
            <Icon name="flight" size={64 * u} color={C.forestInk} fill />
          </div>
        </div>
      }
    />
  );
};

const Label: React.FC<{ x: number; y: number; text: string; icon: string; delay: number }> = ({
  x,
  y,
  text,
  icon,
  delay,
}) => {
  const { u } = useLayout();
  const p = useEnter(delay);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        translate: `-50% ${(1 - p) * 20 * u}px`,
        opacity: p,
        display: "inline-flex",
        alignItems: "center",
        gap: 10 * u,
        background: C.paper,
        border: `2px solid ${C.line}`,
        borderRadius: 999,
        padding: `${12 * u}px ${22 * u}px`,
        fontFamily: body,
        fontWeight: 700,
        fontSize: 30 * u,
        color: C.ink,
        whiteSpace: "nowrap",
      }}
    >
      <Icon name={icon} size={34 * u} color={C.forest} />
      {text}
    </div>
  );
};
