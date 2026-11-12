import { describe, expect, it } from "vitest";
import { sessionHintFor } from "@/lib/supabase/cookie-options";

const opts = { path: "/" };

describe("sessionHintFor", () => {
  it("pone la pista cuando se setea un auth-token", () => {
    const hint = sessionHintFor([{ name: "sb-abc-auth-token", value: "x", options: opts }]);
    expect(hint?.value).toBe("1");
  });

  it("ignora la cookie del code-verifier (PKCE): no es una sesión", () => {
    expect(sessionHintFor([{ name: "sb-abc-auth-token-code-verifier", value: "v", options: opts }])).toBeNull();
  });

  it("borrar solo el code-verifier no borra la pista de una sesión viva", () => {
    expect(sessionHintFor([{ name: "sb-abc-auth-token-code-verifier", value: "", options: { ...opts, maxAge: 0 } }])).toBeNull();
  });
});
