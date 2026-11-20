/**
 * Renderiza cuadros clave de ambas composiciones para revisión rápida.
 * Uso: node scripts/stills.mjs [frame1,frame2,...]
 * Salida: out/stills/<comp>-<frame>.jpg (a media resolución).
 */
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const frames = (process.argv[2] ?? "80,170,280,420,590,755,900,1080,1250,1415,1560,1760")
  .split(",")
  .map(Number);
const comps = (process.argv[3] ?? "EstuRed-16x9,EstuRed-9x16").split(",");

const root = path.resolve(import.meta.dirname, "..");
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts") });
fs.mkdirSync(path.join(root, "out/stills"), { recursive: true });
for (const id of comps) {
  const composition = await selectComposition({ serveUrl, id, browserExecutable: CHROME });
  for (const frame of frames) {
    const output = path.join(root, `out/stills/${id}-${String(frame).padStart(4, "0")}.jpg`);
    await renderStill({ composition, serveUrl, frame, output, imageFormat: "jpeg", scale: 0.5, browserExecutable: CHROME });
    console.log(output);
  }
}
