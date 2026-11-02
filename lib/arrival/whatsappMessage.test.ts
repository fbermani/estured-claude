import { describe, expect, it } from "vitest";
import { buildArrivalMessage, buildWhatsAppUrl } from "./whatsappMessage";

describe("mensaje de llegada", () => {
  it("usa hoy / mañana / la fecha", () => {
    const base = { residenceName: "Casa Sur", startDateLabel: "10/11/2026" };
    expect(buildArrivalMessage({ ...base, daysLeft: 0 })).toContain("previsto para hoy");
    expect(buildArrivalMessage({ ...base, daysLeft: 1 })).toContain("previsto para mañana");
    expect(buildArrivalMessage({ ...base, daysLeft: 8 })).toContain("previsto para el 10/11/2026");
  });
  it("no menciona garantías ni mediación", () => {
    const m = buildArrivalMessage({ residenceName: "X", startDateLabel: "1/1", daysLeft: 5 }).toLowerCase();
    expect(m).not.toMatch(/garant|mediaci/);
  });
  it("arma un wa.me con el texto codificado", () => {
    const msg = "Hola & chau? ñ";
    const url = buildWhatsAppUrl(msg);
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1])).toBe(msg);
    expect(url).not.toContain(" ");
  });
});
