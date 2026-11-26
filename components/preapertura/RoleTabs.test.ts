import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RoleTabs } from "@/components/preapertura/RoleTabs";

function links(current: "student" | "family") {
  const html = renderToStaticMarkup(createElement(RoleTabs, { current }));
  return [...html.matchAll(/<a ([^>]*)>(.*?)<\/a>/g)].map(([, attrs, text]) => ({
    href: /href="([^"]*)"/.exec(attrs)?.[1],
    current: attrs.includes('aria-current="page"'),
    text: text.replace(/<span[^>]*>[^<]*<\/span>/g, ""),
  }));
}

describe("RoleTabs: estudiante o familiar (DR67 e)", () => {
  it("son dos enlaces y marca el actual", () => {
    expect(links("student")).toEqual([
      { href: "/preregistro", current: true, text: "Soy estudiante" },
      { href: "/preregistro/familiar", current: false, text: "Soy familiar" },
    ]);
    expect(links("family").map((l) => l.current)).toEqual([false, true]);
  });
});
