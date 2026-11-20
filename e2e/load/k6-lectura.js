// Carga de LECTURA contra staging (estured.vercel.app → estured-dev). Nunca producción.
// Uso: k6 run -e AUTH_DIR=/ruta/sesiones -e PEAK=50 e2e/load/k6-lectura.js
// Reusa las sesiones de Playwright (no hace login por usuario virtual).
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "https://estured.vercel.app";
const HOST = BASE.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
if (HOST !== "estured.vercel.app" && HOST !== "localhost" && HOST !== "127.0.0.1") {
  throw new Error("Host no permitido para carga: " + BASE);
}
const AUTH_DIR = __ENV.AUTH_DIR;
const PEAK = parseInt(__ENV.PEAK || "50", 10);

function cookieHeader(key) {
  const s = JSON.parse(open(`${AUTH_DIR}/${key}.json`));
  return s.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}
const COOKIES = { student: cookieHeader("camila"), owner: cookieHeader("owner"), admin: cookieHeader("admin") };

export const options = {
  scenarios: {
    lectura: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "30s", target: Math.ceil(PEAK / 5) },
        { duration: "45s", target: Math.ceil(PEAK / 2) },
        { duration: "45s", target: PEAK },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: "rate<0.02", abortOnFail: true, delayAbortEval: "20s" }],
    http_req_duration: [{ threshold: "p(95)<3000", abortOnFail: true, delayAbortEval: "20s" }],
  },
};

const PUBLIC = ["/", "/search", "/guias", "/for-residences", "/terms"];

export function setup() {
  const html = http.get(`${BASE}/search`).body || "";
  const m = html.match(/href="(\/residencias\/[^"?#]+)"/);
  return { ficha: m ? m[1] : null };
}

export default function (data) {
  const r = Math.random();
  let res;
  if (r < 0.5) {
    res = http.get(BASE + PUBLIC[Math.floor(Math.random() * PUBLIC.length)], { tags: { tipo: "publica" } });
  } else if (r < 0.7 && data.ficha) {
    res = http.get(BASE + data.ficha, { tags: { tipo: "ficha" } });
  } else if (r < 0.85) {
    res = http.get(`${BASE}/students/dashboard`, { headers: { Cookie: COOKIES.student }, tags: { tipo: "estudiante" } });
  } else if (r < 0.95) {
    res = http.get(`${BASE}/residence/dashboard`, { headers: { Cookie: COOKIES.owner }, tags: { tipo: "residencia" } });
  } else {
    res = http.get(`${BASE}/admin/dashboard`, { headers: { Cookie: COOKIES.admin }, tags: { tipo: "admin" } });
  }
  check(res, { "status 200": (x) => x.status === 200 });
  sleep(1 + Math.random() * 2);
}
