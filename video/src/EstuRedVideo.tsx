import type React from "react";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { HookPeople, HookPhotos, HookTravel } from "./scenes/Hook";
import { Turn } from "./scenes/Turn";
import { B1Verified, B2Remote, B3Receipt, B4Community, B5Rules, B6Support, Family } from "./scenes/Benefits";
import { Close } from "./scenes/Close";

/**
 * Duraciones (frames a 30 fps). Cada transición es un fundido de T frames que se
 * superpone con la escena siguiente, por eso las escenas suman T de más.
 * Total = suma de escenas − 11 × T = 1800 (60 s).
 */
export const T = 12;
export const SCENES = {
  hookPhotos: 105 + T,
  hookPeople: 90 + T,
  hookTravel: 105 + T,
  turn: 150 + T,
  b1: 165 + T,
  b2: 165 + T,
  b3: 165 + T,
  b4: 165 + T,
  b5: 165 + T,
  b6: 165 + T,
  family: 150 + T,
  close: 210,
};
export const TOTAL = Object.values(SCENES).reduce((a, b) => a + b, 0) - 11 * T;


export const EstuRedVideo: React.FC = () => (
  <>
    {/* Música: placeholder. Cuando haya una pista libre de derechos, agregarla así:
        <Audio src={staticFile("music/pista.mp3")} volume={0.5} />  (import { Audio } from "@remotion/media") */}
    <TransitionSeries>
      <TransitionSeries.Sequence name="1a · ¿Es como en las fotos?" durationInFrames={SCENES.hookPhotos}>
        <HookPhotos />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="1b · ¿Quiénes viven ahí?" durationInFrames={SCENES.hookPeople}>
        <HookPeople />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="1c · ¿Hay que viajar?" durationInFrames={SCENES.hookTravel}>
        <HookTravel />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="2 · Giro" durationInFrames={SCENES.turn}>
        <Turn />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="B1 · Residencia Verificada" durationInFrames={SCENES.b1}>
        <B1Verified />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="B2 · A distancia" durationInFrames={SCENES.b2}>
        <B2Remote />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="B3 · Comprobante" durationInFrames={SCENES.b3}>
        <B3Receipt />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="B4 · Comunidad" durationInFrames={SCENES.b4}>
        <B4Community />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="B5 · Reglamento y costos" durationInFrames={SCENES.b5}>
        <B5Rules />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="B6 · Registro y Soporte" durationInFrames={SCENES.b6}>
        <B6Support />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="F · Familias" durationInFrames={SCENES.family}>
        <Family />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="C · Cierre" durationInFrames={SCENES.close}>
        <Close />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </>
);
