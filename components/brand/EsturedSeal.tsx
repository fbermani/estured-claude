import { useId } from "react";
import { MARK_PATHS, MARK_VIEWBOX } from "@/lib/brand/markPath";
import "./seal.css";

/**
 * «Sello de EstuRed»: el logo (casa + R + cama) dentro de un sello de tinta antiguo con la palabra «Verificada». Marca a las residencias
 * que el equipo visitó en persona (TrustBadge / docs/00 §7). Es un solo trazo de tinta (`currentColor`): `tone="forest"` sobre fondos
 * claros, `tone="cream"` sobre oscuros. La textura gastada es un filtro SVG (sin imágenes).
 *
 * - `variant="full"`: anillos, «ESTURED» arriba, banda «VERIFICADA» y «BUENOS AIRES» abajo. Para tamaños desde ~96 px.
 * - `variant="mini"`: anillos + logo, sin texto, para tarjetas (~40 px), donde el texto no se leería.
 * - `onLight`: para superficies claras (tarjetas `paper`). Solo en `full`: la banda se rellena de tinta y «VERIFICADA» queda calada en
 *   `paper`, como en el sello físico. Sin `onLight` (hero, imagen OG, landing) el dibujo no cambia.
 *
 * Decorativo: `aria-hidden`. El significado ya está en el texto de al lado («Residencia Verificada»).
 * `stamp`: el sello «cae» con un golpe (una vez, solo transform/opacity; con prefers-reduced-motion queda quieto).
 */
export function EsturedSeal({
  size = 120,
  variant = "full",
  tone = "forest",
  stamp = false,
  onLight = false,
  className = "",
}: {
  size?: number;
  variant?: "full" | "mini";
  tone?: "forest" | "cream";
  stamp?: boolean;
  onLight?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const filterId = `seal-ink-${uid}`;
  const topId = `seal-top-${uid}`;
  const bottomId = `seal-bottom-${uid}`;
  const full = variant === "full";
  const color = tone === "cream" ? "text-paper" : "text-forest-700";

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${color} ${stamp ? "seal-stamp" : ""} ${className}`}
    >
      <defs>
        {/* Tinta gastada: bordes levemente irregulares y pequeñas faltas de tinta (ruido umbralizado). */}
        <filter id={filterId} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="3" result="wobbly" />
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="9" result="grain" />
          <feColorMatrix
            in="grain"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.9"
            result="holes"
          />
          <feComposite in="wobbly" in2="holes" operator="in" />
        </filter>
        <path id={topId} d="M 36 100 A 64 64 0 0 1 164 100" />
        <path id={bottomId} d="M 25 100 A 75 75 0 0 0 175 100" />
      </defs>

      <g filter={`url(#${filterId})`} fill="currentColor" transform="rotate(-10 100 100)">
        <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth={full ? 5 : 8} />
        <circle cx="100" cy="100" r={full ? 87 : 84} fill="none" stroke="currentColor" strokeWidth={full ? 1.6 : 3} />

        {full ? (
          <>
            <circle cx="100" cy="100" r="79" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <text
              fontFamily="var(--font-display), sans-serif"
              fontWeight="800"
              fontSize="15"
              letterSpacing="5"
              textAnchor="middle"
            >
              <textPath href={`#${topId}`} startOffset="50%">
                ESTURED
              </textPath>
            </text>
            <text
              fontFamily="var(--font-display), sans-serif"
              fontWeight="800"
              fontSize="11"
              letterSpacing="2.2"
              textAnchor="middle"
            >
              <textPath href={`#${bottomId}`} startOffset="50%">
                BUENOS AIRES
              </textPath>
            </text>
            <path d="M 25 100 l 2.6 5.4 5.9 .8 -4.3 4.1 1 5.8 -5.2 -2.8 -5.2 2.8 1 -5.8 -4.3 -4.1 5.9 -.8z" transform="translate(2 -9)" />
            <path d="M 25 100 l 2.6 5.4 5.9 .8 -4.3 4.1 1 5.8 -5.2 -2.8 -5.2 2.8 1 -5.8 -4.3 -4.1 5.9 -.8z" transform="translate(140 -9)" />

            <svg x="75" y="42" width="50" height="51.2" viewBox={MARK_VIEWBOX}>
              {MARK_PATHS.map((p) => (
                <path key={p.fill} d={p.d} fill="currentColor" fillRule="evenodd" />
              ))}
            </svg>
            <rect x="52" y="104" width="96" height="28" rx="3" fill={onLight ? "currentColor" : "none"} stroke="currentColor" strokeWidth="3.4" />
            <text
              x="100"
              y="125"
              fontFamily="var(--font-display), sans-serif"
              fontWeight="800"
              fontSize="19"
              textAnchor="middle"
              textLength="84"
              lengthAdjust="spacingAndGlyphs"
              style={onLight ? { fill: "var(--color-paper)" } : undefined}
            >
              VERIFICADA
            </text>
          </>
        ) : (
          <svg x="48" y="46" width="104" height="106.4" viewBox={MARK_VIEWBOX}>
            {MARK_PATHS.map((p) => (
              <path key={p.fill} d={p.d} fill="currentColor" fillRule="evenodd" />
            ))}
          </svg>
        )}
      </g>
    </svg>
  );
}
