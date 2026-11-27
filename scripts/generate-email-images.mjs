// Genera las imágenes PNG de los mails en public/email/ a partir del logo y los tokens de marca.
// Uso: node scripts/generate-email-images.mjs   (determinista; no usa texto, así no depende de fuentes del sistema)
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "public/email");

const C = {
  paper: "#fffdf8", cream: "#fbf6ec", cream2: "#f4ecdc", line2: "#ded4c2",
  forest: "#1f7d5c", forest700: "#0f4d39", forestInk: "#0c3a2c", forestTint: "#e2f1ea",
  orange: "#c0521d", orangeTint: "#fde7da", gold: "#e9b84b", butter: "#fbeec3",
};

/** Marca sola (`estured-mark.svg` sobre claro, `estured-mark-crema.svg` sobre oscuro), ubicada dentro de otro SVG. */
async function mark(x, y, width, file = "estured-mark.svg") {
  const svg = await readFile(join(ROOT, "public/brand", file), "utf8");
  const viewBox = svg.match(/viewBox="([^"]+)"/)[1];
  const [, , w, h] = viewBox.split(/\s+/).map(Number);
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  return `<svg x="${x}" y="${y}" width="${width}" height="${(width * h) / w}" viewBox="${viewBox}">${inner}</svg>`;
}

const ON_DARK = "estured-mark-crema.svg";

const W = 1200;
const H = 400;
const frame = (background, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${background}"/>${body}</svg>`;
const rect = (x, y, w, h, fill, r = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
const circle = (cx, cy, r, fill) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;

/** Edificio con techo opcional, ventanas (algunas encendidas) y puerta. */
function building({ x, w, h, wall, roof, lit = [] }) {
  const top = 340 - h;
  const cols = Math.max(2, Math.floor((w - 20) / 52));
  const gap = (w - cols * 30) / (cols + 1);
  const rows = Math.floor((h - 90) / 58);
  let out = rect(x, top, w, h, wall, 8);
  if (roof) out += `<path d="M${x - 12} ${top + 4} L${x + w / 2} ${top - 54} L${x + w + 12} ${top + 4} Z" fill="${roof}" stroke="${roof}" stroke-width="8" stroke-linejoin="round"/>`;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const on = lit.includes(r * cols + c);
      out += rect(x + gap + c * (30 + gap), top + 24 + r * 58, 30, 36, on ? C.gold : C.forestInk, 6);
    }
  }
  return out + rect(x + w / 2 - 20, 292, 40, 48, C.orange, 8);
}

async function founders() {
  const body = [
    circle(852, 66, 22, C.butter),
    building({ x: 70, w: 150, h: 190, wall: C.forestTint, roof: C.orange, lit: [1, 2] }),
    building({ x: 250, w: 180, h: 270, wall: C.cream, lit: [0, 4, 5, 7] }),
    building({ x: 460, w: 140, h: 165, wall: C.orangeTint, roof: C.forest, lit: [0] }),
    building({ x: 630, w: 170, h: 230, wall: C.cream2, lit: [2, 3] }),
    rect(0, 340, W, 60, C.forest700),
    // Sello de fundadora: cinta y medalla con la marca.
    `<path d="M930 250 L900 352 L946 332 L972 372 L996 268 Z" fill="${C.orange}"/>`,
    `<path d="M1070 250 L1100 352 L1054 332 L1028 372 L1004 268 Z" fill="${C.orange}"/>`,
    circle(1000, 190, 118, C.gold),
    circle(1000, 190, 96, C.butter),
    await mark(939, 128, 122),
  ].join("");
  return frame(C.forestInk, body);
}

async function invitation() {
  const body = [
    circle(180, 110, 46, C.gold),
    circle(1020, 300, 70, C.forestTint),
    circle(1060, 90, 22, C.orange),
    circle(280, 300, 18, C.forest),
    // Sobre abierto con una tarjeta que asoma.
    `<path d="M370 170 L600 40 L830 170 Z" fill="${C.forest700}" stroke="${C.forest700}" stroke-width="12" stroke-linejoin="round"/>`,
    rect(420, 62, 360, 260, C.paper, 18),
    `<rect x="420" y="62" width="360" height="260" rx="18" fill="none" stroke="${C.line2}" stroke-width="3"/>`,
    await mark(534, 86, 132),
    `<path d="M370 170 L600 300 L830 170 L830 350 Q830 364 816 364 L384 364 Q370 364 370 350 Z" fill="${C.forest}"/>`,
    `<path d="M376 360 L560 258 Q600 236 640 258 L824 360 Z" fill="${C.forest700}"/>`,
  ].join("");
  return frame(C.butter, body);
}

async function account() {
  const body = [
    circle(150, 320, 60, C.forestTint),
    circle(1040, 90, 52, C.butter),
    circle(260, 90, 20, C.orange),
    // Tarjeta con la marca y una llave.
    rect(330, 70, 330, 260, C.forestInk, 24),
    await mark(428, 118, 134, ON_DARK),
    circle(790, 200, 74, C.gold),
    circle(790, 200, 28, C.cream),
    rect(850, 182, 190, 36, C.gold, 12),
    rect(962, 210, 30, 54, C.gold, 8),
    rect(1006, 210, 30, 36, C.gold, 8),
  ].join("");
  return frame(C.cream2, body);
}

await mkdir(OUT, { recursive: true });
for (const [name, svg] of [["fundadora", await founders()], ["invitacion", await invitation()], ["cuenta", await account()]]) {
  await sharp(Buffer.from(svg)).png({ palette: true, quality: 90 }).toFile(join(OUT, `${name}.png`));
}
// Marca crema para el encabezado (se muestra a 34×35; se exporta al triple).
const header = `<svg xmlns="http://www.w3.org/2000/svg" width="102" height="105" viewBox="0 0 102 105">${await mark(0, 0.5, 102, ON_DARK)}</svg>`;
await sharp(Buffer.from(header)).png().toFile(join(OUT, "marca.png"));
console.log("Imágenes generadas en public/email/");
