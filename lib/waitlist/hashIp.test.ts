import { describe, expect, it } from "vitest";
import { hashIp } from "@/lib/waitlist/hashIp";

describe("hashIp", () => {
  it("genera el mismo hash para la misma IP", async () => {
    const a = await hashIp("190.191.192.193");
    const b = await hashIp("190.191.192.193");
    expect(a).toBe(b);
  });

  it("genera hashes distintos para IPs distintas", async () => {
    const a = await hashIp("190.191.192.193");
    const b = await hashIp("190.191.192.194");
    expect(a).not.toBe(b);
  });

  it("devuelve un hex de 64 caracteres (SHA-256) y nunca la IP en texto plano", async () => {
    const hash = await hashIp("190.191.192.193");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("190.191.192.193");
  });
});
