import { loadFont as loadBricolage } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as loadHanken } from "@remotion/google-fonts/HankenGrotesk";
import { loadFont as loadLocal } from "@remotion/fonts";
import { staticFile } from "remotion";

/** Sistema FRESH vigente de EstuRed (no usar petrol/sage/sand: legacy). */
export const C = {
  forest: "#1f7d5c",
  forestHover: "#166349",
  forestInk: "#0c3a2c",
  forestTint: "#e2f1ea",
  orange: "#c0521d",
  orangeLight: "#ef8551", // solo sobre fondo oscuro
  orangeTint: "#fde7da",
  cream: "#fbf6ec",
  cream2: "#f4ecdc",
  paper: "#ffffff",
  line: "#e8e0d2",
  gold: "#e9b84b",
  ink: "#1d2722",
  inkSoft: "#44524b",
  heroAccent: "#f9d48a",
} as const;

export const display = loadBricolage("normal", {
  weights: ["700", "800"],
  subsets: ["latin", "latin-ext"],
}).fontFamily;

export const body = loadHanken("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin", "latin-ext"],
}).fontFamily;

export const ICON_FAMILY = "Material Symbols Outlined";
loadLocal({
  family: ICON_FAMILY,
  url: staticFile("fonts/material-symbols-outlined.woff2"),
});
