/**
 * Garantía contra el «scroll de página hacia la derecha donde no hay nada» (staging, Android 375 px). Un contenedor con
 * `overflow-x-auto` que NO es `position: static` ancla a sus descendientes absolutos (los `sr-only`, los `after:absolute` de los
 * enlaces extendidos); si queda `static`, esos descendientes tienen su bloque contenedor FUERA del scroller, escapan del recorte y
 * estiran el ancho del documento (scrollWidth 874 con viewport 375). El test recorre los archivos de la ficha pública y exige que toda
 * clase `overflow-x-auto|scroll` viaje en el mismo string con `relative` (o `isolate`, que también crea contexto de apilamiento
 * pero NO ancla absolutos: por eso solo se acepta `relative` salvo excepción justificada).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIR = join(process.cwd(), "components/residences/ficha");

/** Archivos donde un scroller horizontal sin `relative` es aceptable, con el porqué. */
const EXCEPTIONS: Record<string, string> = {
  // ejemplo: "Archivo.tsx": "no tiene descendientes absolutos ni sr-only y su padre ya es relative",
};

/** Cada literal de string (comillas simples, dobles o backtick) del archivo. */
function stringLiterals(src: string): string[] {
  return src.match(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g) ?? [];
}

const SCROLLER = /(^|[\s"'`])overflow-x-(auto|scroll)(?=[\s"'`])/;
const ANCHORED = /(^|[\s"'`])relative(?=[\s"'`])/;

describe("scrollers horizontales de la ficha anclan a sus descendientes absolutos", () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".tsx") && !(f in EXCEPTIONS));

  it("hay archivos para revisar", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files)("%s: todo overflow-x-auto/scroll lleva `relative` en el mismo className", (file) => {
    const src = readFileSync(join(DIR, file), "utf8");
    const bad = stringLiterals(src).filter((lit) => SCROLLER.test(lit) && !ANCHORED.test(lit));
    expect(bad).toEqual([]);
  });

  it("el detector distingue un scroller anclado de uno suelto", () => {
    expect(SCROLLER.test('"flex overflow-x-auto px-1"')).toBe(true);
    expect(SCROLLER.test('"flex sm:overflow-x-auto px-1"')).toBe(false);
    expect(ANCHORED.test('"relative flex overflow-x-auto"')).toBe(true);
    expect(ANCHORED.test('"sm:relative flex overflow-x-auto"')).toBe(false);
  });
});
