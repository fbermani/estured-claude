import { describe, expect, it } from "vitest";
import { formatInitial, formatShortName } from "./shortName";

describe("formatShortName", () => {
  it("no duplica el punto cuando la inicial ya lo trae", () => {
    expect(formatShortName("Camila", "R.")).toBe("Camila R.");
  });
  it("agrega el punto cuando falta", () => {
    expect(formatShortName("Ana", "j")).toBe("Ana J.");
  });
  it("tolera datos faltantes", () => {
    expect(formatShortName("Ana", null)).toBe("Ana");
    expect(formatShortName(undefined, "R.")).toBe("R.");
    expect(formatShortName(null, null)).toBe("");
    expect(formatInitial("..")).toBe("");
  });
});
