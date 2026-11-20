import type React from "react";
import { AbsoluteFill } from "remotion";
import { body, C } from "../theme";
import { CreamBg, Headline, Icon, Kicker, Rise, Sub, useExit, useLayout } from "../ui";

/**
 * Esqueleto común de los beneficios: texto a la izquierda (arriba en vertical)
 * y visual a la derecha (abajo en vertical). Mucho aire, una sola idea por cuadro.
 */
export const BenefitFrame: React.FC<{
  n: string;
  label: string;
  title: string;
  sub: string;
  note?: string;
  noteIcon?: string;
  visual: React.ReactNode;
}> = ({ n, label, title, sub, note, noteIcon = "info", visual }) => {
  const { v, u } = useLayout();
  const exit = useExit();
  return (
    <CreamBg>
      <AbsoluteFill
        style={{
          opacity: exit,
          flexDirection: v ? "column" : "row",
          alignItems: v ? "stretch" : "center",
          justifyContent: v ? "flex-start" : "center",
          gap: v ? 70 * u : 100 * u,
          padding: v ? `${160 * u}px ${90 * u}px ${130 * u}px` : `${100 * u}px ${130 * u}px ${100 * u}px ${150 * u}px`,
        }}
      >
        <div style={{ flex: v ? "0 0 auto" : "0 0 40%", display: "grid", gap: 34 * u, alignContent: "center" }}>
          <Rise delay={0}>
            <Kicker u={u} n={n} label={label} />
          </Rise>
          <Headline text={title} size={v ? 96 * u : 88 * u} delay={4} />
          <Rise delay={18}>
            <Sub size={v ? 50 * u : 44 * u}>{sub}</Sub>
          </Rise>
          {note && (
            <Rise delay={30}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12 * u,
                  fontFamily: body,
                  fontWeight: 600,
                  fontSize: v ? 34 * u : 30 * u,
                  color: C.forestHover,
                }}
              >
                <Icon name={noteIcon} size={38 * u} color={C.forest} />
                {note}
              </div>
            </Rise>
          )}
        </div>
        <div
          style={{
            flex: "1 1 0",
            position: "relative",
            display: "grid",
            placeItems: "center",
            minHeight: 0,
          }}
        >
          {visual}
        </div>
      </AbsoluteFill>
    </CreamBg>
  );
};
