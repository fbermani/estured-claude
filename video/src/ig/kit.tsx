import type React from "react";
import { useEffect, useState } from "react";
import {
  continueRender,
  delayRender,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { loadFont } from "@remotion/fonts";
import { Audio } from "@remotion/media";
import timing from "./timing.json";
import subtitlesData from "./subtitles.json";

/* ---------- Tipografias locales (public/fonts, woff2 de Google Fonts) ---------- */
export const DISPLAY = "Bricolage Grotesque";
export const BODY = "Hanken Grotesk";
loadFont({
  family: DISPLAY,
  url: staticFile("fonts/BricolageGrotesque-800.woff2"),
  weight: "800",
  format: "woff2",
});
loadFont({
  family: BODY,
  url: staticFile("fonts/HankenGrotesk.woff2"),
  weight: "400 700",
  format: "woff2",
});

/* ---------- Marca ---------- */
export const K = {
  forest: "#1f7d5c",
  forestInk: "#0c3a2c",
  cream: "#fbf6ec",
  ink: "#1d2722",
  plate: "rgba(251, 246, 236, 0.9)",
  radius: 28,
} as const;

/* ---------- Tiempo ---------- */
export const FPS = timing.fps;
export const sec = (s: number) => Math.round(s * FPS);
export const SCENES = timing.scenes.map((s) => ({
  n: s.n,
  from: sec(s.start),
  to: sec(s.end),
  dur: sec(s.end) - sec(s.start),
}));
export const TOTAL = timing.durationInFrames;

const ease = Easing.bezier(0.16, 1, 0.3, 1);
const overshoot = Easing.bezier(0.34, 1.4, 0.64, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Interpolacion con ease de salida suave. a y b en segundos relativos a la escena. */
export const tween = (frame: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(frame, [sec(a), sec(b)], [from, to], { ...clamp, easing: ease });
export const tweenPop = (frame: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(frame, [sec(a), sec(b)], [from, to], { ...clamp, easing: overshoot });
export const lin = (frame: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(frame, [sec(a), sec(b)], [from, to], clamp);

/** Entrada: fundido + 20 px en 0,3 s. Salida: fundido 0,2 s. */
export function textInOut(frame: number, inS: number, outS: number) {
  const o =
    lin(frame, inS, inS + 0.3) * (1 - lin(frame, outS, outS + 0.2));
  const y = tween(frame, inS, inS + 0.3, 20, 0);
  return { opacity: o, translateY: y };
}

/* ---------- Imagenes ---------- */
export const asset = (name: string) => staticFile(`ig/p1/${name}`);

export function Px({
  name,
  x,
  y,
  w,
  h,
  style,
}: {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  style?: React.CSSProperties;
}) {
  return (
    <Img
      src={asset(name)}
      style={{ position: "absolute", left: x, top: y, width: w, height: h, ...style }}
    />
  );
}

/* ---------- Titular (zona y 300 a 800) ---------- */
export function Headline({
  text,
  accent,
  from,
  to,
  top = 300,
  size = 76,
  plate = true,
  color = K.ink,
  accentColor = K.forest,
  balance = true,
  width = 870,
  letterSpacing = "-0.01em",
}: {
  text: string;
  accent?: string;
  from: number;
  to: number;
  top?: number;
  size?: number;
  plate?: boolean;
  color?: string;
  accentColor?: string;
  balance?: boolean;
  width?: number;
  letterSpacing?: string;
}) {
  const frame = useCurrentFrame();
  const { opacity, translateY } = textInOut(frame, from, to);
  if (opacity <= 0) return null;
  let content: React.ReactNode = text;
  if (accent && text.includes(accent)) {
    const i = text.indexOf(accent);
    content = (
      <>
        {text.slice(0, i)}
        <span style={{ color: accentColor }}>{accent}</span>
        {text.slice(i + accent.length)}
      </>
    );
  }
  return (
    <div
      style={{
        position: "absolute",
        left: 960 - width,
        top,
        width,
        display: "flex",
        justifyContent: "center",
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        style={{
          maxWidth: width,
          padding: plate ? "22px 28px" : 0,
          background: plate ? K.plate : "transparent",
          borderRadius: K.radius,
          fontFamily: DISPLAY,
          fontWeight: 800,
          fontSize: size,
          lineHeight: 1.06,
          letterSpacing,
          textAlign: "center",
          textWrap: balance ? "balance" : "wrap",
          color,
        }}
      >
        {content}
      </div>
    </div>
  );
}

/* ---------- Subtitulos (zona y 1250 a 1500), leen subtitles.json ---------- */
type Word = { w: string; start: number; end: number };
type Cue = { scene: number; text: string; words: Word[] };
const cues: Cue[] = (subtitlesData as { cues: Cue[] }).cues;

export function Subtitles() {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  let active: { cue: Cue; inAt: number; outAt: number } | null = null;
  cues.forEach((cue, i) => {
    const inAt = cue.words[0].start;
    const last = cue.words[cue.words.length - 1].end;
    const next = cues[i + 1];
    const nextAdj = next && next.words[0].start - last < 0.6;
    const outAt = nextAdj ? next.words[0].start - 0.2 : last + 0.3;
    if (t >= inAt && t < outAt + 0.2) active = { cue, inAt, outAt };
  });
  if (!active) return null;
  const { cue, inAt, outAt } = active as { cue: Cue; inAt: number; outAt: number };
  const op =
    interpolate(t, [inAt, inAt + 0.3], [0, 1], clamp) *
    interpolate(t, [outAt, outAt + 0.2], [1, 0], clamp);
  const y = interpolate(t, [inAt, inAt + 0.3], [20, 0], { ...clamp, easing: ease });
  const current = [...cue.words].reverse().find((w) => t >= w.start) ?? cue.words[0];
  return (
    <div
      style={{
        position: "absolute",
        left: 90,
        top: 1260,
        width: 870,
        display: "flex",
        justifyContent: "center",
        opacity: op,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          maxWidth: 870,
          padding: "20px 32px",
          background: K.plate,
          borderRadius: K.radius,
          fontFamily: BODY,
          fontWeight: 700,
          fontSize: 42,
          lineHeight: 1.25,
          textAlign: "center",
          textWrap: "balance",
          color: K.ink,
        }}
      >
        {cue.words.map((w, i) => (
          <span key={i} style={{ color: w === current ? K.forest : K.ink }}>
            {w.w}
            {i < cue.words.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Audio ---------- */
function useFileExists(src: string) {
  const [state, setState] = useState<boolean | null>(null);
  useEffect(() => {
    const h = delayRender(`existe ${src}`);
    fetch(src, { method: "HEAD" })
      .then((r) => {
        const type = r.headers.get("content-type") ?? "";
        setState(r.ok && (type.startsWith("audio") || type.includes("octet-stream")));
      })
      .catch(() => setState(false))
      .finally(() => continueRender(h));
  }, [src]);
  return state === true;
}

/** Voz de una escena: solo suena si public/ig/voice/voice-NN.mp3 existe. */
export function Voice({ n }: { n: number }) {
  const src = staticFile(`ig/voice/voice-${String(n).padStart(2, "0")}.mp3`);
  const exists = useFileExists(src);
  if (!exists) return null;
  return <Audio src={src} volume={timing.volume.voice} />;
}

export function Sfx({ file }: { file: string }) {
  return <Audio src={staticFile(`ig/sfx/${file}.wav`)} volume={timing.volume.sfx} />;
}

export function Music() {
  return <Audio src={staticFile("ig/p1-music.wav")} volume={timing.volume.music} />;
}

export const sfxList = timing.sfx;
export const voiceDelay = timing.voiceDelay;
export const EV = timing.ev;

/** Sequence de SFX en tiempo absoluto. */
export function SfxTrack() {
  return (
    <>
      {sfxList.map((s, i) => (
        <Sequence key={i} from={sec(s.t)} durationInFrames={FPS}>
          <Sfx file={s.file} />
        </Sequence>
      ))}
    </>
  );
}
