/**
 * Genera src/ig/subtitles.json PROVISORIO: reparte las palabras de cada cue de
 * forma uniforme dentro de la ventana de voz de cada escena (timing.json).
 * Cuando exista la voz real, reemplazar subtitles.json por la alineacion real
 * (mismo formato, "provisional": false) o regenerar con nuevos tiempos.
 * Uso: node scripts/ig-subtitles.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const timing = JSON.parse(fs.readFileSync(path.join(root, "src/ig/timing.json"), "utf8"));

// Texto exacto del guion (GUIONES_Y_POSTS.md §B), partido en cues de una a dos lineas.
const TEXT = {
  1: ["¿Cómo elegís una residencia en Buenos Aires… sin poder ir a verla?"],
  2: ["Las fotos y los chats no alcanzan para decidir dónde vas a vivir."],
  3: ["Y viajar antes a verlas todas no siempre se puede."],
  4: ["Por eso en EstuRed las residencias se visitan en persona antes de publicarse."],
  5: [
    "Compara su ubicación, servicios y reglamento",
    "desde tu casa, con tu familia si querés.",
    "La decisión es tuya.",
  ],
  6: [
    "Enviás tu solicitud sin costo,",
    "seguís cada paso y todo queda registrado.",
  ],
  7: ["Sumate gratis desde el link en la bio."],
};

const cues = [];
for (const sc of timing.scenes) {
  const from = sc.start + timing.voiceDelay;
  const to = sc.n === 7 ? sc.start + 2.8 : sc.end - 0.25;
  const all = TEXT[sc.n].flatMap((t) => t.split(/\s+/));
  const step = (to - from) / all.length;
  let i = 0;
  for (const text of TEXT[sc.n]) {
    const words = text.split(/\s+/).map((w) => {
      const start = +(from + i * step).toFixed(3);
      const end = +(from + (i + 1) * step).toFixed(3);
      i++;
      return { w, start, end };
    });
    cues.push({ scene: sc.n, text, words });
  }
}
fs.writeFileSync(
  path.join(root, "src/ig/subtitles.json"),
  JSON.stringify({ provisional: true, cues }, null, 2) + "\n",
);
console.log(`subtitles.json provisorio: ${cues.length} cues`);
