import type React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C, body, display } from "../theme";
import { Icon } from "../ui";
export { C, body, display, Icon };
export const bounds = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;
export const ease = (
  frame: number,
  start: number,
  end: number,
  from = 0,
  to = 1,
) =>
  interpolate(frame, [start, end], [from, to], {
    ...bounds,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
export const pop = (frame: number, delay = 0) =>
  spring({
    frame: frame - delay,
    fps: 30,
    config: { damping: 19, stiffness: 130, mass: 0.8 },
  });
export const useScene = () => {
  const f = useCurrentFrame();
  const { width: w, height: h, durationInFrames: d } = useVideoConfig();
  return { f, w, h, d, v: h > w, cx: w / 2, cy: h / 2 };
};
export const card: React.CSSProperties = {
  border: "1.5px solid #0c3a2c12",
  background: "#fff",
  borderRadius: 30,
  boxShadow: "0 24px 65px #0c3a2c16, 0 3px 10px #0c3a2c08",
};
export function Backdrop({
  dark = false,
  children,
}: {
  dark?: boolean;
  children?: React.ReactNode;
}) {
  const { f, w, h } = useScene();
  return (
    <AbsoluteFill
      style={{
        fontFamily: body,
        color: dark ? C.cream : C.ink,
        background: dark ? C.forestInk : "#f8fbf7",
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at ${65 + Math.sin(f / 90) * 14}% 35%, ${dark ? "#23795890" : "#b9dfce85"}, transparent 62%), radial-gradient(ellipse at 10% 85%, ${dark ? "#e9b84b18" : "#f9dfc875"}, transparent 55%)`,
        }}
      />
      <svg
        width={w}
        height={h}
        style={{ position: "absolute", opacity: dark ? 0.12 : 0.14 }}
      >
        <defs>
          <pattern
            id={dark ? "grid-d" : "grid-l"}
            width="64"
            height="64"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="1.3" fill={dark ? "white" : C.forest} />
          </pattern>
        </defs>
        <rect
          width={w}
          height={h}
          fill={`url(#${dark ? "grid-d" : "grid-l"})`}
        />
      </svg>
      {children}
    </AbsoluteFill>
  );
}
export function Face({
  variant = 0,
  size = 180,
}: {
  variant?: number;
  size?: number;
}) {
  const skin = ["#c98b62", "#efba91", "#95634c", "#dba77b"][variant % 4];
  const clothes = [C.orange, C.forest, "#678fbb", "#d6ae43"][variant % 4];
  return (
    <svg width={size} height={size} viewBox="0 0 180 180">
      <defs>
        <clipPath id={`face-${variant}-${size}`}>
          <circle cx="90" cy="90" r="90" />
        </clipPath>
      </defs>
      <g clipPath={`url(#face-${variant}-${size})`}>
        <rect
          width="180"
          height="180"
          fill={variant % 2 ? C.orangeTint : C.forestTint}
        />
        <ellipse cx="90" cy="191" rx="76" ry="67" fill={clothes} />
        <path d="M76 115v31q14 13 28 0v-31" fill={skin} />
        <ellipse cx="90" cy="83" rx="45" ry="53" fill={skin} />
        <path
          d={
            variant % 2
              ? "M43 97Q20 18 86 15q73 0 54 92l-12-45q-30 7-58-17L49 97Z"
              : "M45 84Q23 17 93 15q62 0 46 74l-14-36q-24 20-65 3Z"
          }
          fill="#26342e"
        />
        <circle cx="75" cy="85" r="3" fill="#26342e" />
        <circle cx="108" cy="85" r="3" fill="#26342e" />
        <path
          d="M80 108q13 10 25-2"
          fill="none"
          stroke="#6c4536"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="M90 87l-3 13h7" fill="none" stroke="#99654d" strokeWidth="2" />
        <path
          d="M75 147L90 158 105 147"
          fill="none"
          stroke="#ffffff60"
          strokeWidth="3"
        />
      </g>
    </svg>
  );
}
export function AppIcon({
  kind,
  size = 110,
}: {
  kind: "instagram" | "whatsapp" | "house" | "verify";
  size?: number;
}) {
  return (
    <div
      style={{
        ...card,
        width: size,
        height: size,
        borderRadius: size * 0.26,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      {kind === "instagram" ? (
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 64 64">
          <defs>
            <linearGradient id="insta" x1="0" y1="1" x2="1" y2="0">
              <stop stopColor="#edb653" />
              <stop offset=".5" stopColor="#d9446c" />
              <stop offset="1" stopColor="#9243a9" />
            </linearGradient>
          </defs>
          <rect
            x="5"
            y="5"
            width="54"
            height="54"
            rx="16"
            fill="none"
            stroke="url(#insta)"
            strokeWidth="6"
          />
          <circle
            cx="32"
            cy="32"
            r="12"
            fill="none"
            stroke="#d9446c"
            strokeWidth="5"
          />
          <circle cx="48" cy="16" r="4" fill="#a9439c" />
        </svg>
      ) : kind === "whatsapp" ? (
        <svg width={size * 0.67} height={size * 0.67} viewBox="0 0 64 64">
          <path d="M12 49L8 59l14-4A25 25 0 1 0 12 49" fill="#34ae69" />
          <path
            d="M24 18q-7 1-3 12 5 13 18 15 8 1 8-6l-8-5-4 4q-8-3-10-10l4-3Z"
            fill="white"
          />
        </svg>
      ) : (
        <Icon
          name={kind === "house" ? "home" : "verified"}
          size={size * 0.61}
          color={C.forest}
          fill
        />
      )}
    </div>
  );
}
export function Label({
  children,
  dark = false,
  style,
}: {
  children: React.ReactNode;
  dark?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        ...card,
        padding: "15px 25px",
        fontFamily: body,
        fontSize: 27,
        fontWeight: 700,
        color: dark ? "white" : C.ink,
        background: dark ? C.forestInk : "white",
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
export function Title({
  children,
  size = 100,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: display,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1.03,
        letterSpacing: "-.045em",
        textWrap: "balance",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
export function Cursor({
  label,
  color = C.orange,
  x,
  y,
  click = false,
}: {
  label: string;
  color?: string;
  x: number;
  y: number;
  click?: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        zIndex: 10,
        filter: "drop-shadow(0 4px 5px #0002)",
      }}
    >
      {click && (
        <div
          style={{
            position: "absolute",
            left: -22,
            top: -22,
            width: 70,
            height: 70,
            border: `4px solid ${color}`,
            borderRadius: "50%",
          }}
        />
      )}
      <svg width="43" height="48" viewBox="0 0 43 48">
        <path
          d="M4 3l34 27-16 2-8 14Z"
          fill={color}
          stroke="white"
          strokeWidth="3"
        />
      </svg>
      <span
        style={{
          background: color,
          color: "white",
          padding: "8px 16px",
          borderRadius: 14,
          fontSize: 23,
          fontWeight: 700,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}
export function HouseArt({
  color = C.forest,
  size = 160,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160">
      <path d="M17 72L80 18l63 54v75H17Z" fill={color} />
      <path
        d="M10 73L80 11l70 62"
        fill="none"
        stroke={C.forestInk}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <rect x="62" y="98" width="36" height="49" rx="6" fill={C.cream} />
      <rect x="32" y="78" width="22" height="24" rx="5" fill={C.cream} />
      <rect x="107" y="78" width="22" height="24" rx="5" fill={C.cream} />
    </svg>
  );
}
export function Bubble({
  text,
  style,
}: {
  text: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        ...card,
        borderRadius: "24px 24px 24px 5px",
        padding: "24px 30px",
        fontSize: 29,
        maxWidth: 400,
        lineHeight: 1.25,
        ...style,
      }}
    >
      {text}
    </div>
  );
}
export function Check({
  size = 120,
  color = C.forest,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="55" fill={color} />
      <path
        d="M31 60l20 21 39-43"
        fill="none"
        stroke="white"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
