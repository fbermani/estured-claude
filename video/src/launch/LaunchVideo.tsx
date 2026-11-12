import type React from "react";
import {
  AbsoluteFill,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio } from "@remotion/media";
import { body, C, ease } from "./design";
import {
  BookingScene,
  ChaosScene,
  CommunityScene,
  CompareScene,
  DistanceScene,
  FinaleScene,
  SupportScene,
  VerifyScene,
} from "./scenes";
import story from "./story.json";
export const LAUNCH_DURATION = story.durationInFrames;

function Caption({ index }: { index: number }) {
  const f = useCurrentFrame();
  const { fps, height, width } = useVideoConfig();
  const scene = story.scenes[index];
  const caption = scene.captions.find(
    (c) => f >= c.start * fps && f < c.end * fps,
  );
  if (!caption) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: height > width ? 160 : 38,
        left: width * 0.07,
        right: width * 0.07,
        textAlign: "center",
        zIndex: 30,
        fontFamily: body,
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          display: "inline-block",
          maxWidth: "100%",
          padding: "13px 26px",
          background: "#0a2d24ee",
          border: "1px solid #ffffff25",
          color: "white",
          borderRadius: 16,
          fontSize: height > width ? 36 : 30,
          fontWeight: 600,
          lineHeight: 1.35,
          boxShadow: "0 8px 30px #0002",
        }}
      >
        {caption.text}
      </span>
    </div>
  );
}
function Chapter({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  const f = useCurrentFrame();
  const { durationInFrames: d, width, height } = useVideoConfig();
  const colors = [
    "#f8fbf7",
    "#f8fbf7",
    C.forestInk,
    "#f8fbf7",
    "#f8fbf7",
    "#f8fbf7",
    C.forestInk,
    C.forestInk,
  ];
  const radius = Math.hypot(width, height);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ scale: ease(f, 0, 25, 1.025, 1) }}>
        {children}
      </AbsoluteFill>
      <Audio src={staticFile(story.scenes[index].audio)} from={10} volume={1} />
      <Caption index={index} />
      {index > 0 && f < 14 ? (
        <AbsoluteFill
          style={{
            background: colors[index],
            clipPath: `circle(${(1 - ease(f, 0, 14)) * radius}px at 50% 50%)`,
            zIndex: 40,
            pointerEvents: "none",
          }}
        />
      ) : null}
      {index < 7 && f > d - 14 ? (
        <AbsoluteFill
          style={{
            background: colors[index + 1],
            clipPath: `circle(${ease(f, d - 14, d) * radius}px at ${index % 2 ? "85% 15%" : "15% 85%"})`,
            zIndex: 40,
            pointerEvents: "none",
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
}
export function LaunchVideo() {
  const { fps } = useVideoConfig();
  return (
    <>
      <Audio src={staticFile("launch/launch-music.wav")} volume={0.3} />
      <Sequence
        name="El problema · mensajes dispersos"
        from={story.scenes[0].from}
        durationInFrames={story.scenes[0].frames}
      >
        <Chapter index={0}>
          <ChaosScene />
        </Chapter>
      </Sequence>
      <Sequence
        name="La distancia · viajar no siempre es posible"
        from={story.scenes[1].from}
        durationInFrames={story.scenes[1].frames}
      >
        <Chapter index={1}>
          <DistanceScene />
        </Chapter>
      </Sequence>
      <Sequence
        name="EstuRed · ya fuimos por vos"
        from={story.scenes[2].from}
        durationInFrames={story.scenes[2].frames}
      >
        <Chapter index={2}>
          <VerifyScene />
        </Chapter>
      </Sequence>
      <Sequence
        name="Buscar · comparar · elegir en familia"
        from={story.scenes[3].from}
        durationInFrames={story.scenes[3].frames}
      >
        <Chapter index={3}>
          <CompareScene />
        </Chapter>
      </Sequence>
      <Sequence
        name="Reserva registrada · comprobante"
        from={story.scenes[4].from}
        durationInFrames={story.scenes[4].frames}
      >
        <Chapter index={4}>
          <BookingScene />
        </Chapter>
      </Sequence>
      <Sequence
        name="La convivencia también se elige"
        from={story.scenes[5].from}
        durationInFrames={story.scenes[5].frames}
      >
        <Chapter index={5}>
          <CommunityScene />
        </Chapter>
      </Sequence>
      <Sequence
        name="Soporte · estamos"
        from={story.scenes[6].from}
        durationInFrames={story.scenes[6].frames}
      >
        <Chapter index={6}>
          <SupportScene />
        </Chapter>
      </Sequence>
      <Sequence
        name="Tu próxima etapa · sumate"
        from={story.scenes[7].from}
        durationInFrames={story.scenes[7].frames}
      >
        <Chapter index={7}>
          <FinaleScene />
        </Chapter>
      </Sequence>
      <Sequence
        from={Math.max(0, LAUNCH_DURATION - 2 * fps)}
        durationInFrames={2 * fps}
        name="Cierre musical"
      >
        <OutroFade />
      </Sequence>
    </>
  );
}
function OutroFade() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        background: C.forestInk,
        opacity: ease(f, 1.6 * fps, 2 * fps),
        pointerEvents: "none",
      }}
    />
  );
}
