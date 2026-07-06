# VISUAL_UX_AUDIT.md

# EstuRed — Auditoría visual y UX (Ciclo 2)

**Fecha:** 2026-07-06
**Alcance:** landing pública, catálogo, ficha de residencia, componentes base, mobile.
**Referencias analizadas:** `/design-references/stitch_estured_mvp_1ra parte/` (10 pantallas Stitch).

---

## 1. Estado visual al iniciar el ciclo

La base del ciclo 0 era correcta pero rudimentaria: tokens bien definidos y copy alineado a los docs, pero con jerarquía plana, cards de residencia con poca información diferencial, hero solo-texto sin sensación de producto, navegación con labels confusos y secciones de landing sin ritmo (todas con la misma densidad y el mismo patrón de 3 cards).

## 2. Qué se sentía rudimentario

- **Hero**: solo texto + grid de cards genéricas; no mostraba el producto.
- **H1** ("La convivencia también se elige."): identitario pero no explicaba el beneficio.
- **Navbar**: "Residencias" y "Residencias asociadas" — dos labels casi iguales para cosas distintas; sin acceso a login.
- **ResidenceCard**: no comunicaba universidades cercanas, servicios ni suficiente diferenciación; el precio competía con el CTA.
- **Diferenciación vs. informalidad**: lista lineal poco escaneable.
- **Sin visión de futuro**: la landing no comunicaba la ambición de comunidad/red.

## 3. Qué ya funcionaba bien

- Paleta petróleo/arena/salvia/ámbar: distintiva, cálida, nada genérica — se conserva intacta.
- Copy legalmente prudente ("solicitud sujeta a confirmación", intermediación) — se conserva.
- StatusTag con los 4 estados oficiales de disponibilidad — se conserva y refuerza.
- Estructura responsive y tokens Tailwind v4.

## 4–8. Problemas detectados y corregidos

| Problema | Corrección |
|---|---|
| Jerarquía plana del H1 | H1 híbrido en dos tonos: "No solo elijas dónde vivir, **sino cómo**." (decisión del dueño); frase de marca movida al cierre |
| Hero sin producto | Composición de producto: ResidenceCard real + chips flotantes (comprobante verificable, solicitud registrada) con `shadow-float` |
| Labels de navegación confusos | "Buscar residencias / Para estudiantes / Para residencias" + Ingresar + CTA lista de espera |
| Card pobre en información | Universidades cercanas (icono birrete), badges de tipos, resumen de servicios (2 + contador), StatusTag sobre imagen, precio con divisor, hover con zoom sutil de foto |
| Comparación poco escaneable | Sección lado a lado "Con EstuRed" (borde petróleo, checks) vs. "Por fuera, a pulmón" (neutro, guiones) |
| Sin visión futura | Sección "Lo que se viene" en petróleo oscuro con etiqueta PRÓXIMAMENTE (señales de convivencia, reseñas verificadas, comunidad) |
| TrustBadge ilegible sobre fotos | Fondo blanco sólido + ring + sombra |
| Botón secondary poco visible en fondos oscuros | Cambiado de salvia a ámbar (acento optimista, alto contraste sobre petróleo) |
| FAQ sin affordance | Indicador "+" con rotación al abrir |
| Tipografía | Tracking -0.02em en display, `text-wrap: balance/pretty`, selección ámbar |

## 9. Referencias revisadas

10 pantallas Stitch: home, estudiantes, residencias landing, sumar residencia, 3 × búsqueda, registro, onboarding, completar perfil. **Nota:** 8 de los 10 `screen.png` están corruptos (guardaron el texto "FIFE Image failed to fetch"); el análisis se hizo sobre los `code.html` completos + los 2 PNG válidos. Si se re-exportan desde Stitch, reponer los PNG.

## 10. Aprendizajes tomados de las referencias

- Copy con gancho: "No solo elijas dónde vivir, sino cómo", "La incertidumbre termina acá", "Tu residencia llena, pero tu tiempo no debería estarlo" (aplicado en for-residences), "Explorá opciones con contexto real", "Una solución para cada uno".
- Badge de etapa/expansión en el hero ("Primera etapa… Próximamente Latinoamérica").
- Comparación explícita "por EstuRed vs. por fuera" como sección propia.
- Sección de roadmap/futuro para comunicar visión.
- Eje "cerca de tu universidad" en cards y copy (decisión del dueño: solo comunicación, el filtro por universidad no es MVP).
- Firma humana en footer ("Hecho con ♥ en Buenos Aires").

## 11. Qué NO se copió (y por qué)

- **Paleta azul #2b8cee + grises fríos**: SaaS genérico; nuestra paleta es más distintiva y cálida.
- **"Tu reserva queda garantizada" / "lugar bloqueado oficialmente"**: contradice docs/08 §4.1 (nunca prometer disponibilidad/garantía).
- **"Mediación gratuita"**: terminología prohibida; es "Soporte y Resolución de Conflictos" (docs/00).
- **"Validar WhatsApp" en onboarding**: no existe integración de WhatsApp por API (prohibida en MVP).
- **Señales de convivencia como feature actual**: está fuera del MVP → se comunica solo como "Próximamente".
- **Marca "EstuRED"**: el dueño confirmó "EstuRed" (como los docs).
- **Emojis en headings** y Material Icons: se mantienen SVG propios, más sobrios.

## 12. Verificación responsive

Verificado en preview a 1280px y 375px: hero apilado con CTAs full-width tocables, chips flotantes ocultos en mobile (`sm:block`), cards limpias de una columna, menú hamburguesa con CTA. Un fix aplicado tras la verificación: el chip de comprobante tapaba el sello de verificación → compactado (`max-w-[240px]`).

## 13. Pendientes visuales para próximos ciclos

1. Fotos reales o placeholders curados (picsum da imágenes incoherentes — ej. una playa para San Telmo).
2. Logo real (hoy: monograma "E" tipográfico).
3. Modal de tipo de cambio obligatorio (docs/08 §2.8) al integrar `ExchangeRateProvider`.
4. Página `/search`: vista mapa (referencia Stitch la sugiere; evaluar para fase de catálogo real).
5. Dark mode: no priorizado (las referencias lo incluyen; no es requisito de docs).

**Validación del ciclo:** typecheck ✅ · lint ✅ (fix: ignorar `next-env.d.ts` autogenerado) · build ✅ (18 páginas).
