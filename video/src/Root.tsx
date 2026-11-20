import type React from "react";
import { Composition, Folder } from "remotion";
import { EstuRedVideo, TOTAL } from "./EstuRedVideo";
import { MotionVideo } from "./MotionVideo";
import { LaunchVideo, LAUNCH_DURATION } from "./launch/LaunchVideo";
import { Post1, POST1_DURATION } from "./ig/Post1";

export const RemotionRoot: React.FC = () => (
  <Folder name="EstuRed">
    <Composition
      id="EstuRed-IG-Post1"
      component={Post1}
      durationInFrames={POST1_DURATION}
      fps={30}
      width={1080}
      height={1920}
    />
    <Composition
      id="EstuRed-Launch-16x9"
      component={LaunchVideo}
      durationInFrames={LAUNCH_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="EstuRed-Launch-9x16"
      component={LaunchVideo}
      durationInFrames={LAUNCH_DURATION}
      fps={30}
      width={1080}
      height={1920}
    />
    <Composition
      id="EstuRed-Motion-16x9"
      component={MotionVideo}
      durationInFrames={1800}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="EstuRed-Motion-9x16"
      component={MotionVideo}
      durationInFrames={1800}
      fps={30}
      width={1080}
      height={1920}
    />
    <Composition
      id="EstuRed-16x9"
      component={EstuRedVideo}
      durationInFrames={TOTAL}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="EstuRed-9x16"
      component={EstuRedVideo}
      durationInFrames={TOTAL}
      fps={30}
      width={1080}
      height={1920}
    />
  </Folder>
);
