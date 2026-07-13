# Sistema Visual EstuRED — "FRESH"

Estas son las instrucciones de estilo del proyecto EstuRED. Aplicalas a **todo** elemento nuevo o existente (marketing, panel admin, modales, emails, etc.) para mantener consistencia total. Ante cualquier duda de diseño, resolvé a favor de lo que ya está definido acá — no inventes tokens, componentes ni patrones nuevos si ya existe uno equivalente.

Dirección: amigable, redondeado, cálido, ligeramente lúdico — inspirado en EdTech moderno. Nunca corporativo/frío, nunca "flat SaaS genérico".

---

## 1. Fundamentos

### 1.1 Paleta de color (usar SIEMPRE estas variables, nunca hex sueltos)

Base / neutros (cálidos, no grises puros):
```
--ink:        #1d2722   texto principal
--ink-soft:   #44524b   texto secundario / body
--muted:      #7c8a82   texto terciario, metadata, placeholders
--line:       #e8e0d2   bordes por defecto
--line-2:     #ded4c2   bordes más marcados (inputs, dividers fuertes)
--cream:      #fbf6ec   fondo base de página
--cream-2:    #f4ecdc   fondo secundario (secciones alternas, hover de filas)
--paper:      #ffffff   superficie de card/modal/tabla
```

Marca:
```
--forest:      #1f7d5c   verde bosque — color primario de acción/marca
--forest-600:  #166349   hover de forest
--forest-700:  #0f4d39   texto/ícono forest sobre fondo claro
--forest-ink:  #0c3a2c   fondos oscuros (footer, toasts, header oscuro)
--forest-tint: #e2f1ea   fondo tenue para chips/tiles forest

--orange:      #ef8551   naranja arcilla — acento, urgencia, foco de atención
--orange-600:  #e06d37   hover de orange
--orange-700:  #c4561f   texto/ícono orange sobre fondo claro
--orange-tint: #fde7da   fondo tenue para chips/tiles orange

--gold:        #e9b84b   uso puntual (destacados dorados, nunca como color base)
```

Pasteles de categoría (solo para tiles/tags decorativos, nunca para texto de botones ni CTAs primarios):
```
--peach:  #fde1d2
--butter: #fbeec3   (texto sobre butter: #9a7a14)
--mint:   #d7efe2
--lilac:  #e7e2f8   (texto sobre lilac: #5b4ea8)
--sky:    #d9ebf5   (texto sobre sky: #2d6f97)
```

Extendida (paquete admin-panel, mismo criterio de tint/700):
```
--red:       #d15c4f   / --red-600 #b8483c / --red-700 #9c392e / --red-tint #fbe5e2   → riesgo, expulsión, error
--blue-ink:  #2d6f97   / --blue-tint #e3f0f9                                           → informativo neutro
```

**Regla de uso de color:** `forest` = acción principal/positiva y marca. `orange` = urgencia, atención, alertas suaves, foco secundario. `red` = solo peligro/irreversible. Nunca usar orange y red para lo mismo. Nunca introducir un hue nuevo — si falta un matiz, derivalo con `oklch`/mezclando desde estos mismos tokens, manteniendo croma y luminosidad similares a los tints existentes.

### 1.2 Tipografía

- **Display / headings:** `'Bricolage Grotesque'` — peso 700–800, `letter-spacing: -0.02em` a `-0.035em`, `line-height` ajustado (~1.02 en `.display`). Se usa en `h1–h4` y en la clase `.display`.
- **UI / body:** `'Hanken Grotesk'` — pesos 400/500/600/700/800.
- Cargar ambas desde Google Fonts (`Bricolage+Grotesque` con `opsz,wght@12..96` y `Hanken+Grotesk:wght@400;500;600;700;800`).
- Nunca introducir una tercera familia tipográfica. Nunca usar Inter, Roboto o Arial.
- Iconos: **Material Symbols Outlined** exclusivamente (`FILL 0, wght 400, GRAD 0, opsz 24`), nunca otra librería de iconos ni SVGs dibujados a mano para iconografía UI.

Jerarquía de tamaño orientativa:
- H1 hero/marketing: `clamp(2.4rem, 5vw, 4.2rem)` aprox (ver páginas existentes)
- H1 de panel (`.dpage-head h1`): `clamp(1.5rem, 2.6vw, 2rem)`
- H3 de card: `1.05–1.24rem`
- Body: `.9–1rem`; `.lead`: `1.16rem` / `line-height 1.6` / color `--ink-soft`
- Metadata/labels: `.72–.84rem`, a menudo `font-weight: 800`, a veces `text-transform: uppercase; letter-spacing: .04–.14em` (eyebrows, table headers, section labels)

### 1.3 Espaciado, radios, sombras, motion

Radios:
```
--r-lg: 30px   (formas grandes, contenedores hero/foto)
--r-md: 22px   (cards, KPI cards, dashboard cards — el radio "default" de card)
--r-sm: 16px   (elementos internos: quick-actions, chips grandes, filas)
```
Botones y chips siempre `border-radius: 999px` (pill). Inputs/selects/tiles pequeños entre `8px` y `14px`. Nunca cuadrado a secas (0px) en ningún elemento interactivo.

Sombras (usar los tokens, no inventar `box-shadow` sueltas):
```
--shadow-sm      hover sutil, chips elevados
--shadow-md      hover de card
--shadow-lg      modales, popovers abiertos
--shadow-orange  botones/marca en naranja
--shadow-forest  botones/marca en verde
```

Motion tokens:
```
--ease:      cubic-bezier(.22,.61,.36,1)   transición estándar
--ease-out:  cubic-bezier(.16,1,.3,1)      entradas / reveals
--bounce:    cubic-bezier(.34,1.56,.64,1)  hover de botones, toggles, apertura de modal/popover — el "signature" del sistema
```
Todo elemento clicable con transform en hover/active debe usar `--bounce`. Transiciones de layout/opacidad usan `--ease` o `--ease-out`. Siempre envolver animaciones decorativas (`floaty`, `spin-slow`, `twinkle`, `blip`, `ringpulse`) en `@media (prefers-reduced-motion: reduce){ animation: none; }`.

Borde estándar de card/input/divider: `1.5px solid var(--line)` (no `1px`, no `2px` salvo botones que usan `border: 2px solid transparent` como base).

---

## 2. Componentes base

Reutilizá estas clases tal cual existen en `estured-fresh.css` / `panel/admin-panel.css`. No las reescribas con otro nombre.

### Botones (`.btn`)
- Base: `height: 56px` (desktop) / `.btn-sm` → `height: 46px`, pill (`border-radius: 999px`), `font-weight: 700`.
- Variantes: `.btn-orange` (CTA principal marketing), `.btn-forest` (acción principal de gestión/guardar), `.btn-ink` (alto contraste), `.btn-ghost` (secundario, borde `--line-2`), `.btn-paper` (terciario sobre fondo cream, `shadow-sm`).
- Hover: `translateY(-3px)` + sombra de color ampliada + el ícono interno (`.material-symbols-outlined`) se desplaza `translateX(3px)`.
- Active: `translateY(1px) scale(.98)`.
- Un ícono en un botón siempre va **antes** del texto salvo que sea una flecha de avance ("Ver más →"), que va después.

### Chips / pills / badges
- `.chip`: pill, `border: 1.5px solid var(--line)`, fondo `--paper`. Variantes de color `.chip-orange`, `.chip-green` usan el `-tint` de fondo y `-700`/`-600` de texto, sin borde.
- `.pill-badge`: badge superior con puntito animado (`.dot`, animación `blip`) — para "en vivo"/novedades puntuales, no abusar.
- `.st` (status pill del panel): `.st-ok` (forest), `.st-warn` (orange), `.st-info` (blue), `.st-risk` (red), `.st-neutral` (cream-2). Usar siempre uno de estos cinco para cualquier estado de fila/tarjeta — nunca un color de estado nuevo.
- `.dtag-sm`, `.rtag`, `.trait-chip`: micro-tags informativos, `font-size` `.62–.72rem`, `font-weight: 800`, fondo tint + texto del mismo hue.

### Cards
- `.card` / `.dcard`: `background: var(--paper); border: 1.5px solid var(--line); border-radius: var(--r-md)`.
- `.card-hover`: al hover, `translateY(-7px)` + `shadow-lg` + borde transparente; si contiene `.icon-tile`, éste rota `-6deg` y escala `1.08`.
- `.icon-tile`: cuadrado redondeado (18px radius, 60px o 44/42px en panel), fondo `tile-orange/green/butter/lilac/sky` (siempre tint + color -700/600 a juego).
- Card de énfasis con gradiente (`linear-gradient(135deg, var(--forest), var(--forest-700))`, texto blanco): reservada para 1 CTA destacado por vista, no para cards regulares.

### Inputs / formularios
- Altura estándar `44–48px` en panel, `border: 1.5px solid var(--line)`, `border-radius: 10–12px`, fondo `--cream` (no blanco puro), `outline: none`, focus → `border-color: var(--orange)` en formularios generales o `var(--forest)` en formularios de residentes/altas (ver `.af-field`). Mantené esa distinción: **orange** para foco en flujos de "contacto/marketing/config", **forest** para foco en flujos de "gestión operativa" (alta de residente, tarifas).
- Labels: `font-size: .74–.82rem; font-weight: 700–800; color: var(--ink-soft)` arriba del campo, nunca al costado.
- Toggle (`.switch`): pill 46×27, `off` = `--line-2`, `on` = `--forest`, knob blanco con `--bounce` al mover.
- Tabs de sección (`.sol-tabs`, `.hab-subnav`): la variante "underline" usa borde inferior forest de 3px en el activo; la variante "segmented pill" (`.hab-subnav`, `.hseg`) usa fondo `cream-2` contenedor + activo en `paper` con `shadow-sm`. Elegí según si son tabs de nivel superior (underline) o subtabs dentro de una vista (segmented).

### Tablas
- Header: fondo `--cream-2`, texto `--muted`, `font-weight: 800`, `font-size: .68–.74rem`, `uppercase`, `letter-spacing: .04–.05em`.
- Filas: `border-top: 1.5px solid var(--line)`, hover `background: var(--cream-2)`, primera celda en `font-weight: 800; color: var(--ink)`, resto `color: var(--ink-soft)`.
- Nunca zebra-striping; el único acento de fila es el hover y, si aplica, `.row-pending` (fondo `#fbf8ee`, sutil).

### Modales
- `.dmodal-bg`: overlay `rgba(18,30,24,.5)` + `backdrop-filter: blur(3px)`.
- `.dmodal`: `border-radius: 24px`, entra con `scale(.94) translateY(10px) → none` vía `--bounce`.
- Header con título + botón `.dmodal-close` (36×36, `border-radius: 11px`, fondo `cream-2`). Footer con acciones alineadas a la derecha, separado por `border-top: 1.5px solid var(--line)`.
- Anchos: modal estándar `max-width: 460px`; `.dmodal-wide` 900px (gestión con dos columnas `rm-left`/`rm-right`, la izquierda con fondo `cream-2`); `.dmodal-xwide` 1180px (perfiles completos, dos columnas `rp-left`/`rp-right` con la derecha en `cream-2`).

### Avatares
- Círculo `--forest` (u otro color determinístico por persona) con iniciales blancas en `font-weight: 800`. Punto online opcional (`--forest`, borde `--paper`).

### Toasts
- Fondo `--forest-ink`, texto blanco, ícono en verde claro (`#8fe0bf`), entra con `--bounce`, sale con fade+slide. Reservado para confirmaciones de acción (guardado, envío), nunca para errores destructivos (esos van en un modal o inline con `--red`).

### Progreso / datos
- Barra lineal (`.dprogress`/`.rcard-bar`): `height 7–9px`, pill, relleno `--forest` (ocupación positiva) — si hace falta un segundo estado (ej. sobreocupado), usar `--orange`, nunca ambos en la misma barra salvo segmentado explícito.
- Donut: `stroke-width` fino (~3.6), `stroke-linecap: round`, color de dato primario `--orange`, fondo `--line`.

---

## 3. Patrones de layout

### Sitio público (marketing)
- Header sticky, fondo `cream` a 86% + `backdrop-filter: blur(14px) saturate(1.2)`.
- Logo: cuadrado `forest` redondeado con marca en negativo blanco + wordmark `Estu` + `RED` en `--orange` bold.
- Secciones con `padding-block: 92px` (`.section`) alternando fondo `--cream` / `--cream-2` / `--paper` — máximo 2 fondos alternos por página, nunca más.
- Textos destacados con marcador (`.hl-orange`, `.hl-green`, `.hl-butter`): pill rotado `-1.5deg` con sombra de color; usar para 1–3 palabras clave por sección, no para frases largas.
- Reveal on scroll: `.reveal` (`opacity:0; translateY(30px)` → `.in`), con delays escalonados `.reveal-d1..d5` para grupos de elementos.

### Panel admin (dashboard interno)
- Layout: sidebar fija 260px (`--paper`, borde derecho `--line`) + columna principal con topbar (búsqueda + iconos + perfil) + `.dcontent` con padding `26px clamp(18px,3vw,40px) 60px`.
- Nav lateral: ítem activo = fondo `--orange-tint`, texto/ícono `--orange-700`; badges de conteo en `--orange` (o `#8b6ec7` para renovaciones — es el único lugar donde se usa lila fuera de tints).
- KPI cards en grid de 4 (`.dkpis`), cada card: icon-tile arriba, `h3`, 1–2 filas de dato (`.dkpi-row`, valor en `b`), CTA al pie. Nunca más de un CTA por KPI card.
- Vistas de "lista + detalle" (Solicitudes, Mensajes): columna angosta de lista (300–380px) + panel de detalle flexible, ambos dentro de un contenedor con borde y `border-radius: var(--r-md)`.
- Formularios largos (alta de residente) se agrupan en `.af-section` con heading uppercase pequeño + grid 2 columnas de campos — nunca un formulario plano sin agrupar.
- Popovers (`.dpop`, notificaciones/ayuda/perfil): 320px, mismo estilo de card, entran con `--bounce` desde arriba-derecha.

---

## 4. Tono de contenido (copy)

- Español rioplatense, trato de "vos" (nunca "tú"), directo y cálido, sin jerga corporativa.
- Los títulos de página son declarativos y breves (`"Solicitudes"`, `"Renovaciones"`); los subtítulos son una frase de contexto/acción (`"Respondé dentro de 48 hs para no perder la oportunidad."`).
- Textos de ayuda/hint (`.dkpi-hint`, placeholders) en `--muted`, tono instructivo breve, nunca más de una oración.
- Nunca emojis (el sistema no los usa en ningún lugar existente).

---

## 5. Checklist al agregar algo nuevo

1. ¿El color que estoy usando es una de las variables de la sección 1.1? Si no existe el matiz, derivalo por mezcla desde los tokens existentes, no lo saques de la nada.
2. ¿Estoy reusando un componente existente (`.btn`, `.chip`, `.card`, `.st-*`, `.dmodal`, etc.) en vez de crear uno nuevo con el mismo propósito?
3. ¿Los radios son pill (interactivos) o `--r-sm/md/lg` (contenedores)? Nunca esquinas rectas en un elemento clicable.
4. ¿El hover usa `--bounce` + `translateY` + sombra de color a juego con el fondo?
5. ¿Los bordes son `1.5px solid var(--line)` (o `--line-2` si es más marcado)?
6. ¿La tipografía usa `Bricolage Grotesque` para headings y `Hanken Grotesk` para todo el resto?
7. ¿Respeté `prefers-reduced-motion` en cualquier animación decorativa infinita?
8. ¿El copy está en vos, en español rioplatense, sin emojis?

## 6. Qué evitar

- Grises neutros puros (`#000`, `#fff`, `#888` sin matiz cálido) — todo neutro pasa por `--ink`/`--muted`/`--cream`/`--paper`.
- Gradientes decorativos genéricos fuera de los dos casos ya establecidos (card de énfasis forest, `rp-renew-card` sky→lilac).
- Sombras `box-shadow` escritas a mano fuera de los tokens `--shadow-*`.
- Bordes de 1px o 2px sólidos a secas — el sistema usa `1.5px` de forma consistente.
- Iconos fuera de Material Symbols Outlined, o SVG ilustrativos dibujados a mano.
- Una tercera tipografía, o pesos fuera de 400/500/600/700/800.
- Usar `--orange` y `--red` para representar el mismo tipo de estado (urgencia vs. peligro son cosas distintas).
