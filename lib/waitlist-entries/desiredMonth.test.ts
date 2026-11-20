import { describe, expect, it } from "vitest";
import {
  buildMonthOptions,
  currentMonthStart,
  formatDesiredMonth,
  isCountableWaitlistEntry,
  isCurrentMonth,
  isDesiredMonthExpired,
  monthEndIso,
  parseDesiredMonthInput,
  sortWaitlistEntries,
  toMonthStart,
} from "@/lib/waitlist-entries/desiredMonth";

const NOW = new Date("2026-11-07T15:00:00Z"); // 12:00 en Buenos Aires

describe("mes de ingreso (DR40)", () => {
  it("normaliza al día 1 y formatea", () => {
    expect(toMonthStart("2026-11-17")).toBe("2026-11-01");
    expect(toMonthStart("basura")).toBeNull();
    expect(toMonthStart("2026-13-01")).toBeNull();
    expect(formatDesiredMonth("2026-11-01")).toBe("noviembre 2026");
    expect(formatDesiredMonth(null)).toBeNull();
    expect(monthEndIso("2026-02-01")).toBe("2026-02-28");
    expect(monthEndIso("2028-02-01")).toBe("2028-02-29");
  });

  it("vence recién cuando empieza el mes siguiente (hora de Buenos Aires)", () => {
    expect(isDesiredMonthExpired("2026-11-01", NOW)).toBe(false);
    expect(isDesiredMonthExpired("2026-10-01", NOW)).toBe(true);
    // 30/11 23:00 BA = 01/12 02:00 UTC: todavía noviembre en Buenos Aires.
    expect(isDesiredMonthExpired("2026-11-01", new Date("2026-12-01T02:00:00Z"))).toBe(false);
    // 01/12 00:00 BA = 01/12 03:00 UTC: noviembre terminó.
    expect(isDesiredMonthExpired("2026-11-01", new Date("2026-12-01T03:00:00Z"))).toBe(true);
    expect(isDesiredMonthExpired(null, NOW)).toBe(false);
    expect(isCurrentMonth("2026-11-01", NOW)).toBe(true);
    expect(isCurrentMonth("2026-12-01", NOW)).toBe(false);
    expect(currentMonthStart(NOW)).toBe("2026-11-01");
  });

  it("arma 13 opciones desde el mes actual y respeta la fecha mínima", () => {
    const opts = buildMonthOptions(NOW);
    expect(opts).toHaveLength(13);
    expect(opts[0]).toEqual({ value: "2026-11-01", label: "noviembre 2026" });
    expect(opts[12].value).toBe("2027-11-01");
    const min = buildMonthOptions(NOW, "2027-01-20");
    expect(min[0].value).toBe("2027-01-01");
    expect(min).toHaveLength(13);
  });

  it("valida lo que llega del formulario", () => {
    expect(parseDesiredMonthInput("any", { now: NOW })).toEqual({ ok: true, desiredStartDate: null });
    expect(parseDesiredMonthInput("2026-12-15", { now: NOW })).toEqual({ ok: true, desiredStartDate: "2026-12-01" });
    expect(parseDesiredMonthInput("", { now: NOW }).ok).toBe(false);
    expect(parseDesiredMonthInput("2026-10-01", { now: NOW }).ok).toBe(false);
    expect(parseDesiredMonthInput("2026-12-01", { now: NOW, minStartDate: "2027-01-20" }).ok).toBe(false);
    expect(parseDesiredMonthInput("2027-01-01", { now: NOW, minStartDate: "2027-01-20" }).ok).toBe(true);
  });
});

describe("isCountableWaitlistEntry", () => {
  it("excluye vencidas active/retención; cuentan avisadas, sin mes y mes vigente", () => {
    expect(isCountableWaitlistEntry({ status: "active", desired_start_date: "2026-10-01" }, NOW)).toBe(false);
    expect(isCountableWaitlistEntry({ status: "retention_check_sent", desired_start_date: "2026-10-01" }, NOW)).toBe(false);
    expect(isCountableWaitlistEntry({ status: "availability_notification_sent", desired_start_date: "2026-10-01" }, NOW)).toBe(true);
    expect(isCountableWaitlistEntry({ status: "active", desired_start_date: null }, NOW)).toBe(true);
    expect(isCountableWaitlistEntry({ status: "active", desired_start_date: "2026-11-01" }, NOW)).toBe(true);
    expect(isCountableWaitlistEntry({ status: "expired", desired_start_date: null }, NOW)).toBe(false);
  });
});

describe("sortWaitlistEntries", () => {
  const e = (id: string, status: string, month: string | null, joined: string) => ({
    id, status, desired_start_date: month, joined_at: joined,
  });
  it("respuesta corriendo, mes ascendente, FIFO y sin mes al final", () => {
    const sorted = sortWaitlistEntries([
      e("sin-mes-viejo", "active", null, "2026-01-01T00:00:00Z"),
      e("dic-nuevo", "active", "2026-12-01", "2026-10-05T00:00:00Z"),
      e("dic-viejo", "active", "2026-12-01", "2026-09-05T00:00:00Z"),
      e("nov", "active", "2026-11-01", "2026-10-30T00:00:00Z"),
      e("avisado-sin-mes", "availability_notification_sent", null, "2026-10-01T00:00:00Z"),
      e("chequeo-mar", "retention_check_sent", "2027-03-01", "2026-08-01T00:00:00Z"),
      e("sin-mes-nuevo", "active", null, "2026-10-01T00:00:00Z"),
    ]).map((x) => x.id);
    expect(sorted).toEqual(["chequeo-mar", "avisado-sin-mes", "nov", "dic-viejo", "dic-nuevo", "sin-mes-viejo", "sin-mes-nuevo"]);
  });
  it("no muta la entrada", () => {
    const input = [e("b", "active", null, "2026-02-01T00:00:00Z"), e("a", "active", "2026-11-01", "2026-03-01T00:00:00Z")];
    sortWaitlistEntries(input);
    expect(input[0].id).toBe("b");
  });
});
