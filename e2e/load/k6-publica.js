// Carga de LECTURA anónima contra el Preview de staging (estured-dev). Nunca producción.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = "https://estured.vercel.app";
const VUS = parseInt(__ENV.VUS || "10", 10);
const DUR = __ENV.DUR || "2m";

export const options = {
  scenarios: {
    etapa: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "20s", target: VUS },
        { duration: DUR, target: VUS },
        { duration: "10s", target: 0 },
      ],
    },
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
  thresholds: {
    http_req_failed: [{ threshold: "rate<0.02", abortOnFail: true, delayAbortEval: "20s" }],
    http_req_duration: [{ threshold: "p(95)<5000", abortOnFail: true, delayAbortEval: "20s" }],
  },
};

export function setup() {
  const html = http.get(`${BASE}/search`).body || "";
  const m = html.match(/href="(\/residencias\/[^"?#]+)"/);
  return { ficha: m ? m[1] : null };
}

export default function (data) {
  const r = Math.random();
  let res;
  if (r < 0.35) res = http.get(`${BASE}/`, { tags: { tipo: "home" } });
  else if (r < 0.6) res = http.get(`${BASE}/search`, { tags: { tipo: "search" } });
  else if (r < 0.85 && data.ficha) res = http.get(BASE + data.ficha, { tags: { tipo: "ficha" } });
  else res = http.get(`${BASE}/preregistro`, { tags: { tipo: "preregistro" } });
  check(res, { "status 200": (x) => x.status === 200 });
  sleep(1 + Math.random() * 2);
}
