import { MARK_PARTS, MARK_VIEWBOX } from "@/lib/brand/markPath";
import { EsturedSeal } from "@/components/brand/EsturedSeal";
import "./seal-intro.css";

/** Retardo de cada letra (s): «Estu» se escribe desde la R hacia la izquierda; «ed», hacia la derecha. */
const LEFT = [
  { ch: "E", t: 0.74 },
  { ch: "s", t: 0.66 },
  { ch: "t", t: 0.58 },
  { ch: "u", t: 0.5 },
];
const RIGHT = [
  { ch: "e", t: 0.5 },
  { ch: "d", t: 0.58 },
];

function Part({ d, className }: { d: string; className?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} className={className}>
      <path d={d} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

/**
 * Apertura con el sello de EstuRed (~3,9 s): la R, la palabra «EstuRed», el logo que se arma y el sello que cae sobre él.
 * Capa decorativa (`aria-hidden`; sin eventos de puntero salvo `blocking`) sobre contenido que ya está en el DOM. Solo CSS: no
 * necesita JS de cliente. Tiempos y medidas en `seal-intro.css`. Con prefers-reduced-motion se ve la versión suave (solo fundidos).
 *
 * `fixed`: a pantalla completa (preapertura). Sin `fixed` cubre su contenedor posicionado (hero de la home).
 * `blocking`: mientras se ve, la capa frena los clics, para que nadie toque sin querer el popup que está debajo. Al terminar queda
 * `visibility: hidden` y deja de frenarlos.
 */
export function SealIntro({ fixed = false, blocking = false }: { fixed?: boolean; blocking?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`seal-intro ${fixed ? "seal-intro-fixed" : ""} ${blocking ? "seal-intro-blocking" : ""} bg-gradient-to-br from-forest-ink via-forest-700 to-forest-600 text-paper`}
    >
      <div className="si-seal">
        <i className="si-impact border-2 border-paper/60" />
        <EsturedSeal size={260} tone="cream" ink={false} mark={false} className="si-stamp" />
        <EsturedSeal size={260} tone="cream" className="si-inked" />
      </div>

      <div className="si-lockup">
        <div className="si-mark">
          <div className="si-wipe">
            <div className="si-wipe-in">
              <Part d={MARK_PARTS.house} />
            </div>
          </div>
          <Part d={MARK_PARTS.bed} className="si-bed" />
          <div className="si-rfly">
            <div className="si-rpop">
              <Part d={MARK_PARTS.r} />
            </div>
          </div>
        </div>
        <div className="si-word">
          <span>
            {LEFT.map((l) => (
              <span key={l.ch} className="si-left" style={{ animationDelay: `${l.t}s` }}>
                {l.ch}
              </span>
            ))}
          </span>
          <span className="si-glyph">R</span>
          <span>
            {RIGHT.map((l) => (
              <span key={l.ch} className="si-right" style={{ animationDelay: `${l.t}s` }}>
                {l.ch}
              </span>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
