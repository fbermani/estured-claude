/**
 * Cuadros clave de EstuRed-IG-Post1 para revision (sin renderizar MP4).
 * Uso: node scripts/ig-stills.mjs [frame1,frame2,...] [scale]
 * Salida: out/stills/EstuRed-IG-Post1/<cuadro>.png
 */
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ID = "EstuRed-IG-Post1";
const frames = (process.argv[2] ?? "0,75,138,235,262,330,390,500,560,640,740,760,850,935,1000,1030,1049")
  .split(",")
  .map(Number);
const scale = Number(process.argv[3] ?? 0.6);
const root = path.resolve(import.meta.dirname, "..");
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts") });
const outDir = path.join(root, "out/stills", ID);
fs.mkdirSync(outDir, { recursive: true });
const composition = await selectComposition({ serveUrl, id: ID, browserExecutable: CHROME });
for (const frame of frames) {
  const output = path.join(outDir, `${String(frame).padStart(4, "0")}.png`);
  await renderStill({ composition, serveUrl, frame, output, imageFormat: "png", scale, browserExecutable: CHROME });
  console.log(output);
}
