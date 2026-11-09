import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Acción `requestResidenceSignup` (DR46.4): 5 datos obligatorios validados en el SERVIDOR, mail de confirmación y lugar de fundadora.
 * Integración contra `estured-dev`: las solicitudes de prueba usan mails `test-resi-*@estured.test` y se borran al final. El mail y el
 * encabezado de pedido se simulan (nunca sale un mail real); el flag de preapertura se enciende o apaga por prueba.
 */
const sent: Array<{ to: string; subject: string; html: string; replyTo?: string }> = [];
let clientIp = "203.0.113.1";
let flagOn = true;

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": clientIp }),
}));
vi.mock("@/lib/email/sendEmail", () => ({
  sendEmail: async (entry: { to: string; subject: string; html: string; replyTo?: string }) => {
    sent.push(entry);
    return true;
  },
}));
vi.mock("@/lib/preapertura/flag", () => ({ isPreaperturaOn: () => flagOn }));

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requestResidenceSignup, type RequestResidenceState } from "@/app/(public)/register/residence/actions";
import { SIGNUP_ALERT_EMPTY, SIGNUP_ALERT_INVALID } from "@/lib/residenceSignup/rules";

const admin = getSupabaseAdmin();
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const emailOf = (tag: string) => `test-resi-${tag}-${stamp}@estured.test`;
const IDLE: RequestResidenceState = { status: "idle" };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}
const valid = (tag: string) => ({
  residence_name: `Residencia Test ${stamp}`,
  address: "Av. Córdoba 1234, CABA",
  contact_name: "Ricardo Test",
  phone: "+54 9 11 5555 1234",
  email: emailOf(tag),
});

async function rowsOf(email: string) {
  if (!admin) return [];
  const { data } = await admin.from("residence_signup_requests").select("residence_name, address, neighborhood, email, status").eq("email", email);
  return data ?? [];
}

let ready = false;
beforeAll(async () => {
  if (!admin) return;
  const probe = await admin.from("residence_signup_requests").select("address").limit(1);
  ready = !probe.error;
  if (!ready) console.warn("[residence-signup] actions.test: falta la migración 0066/0080 en este entorno; la integración se saltea.");
});
beforeEach(() => {
  sent.length = 0;
  flagOn = true;
  clientIp = `203.0.113.${Math.floor(Math.random() * 250) + 2}`;
});
afterAll(async () => {
  if (admin) await admin.from("residence_signup_requests").delete().like("email", `test-resi-%-${stamp}@estured.test`);
});

describe("requestResidenceSignup: validación de servidor de los 5 datos", () => {
  it("con todo vacío marca los 5 campos y pide completar los 5 datos (no guarda ni manda mail)", async () => {
    const state = await requestResidenceSignup(IDLE, form({ residence_name: "", address: "", contact_name: "", phone: "", email: "" }));
    expect(state.status).toBe("error");
    expect(state.message).toBe(SIGNUP_ALERT_EMPTY);
    expect(Object.keys(state.fieldErrors ?? {}).sort()).toEqual(["address", "contact_name", "email", "phone", "residence_name"]);
    expect(sent).toHaveLength(0);
  });
  it("con un dato inválido (no vacío) marca solo ese campo y conserva lo escrito", async () => {
    const state = await requestResidenceSignup(IDLE, form({ ...valid("inv"), email: "sin-arroba" }));
    expect(state.status).toBe("error");
    expect(state.message).toBe(SIGNUP_ALERT_INVALID);
    expect(Object.keys(state.fieldErrors ?? {})).toEqual(["email"]);
    expect(state.values?.address).toBe("Av. Córdoba 1234, CABA");
    expect(sent).toHaveLength(0);
  });
  it("el barrio ya no alcanza: sin dirección es error aunque venga el barrio (viejo formulario)", async () => {
    const { address: _address, ...legacy } = valid("legacy");
    void _address;
    const state = await requestResidenceSignup(IDLE, form({ ...legacy, neighborhood: "Palermo" }));
    expect(state.status).toBe("error");
    expect(Object.keys(state.fieldErrors ?? {})).toEqual(["address"]);
  });
  it("el honeypot completo responde éxito sin guardar", async () => {
    const fields = { ...valid("bot"), company_site: "http://spam" };
    expect((await requestResidenceSignup(IDLE, form(fields))).status).toBe("success");
    if (admin && ready) expect(await rowsOf(fields.email)).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });
});

describe("requestResidenceSignup: alta guardada (requiere 0080)", () => {
  it("con preapertura: guarda la dirección (sin barrio), devuelve el lugar de fundadora y manda UN mail de confirmación", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    const fields = valid("ok");
    const state = await requestResidenceSignup(IDLE, form(fields));
    expect(state.status).toBe("success");
    expect(["cupo", "lleno", "cerrado", "unknown"]).toContain(state.founder);
    const rows = await rowsOf(fields.email);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ address: "Av. Córdoba 1234, CABA", neighborhood: null, status: "received" });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: fields.email, replyTo: "hola@estured.com" });
    expect(sent[0].html).toContain("Av. Córdoba 1234, CABA");
    expect(sent[0].subject).toContain(fields.residence_name);
  });
  it("un duplicado activo cuenta como éxito pero no repite el mail", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    const fields = valid("dup");
    await requestResidenceSignup(IDLE, form(fields));
    sent.length = 0;
    const again = await requestResidenceSignup(IDLE, form(fields));
    expect(again.status).toBe("success");
    expect(await rowsOf(fields.email)).toHaveLength(1);
    expect(sent).toHaveLength(0);
  });
  it("con la preapertura apagada se guarda igual pero sin mail ni lugar de fundadora", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    flagOn = false;
    const fields = valid("off");
    const state = await requestResidenceSignup(IDLE, form(fields));
    expect(state).toEqual({ status: "success" });
    expect(await rowsOf(fields.email)).toHaveLength(1);
    expect(sent).toHaveLength(0);
  });
  it("freno por email aparte del de IP: a la cuarta solicitud con el mismo email, aunque cambie la IP, se corta", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    const fields = valid("rl");
    const results: RequestResidenceState[] = [];
    for (let i = 0; i < 4; i++) {
      clientIp = `198.51.100.${10 + i}`; // IP distinta cada vez: el límite que corta es el del email
      results.push(await requestResidenceSignup(IDLE, form(fields)));
    }
    expect(results.slice(0, 3).every((r) => r.status === "success")).toBe(true);
    expect(results[3].status).toBe("error");
    expect(results[3].message).toContain("varias solicitudes con ese email");
    expect(sent).toHaveLength(1); // solo la primera (las otras son duplicados) mandó mail
  });

  it("PRODUCCIÓN: el envío vacío falla con los 5 errores y no crea ninguna solicitud de prueba", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    vi.stubEnv("NODE_ENV", "production");
    const before = (await admin.from("residence_signup_requests").select("id", { count: "exact", head: true }).like("email", "test-resi-%")).count;
    const state = await requestResidenceSignup(IDLE, form({ residence_name: "", address: "", contact_name: "", phone: "", email: "" }));
    vi.unstubAllEnvs();
    expect(state.status).toBe("error");
    expect(state.message).toBe(SIGNUP_ALERT_EMPTY);
    expect(state).not.toHaveProperty("devEmail");
    const after = (await admin.from("residence_signup_requests").select("id", { count: "exact", head: true }).like("email", "test-resi-%")).count;
    expect(after).toBe(before);
  });

  it("DESARROLLO: el envío vacío crea una solicitud de PRUEBA identificable (test-resi-…) y sigue al éxito, sin mandar mail", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    vi.stubEnv("NODE_ENV", "development");
    const state = await requestResidenceSignup(IDLE, form({ residence_name: "", address: "", contact_name: "", phone: "", email: "" }));
    vi.unstubAllEnvs();
    expect(state.status).toBe("success");
    expect(state.devEmail).toMatch(/^test-resi-[0-9a-f]{8}@estured\.test$/);
    const rows = await rowsOf(state.devEmail!);
    expect(rows).toHaveLength(1);
    expect(rows[0].residence_name).toMatch(/^Residencia de prueba /);
    expect(sent).toHaveLength(0);
    await admin.from("residence_signup_requests").delete().eq("email", state.devEmail!);
  });

  it("DESARROLLO con un campo escrito: validación normal (no se autogenera nada)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const state = await requestResidenceSignup(IDLE, form({ residence_name: "Casa", address: "", contact_name: "", phone: "", email: "" }));
    vi.unstubAllEnvs();
    expect(state.status).toBe("error");
    expect(Object.keys(state.fieldErrors ?? {})).toEqual(expect.arrayContaining(["address", "contact_name", "phone", "email"]));
  });
});
