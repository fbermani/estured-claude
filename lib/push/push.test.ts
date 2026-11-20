import { describe, expect, it } from "vitest";
import { PUSH_CATEGORIES } from "@/lib/notifications/categories";
import { isAllowedPushEndpoint, isValidPushKey } from "@/lib/push/endpoint";
import { shouldSendPush } from "@/lib/push/eligibility";
import { buildPushPayload } from "@/lib/push/payload";
import { argentinaHour, isPushSendWindowOpen } from "@/lib/push/schedule";

describe("payload genérico (DR61 punto 4)", () => {
  it("no incluye datos del aviso: solo texto fijo, tag, url del área y contador", () => {
    for (const category of PUSH_CATEGORIES) {
      const p = buildPushPayload({ category, area: "student", unreadCount: 3 });
      expect(Object.keys(p).sort()).toEqual(["badge", "body", "tag", "title", "url"]);
      expect(`${p.title} ${p.body}`).not.toMatch(/\$|USD|ARS|\d{6,}/);
      expect(p.url).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
    }
  });
  it("agrupa por categoría con el tag", () => {
    expect(buildPushPayload({ category: "deadlines", area: "residence", unreadCount: 1 }).tag).toBe("estured-deadlines");
  });
  it("lleva a la pantalla de inicio del área", () => {
    expect(buildPushPayload({ category: "payments_fee", area: "admin", unreadCount: 0 }).url).toBe("/admin/dashboard");
    expect(buildPushPayload({ category: "payments_fee", area: "residence", unreadCount: 0 }).url).toBe("/residence/dashboard");
  });
  it("acota el contador entre 0 y 99 y tolera valores inválidos", () => {
    expect(buildPushPayload({ category: "deadlines", area: "student", unreadCount: 250 }).badge).toBe(99);
    expect(buildPushPayload({ category: "deadlines", area: "student", unreadCount: -4 }).badge).toBe(0);
    expect(buildPushPayload({ category: "deadlines", area: "student", unreadCount: Number.NaN }).badge).toBe(0);
  });
});

describe("horario (DR61 punto 5)", () => {
  it("convierte UTC a hora de Argentina (UTC-3)", () => {
    expect(argentinaHour(new Date("2026-11-20T12:00:00Z"))).toBe(9);
    expect(argentinaHour(new Date("2026-11-20T02:59:00Z"))).toBe(23);
    expect(argentinaHour(new Date("2026-11-20T03:00:00Z"))).toBe(0);
  });
  it("no envía de 0:00 a 8:59 y sí de 9:00 a 23:59", () => {
    expect(isPushSendWindowOpen(new Date("2026-11-20T11:59:00Z"))).toBe(false); // 8:59 AR
    expect(isPushSendWindowOpen(new Date("2026-11-20T12:00:00Z"))).toBe(true); // 9:00 AR
    expect(isPushSendWindowOpen(new Date("2026-11-21T02:59:00Z"))).toBe(true); // 23:59 AR
    expect(isPushSendWindowOpen(new Date("2026-11-21T03:00:00Z"))).toBe(false); // 0:00 AR
  });
});

describe("elegibilidad y preferencias (DR61 punto 3)", () => {
  it("none nunca dispara push", () => {
    expect(shouldSendPush({ category: "none", isAdmin: true, preferences: {} })).toBe(false);
    expect(shouldSendPush({ category: "otra", isAdmin: true, preferences: {} })).toBe(false);
  });
  it("sin fila de preferencia significa activado", () => {
    expect(shouldSendPush({ category: "deadlines", isAdmin: false, preferences: {} })).toBe(true);
  });
  it("respeta el interruptor apagado de esa categoría", () => {
    expect(shouldSendPush({ category: "deadlines", isAdmin: false, preferences: { deadlines: false } })).toBe(false);
    expect(shouldSendPush({ category: "payments_fee", isAdmin: false, preferences: { deadlines: false } })).toBe(true);
  });
  it("las categorías admin_* solo van a admins", () => {
    expect(shouldSendPush({ category: "admin_requests", isAdmin: false, preferences: {} })).toBe(false);
    expect(shouldSendPush({ category: "admin_signups", isAdmin: true, preferences: {} })).toBe(true);
    expect(shouldSendPush({ category: "admin_signups", isAdmin: true, preferences: { admin_signups: false } })).toBe(false);
  });
});

describe("endpoint de la suscripción (anti-SSRF)", () => {
  it("acepta los proveedores conocidos por https", () => {
    for (const url of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/QAbc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) {
      expect(isAllowedPushEndpoint(url)).toBe(true);
    }
  });
  it("rechaza http, hosts propios, IPs, credenciales, puertos y trucos de dominio", () => {
    for (const url of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://evil.example.com/x",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost/x",
      "https://fcm.googleapis.com.evil.com/x",
      "https://evil.com/?h=fcm.googleapis.com",
      "https://user:pw@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
      "https://notify.windows.com.evil.com/x",
      "javascript:alert(1)",
      "",
    ]) {
      expect(isAllowedPushEndpoint(url)).toBe(false);
    }
    expect(isAllowedPushEndpoint(undefined)).toBe(false);
    expect(isAllowedPushEndpoint(`https://fcm.googleapis.com/${"a".repeat(2100)}`)).toBe(false);
  });
  it("valida el formato de las claves", () => {
    expect(isValidPushKey("BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM")).toBe(true);
    expect(isValidPushKey("corta")).toBe(false);
    expect(isValidPushKey("con espacios y <script>")).toBe(false);
    expect(isValidPushKey(123)).toBe(false);
  });
});
