import { describe, expect, it } from "vitest";
import { safeInternalPath } from "@/lib/auth/safeNext";

describe("safeInternalPath (open redirect)", () => {
  it("acepta rutas internas con query", () => {
    expect(safeInternalPath("/students/residency/invite?invite=abc")).toBe("/students/residency/invite?invite=abc");
    expect(safeInternalPath("/students/dashboard")).toBe("/students/dashboard");
  });
  it("rechaza otro origen, protocolo relativo, backslashes, control chars y basura", () => {
    for (const bad of ["//evil.com", "/\\\\evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "evil", "", "/ok\\n//evil", "/a\\tb", "/a\\u0000b", null, undefined, 5]) {
      expect(safeInternalPath(bad as never)).toBeNull();
    }
  });
});
