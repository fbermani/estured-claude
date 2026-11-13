import type React from "react";
import { AbsoluteFill, Img, Sequence, useCurrentFrame } from "remotion";
import { asset, K, lin, Music, SCENES, sec, SfxTrack, Subtitles, TOTAL, Voice, voiceDelay, EV } from "./kit";
import { Scene1, Scene2, Scene3, Scene4, Scene5, Scene6, Scene7 } from "./Scenes";

const OVERLAP = 9; // la escena que sale queda 0,3 s debajo del deslizamiento de la siguiente

/** Ultimo cuadro: vuelve a la composicion de la escena 1 (sin zoom ni texto). */
function LoopFrame() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: lin(f, 0, 0.2) }}>
      <Img
        src={asset("p1-e1-escena-compuesta.png")}
        style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920 }}
      />
    </AbsoluteFill>
  );
}

export const POST1_DURATION = TOTAL;

export const Post1: React.FC = () => {
  const scenes: Record<number, (d: number) => React.ReactNode> = {
    1: (d) => <Scene1 dur={d} />,
    2: (d) => <Scene2 dur={d} />,
    3: (d) => <Scene3 dur={d} />,
    4: (d) => <Scene4 dur={d} />,
    5: (d) => <Scene5 dur={d} />,
    6: (d) => <Scene6 dur={d} />,
    7: () => <Scene7 />,
  };
  const loopFrom = SCENES[6].from + sec(EV.s7.cierre);
  return (
    <AbsoluteFill style={{ background: K.forestInk }}>
      {SCENES.map((s) => (
        <Sequence
          key={s.n}
          name={`Escena ${s.n}`}
          from={s.from}
          durationInFrames={s.dur + (s.n < 7 ? OVERLAP : 0)}
        >
          {scenes[s.n](s.dur)}
        </Sequence>
      ))}
      <Subtitles />
      <Music />
      <SfxTrack />
      {SCENES.map((s) => (
        <Sequence key={`v${s.n}`} name={`Voz ${s.n}`} from={s.from + sec(voiceDelay)} durationInFrames={s.dur}>
          <Voice n={s.n} />
        </Sequence>
      ))}
      <Sequence name="Cierre en loop" from={loopFrom} durationInFrames={TOTAL - loopFrom}>
        <LoopFrame />
      </Sequence>
    </AbsoluteFill>
  );
};
