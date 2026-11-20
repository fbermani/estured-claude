/** Móvil: la quinta celda (Edades) no queda sola con medio ancho vacío; se acomoda en horizontal. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EssentialsStrip } from "@/components/residences/ficha/EssentialsStrip";
import type { EssentialCell } from "@/lib/residences/fichaEssentials";

const cell = (key: EssentialCell["key"], label: string, value: string, sub?: string): EssentialCell => ({ key, icon: "sell", label, value, sub });
const four = [cell("desde", "Desde", "USD 190"), cell("habitaciones", "Habitaciones", "3 tipos"), cell("estadia", "Estadía mínima", "6 meses"), cell("cerca", "Cerca de", "1,9 km")];
const edad = cell("edad", "Edades", "18 a 26", "promedio 22 años");

const items = (cells: EssentialCell[]) => renderToStaticMarkup(createElement(EssentialsStrip, { cells, faqCount: 0 })).split("<li").slice(1);

describe("EssentialsStrip: celda impar final en móvil", () => {
  it("con cinco celdas, solo la última usa el layout horizontal (2 columnas auto/1fr) y ocupa la fila entera", () => {
    const li = items([...four, edad]);
    expect(li).toHaveLength(5);
    li.slice(0, 4).forEach((x) => expect(x).not.toContain("max-[767px]:grid-cols"));
    expect(li[4]).toContain("col-span-2");
    expect(li[4]).toContain("max-[767px]:grid-cols-[auto_minmax(0,1fr)]");
    expect(li[4]).toContain("max-[767px]:text-right");
  });

  it("con cuatro celdas (par) ninguna cambia de layout", () => {
    items(four).forEach((x) => expect(x).not.toContain("max-[767px]:grid-cols"));
  });
});
