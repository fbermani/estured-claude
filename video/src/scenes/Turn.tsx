import type React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Headline, HeroBg, Rise, useEnter, useExit, useLayout, VerifiedChip } from "../ui";

/** 2 — Giro: «EstuRed ya la visitó por vos.» La misma foto vuelve a color con el sello. */
export const Turn: React.FC = () => {
  const frame = useCurrentFrame();
  const { v, u } = useLayout();
  const exit = useExit();
  const photo = useEnter(0, 30);
  const w = v ? 820 * u : 760 * u;
  return (
    <HeroBg>
      <AbsoluteFill
        style={{
          opacity: exit,
          flexDirection: v ? "column-reverse" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: v ? 90 * u : 120 * u,
          padding: v ? `${170 * u}px ${90 * u}px` : `${100 * u}px ${150 * u}px`,
        }}
      >
        <div style={{ flex: v ? "0 0 auto" : "1 1 0" }}>
          <Headline
            text="EstuRed ya la visitó"
            accent="por vos."
            accentColor={C.heroAccent}
            color="#fff"
            size={v ? 118 * u : 112 * u}
            delay={22}
          />
        </div>
        <div style={{ flex: v ? "0 0 auto" : "1 1 0", display: "grid", placeItems: "center" }}>
          <div
            style={{
              position: "relative",
              width: w,
              height: w * 0.8,
              borderRadius: 36 * u,
              overflow: "hidden",
              boxShadow: "0 40px 100px -30px rgba(0,0,0,.55)",
              opacity: photo,
              scale: interpolate(photo, [0, 1], [0.94, 1]),
            }}
          >
            <Img
              src={staticFile("photos/sf-1.jpg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                scale: interpolate(frame, [0, 150], [1.12, 1.02]),
                filter: `saturate(${interpolate(frame, [0, 30], [0.35, 1.05], { extrapolateRight: "clamp" })}) blur(${interpolate(frame, [0, 24], [2.5, 0], { extrapolateRight: "clamp" })}px)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to top, rgba(12,58,44,.55), transparent 45%)",
              }}
            />
            <Stamp />
          </div>
        </div>
      </AbsoluteFill>
    </HeroBg>
  );
};

const Stamp: React.FC = () => {
  const { u } = useLayout();
  const p = useEnter(16, 26);
  return (
    <Rise
      delay={16}
      style={{
        position: "absolute",
        left: 30 * u,
        top: 30 * u,
        scale: interpolate(p, [0, 1], [0.9, 1]),
        transformOrigin: "left top",
      }}
    >
      <VerifiedChip u={u} scale={1.15} />
    </Rise>
  );
};
