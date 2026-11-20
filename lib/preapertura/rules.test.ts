import { describe, expect, it } from "vitest";
import {
  EXAMPLES_OFF_AT,
  EXAMPLE_PROFILES,
  FOUNDER_CAPACITY,
  STUDENT_COUNTER_MIN,
  examplesToShow,
  founderClosure,
  founderPlace,
  founderState,
  studentCounter,
} from "@/lib/preapertura/rules";

describe("studentCounter", () => {
  it("antes de 25 registrados (o sin dato) dice «Sé de los primeros»", () => {
    expect(studentCounter(null)).toEqual({ kind: "first" });
    expect(studentCounter(0)).toEqual({ kind: "first" });
    expect(studentCounter(STUDENT_COUNTER_MIN - 1)).toEqual({ kind: "first" });
    expect(studentCounter(Number.NaN)).toEqual({ kind: "first" });
  });
  it("desde 25 muestra el número real", () => {
    expect(studentCounter(25)).toEqual({ kind: "number", count: 25 });
    expect(studentCounter(347)).toEqual({ kind: "number", count: 347 });
  });
});

describe("founderState", () => {
  it("si falla la consulta cae a texto fijo", () => {
    expect(founderState(null)).toEqual({ kind: "unknown" });
  });
  it("con 0 no hay frase de «ya hay residencias»", () => {
    expect(founderState({ externalSignups: 0, otherInVerification: 0 })).toEqual({ kind: "none" });
  });
  it("una residencia propia en verificación no habilita la frase", () => {
    expect(founderState({ externalSignups: 0, otherInVerification: 2 })).toEqual({ kind: "none" });
  });
  it("la primera externa habilita la frase, sin número, hasta 2", () => {
    expect(founderState({ externalSignups: 1, otherInVerification: 0 })).toEqual({ kind: "some" });
    expect(founderState({ externalSignups: 1, otherInVerification: 1 })).toEqual({ kind: "some" });
  });
  it("desde 3 muestra cuántos lugares quedan, con el cupo real de 10", () => {
    expect(founderState({ externalSignups: 3, otherInVerification: 1 })).toEqual({ kind: "counted", taken: 4, remaining: 6, hasExternal: true });
    expect(founderState({ externalSignups: 9, otherInVerification: 0 })).toEqual({ kind: "counted", taken: 9, remaining: 1, hasExternal: true });
  });
  it("con 3 propias y ninguna externa, el medidor sale pero sin la frase", () => {
    expect(founderState({ externalSignups: 0, otherInVerification: 3 })).toEqual({ kind: "counted", taken: 3, remaining: 7, hasExternal: false });
  });
  it("con 10 o más, el cupo está en proceso", () => {
    expect(FOUNDER_CAPACITY).toBe(10);
    expect(founderState({ externalSignups: 10, otherInVerification: 0 })).toEqual({ kind: "full" });
    expect(founderState({ externalSignups: 8, otherInVerification: 5 })).toEqual({ kind: "full" });
  });
});

describe("founderClosure (FOUNDERS_CLOSE_AT)", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  it("sin fecha definida (o inválida) no hay cuenta regresiva ni se inventa una", () => {
    expect(founderClosure(undefined, now)).toEqual({ kind: "none" });
    expect(founderClosure("", now)).toEqual({ kind: "none" });
    expect(founderClosure("mañana", now)).toEqual({ kind: "none" });
  });
  it("con fecha futura hay cuenta regresiva; pasada, cerró", () => {
    expect(founderClosure("2026-12-15T23:59:00-03:00", now)).toEqual({ kind: "open", closesAt: "2026-12-16T02:59:00.000Z" });
    expect(founderClosure("2026-11-01T00:00:00Z", now)).toEqual({ kind: "closed" });
  });
});

describe("founderPlace (qué se le dice a quien deja su solicitud)", () => {
  const open = { kind: "none" } as const;
  it("cerrada: sin promesas; cupo sin consultar: texto neutro", () => {
    expect(founderPlace({ kind: "counted", taken: 4, remaining: 6, hasExternal: true }, { kind: "closed" })).toBe("cerrado");
    expect(founderPlace({ kind: "unknown" }, open)).toBe("unknown");
  });
  it("con lugares libres ocupa uno; con los 10 en proceso, no", () => {
    expect(founderPlace({ kind: "none" }, open)).toBe("cupo");
    expect(founderPlace({ kind: "some" }, open)).toBe("cupo");
    expect(founderPlace({ kind: "counted", taken: 9, remaining: 1, hasExternal: true }, open)).toBe("cupo");
    expect(founderPlace({ kind: "full" }, open)).toBe("lleno");
  });
});

describe("examplesToShow (retiro de ejemplos del carrusel)", () => {
  it("sin reales, todos los ejemplos; cada real retira uno", () => {
    expect(examplesToShow(0)).toBe(EXAMPLE_PROFILES.length);
    expect(examplesToShow(1)).toBe(EXAMPLE_PROFILES.length - 1);
    expect(examplesToShow(EXAMPLE_PROFILES.length)).toBe(0);
  });
  it("se apagan del todo al llegar al tope y con datos raros no explota", () => {
    expect(examplesToShow(EXAMPLES_OFF_AT)).toBe(0);
    expect(examplesToShow(500)).toBe(0);
    expect(examplesToShow(Number.NaN)).toBe(EXAMPLE_PROFILES.length);
    expect(examplesToShow(-3)).toBe(EXAMPLE_PROFILES.length);
  });
});
