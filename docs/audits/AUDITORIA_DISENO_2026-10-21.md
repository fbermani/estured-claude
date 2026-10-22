# Auditoría de diseño y UX — EstuRed

**Fecha:** 2026-10-21 · **Alcance:** todo el front (público, estudiante, familiar, residencia owner, admin operativo), desktop 1280 y mobile 375 · **Estado auditado:** `main` en `62b9871` + working tree del 2026-10-21 · **Agente:** `disenador`.

**Complementa** la auditoría funcional `docs/audits/AUDITORIA_2026-10-20.md` (hallazgos `H01`–`H32`). Acá no se repiten los hallazgos funcionales. Cuando un problema de diseño ya está ahí, se lo referencia por su ID y solo se agrega la parte visual.

**Método.**
- Capturas full-page con Chrome headless, como invitado y con los usuarios demo del widget "Simular usuario": Lucía, Camila, Valentina, Martín, Ricardo y Admin operativo.
- Solo navegación. No se ejecutó ninguna acción que mute datos.
- Comparación pantalla por pantalla contra `design-references/` (Stitch 1ra a 6ta parte y `fresh-style.md`).
- Inspección del DOM computado en el navegador: fuentes y estados de foco.
- Cálculo de contraste WCAG sobre los tokens reales de `app/globals.css`.
- Lectura puntual de `components/ui/*`, `app/layout.tsx` y `components/admin/ui/*`.

**Evidencia:** `docs/audits/assets/diseno/` (29 capturas con nombre descriptivo, citadas como `[cap: nombre]`).

**Leyenda:**
- **[Obj]** es objetivo y medible: contraste, bug visual, inconsistencia verificable.
- **[Op]** es opinión de diseño fundamentada.
- Severidad: crítico / alto / medio / bajo.
- Agentes: `disenador` propone y especifica, `interfaz` implementa, `constructor` cuando hace falta lógica, `dueño` cuando se necesita una decisión.

> **Nota previa sobre las instrucciones de diseño.** El prompt del agente `disenador` (y parte de `CLAUDE.md`) todavía describe la paleta `petrol/sage/sand/amber-soft` y las fuentes Manrope + Inter. El sistema vigente es **FRESH**: `forest/orange/cream`, Bricolage Grotesque + Hanken Grotesk e íconos Material Symbols (ver `app/globals.css` y `design-references/fresh-style.md`). Esta auditoría evalúa contra FRESH. Conviene que `documentador` actualice esas instrucciones (D44).

---

## 1. Resumen ejecutivo

La base es buena. La paleta cálida es propia, el tono en voseo es consistente y el copy es prudente. Algunas pantallas ya se sienten de producto real: Habitaciones de la residencia, el detalle de solicitud con su línea de tiempo y el formulario de solicitud con desglose. Pero hoy **EstuRed no se ve como el producto que su sistema de diseño describe**, por tres razones:

- **La tipografía de marca no se está cargando.** Todo el sitio se ve en la fuente del sistema.
- **No hay estrategia de imagen.** Sin fotos, el catálogo, la ficha y los paneles muestran bloques beige vacíos y el producto parece "en construcción".
- **Varios colores base no pasan contraste AA**, empezando por el CTA naranja.

Además, la semántica de color de los estados está gastada: el naranja significa a la vez urgencia, "en curso", "ya renovaste" y "salida programada". Los cuatro roles usan tres "cáscaras" distintas: la sidebar del estudiante, la del admin con otro sistema de componentes, y un dashboard de owner con footer de marketing. La ficha de residencia y el comprobante, las dos pantallas donde se gana o se pierde la confianza, son las de menor fidelidad respecto de la referencia.

**Los 5 cambios de mayor impacto:**

1. **Que cargue la tipografía de marca (D01, crítico, esfuerzo S).** `h1` y `body` se computan como `ui-sans-serif, system-ui` y Bricolage/Hanken nunca se descargan. Es un fix de una línea y es el cambio individual que más identidad devuelve.
2. **Una estrategia de imagen con placeholders de marca (D12, crítico, M).** Hace falta un estado sin foto digno (ilustración o patrón por barrio, hero compacto) y una regla operativa de mínimo 3 fotos propias para publicar. Afecta a la landing, el catálogo, la ficha, el inicio del estudiante y el dashboard del owner.
3. **Contraste AA en los tokens (D02–D05, alto, S).**
   - El CTA naranja con texto blanco da 2,58:1.
   - El texto `muted`/`ink-faint` da 3,35:1 y tiene unos 276 usos, incluidos los descargos legales.
   - Los badges naranja dan 3,75:1.
   - El borde de los inputs da 1,36:1.
   - Se corrige con tres o cuatro valores de token y el arreglo se propaga solo.
4. **Rediseñar la ficha de residencia (D17–D20, alto, L).** Hoy tiene:
   - un hero vacío de 380 px;
   - ningún precio visible para el invitado en desktop;
   - un mapa de camas de unos 1.800 px con tres niveles de anidación;
   - un "mapa" abstracto de 650 px;
   - un panel de solicitud cuyo botón de envío queda cortado.

   Es la página que convierte.
5. **Un mapa único de tono por estado y una sola cáscara de panel (D06, D22–D25, D32, D08; alto, M).**
   - Los tonos: forest para hecho, azul info para "esperando a otro", naranja solo para "requiere tu acción" y rojo para peligro.
   - La cáscara: misma sidebar, topbar con identidad, anchos de contenido y componentes para estudiante, familiar, residencia y admin.

**Conteo de hallazgos:** 44 en total. 2 críticos, 11 altos, 22 medios y 9 bajos.

---

## 2. Hallazgos

Formato: **ID · Título** — severidad · [Obj/Op] · ruta · agente · esfuerzo.

### A. Fundamentos del sistema (transversal)

#### D01 · La tipografía de marca no se aplica en ninguna pantalla
- **Severidad:** crítico · **[Obj]** · **Rutas:** todas · **Agente:** `interfaz` · **Esfuerzo:** S
- **Evidencia:**
  - En `/` y en `/login`, `getComputedStyle(h1).fontFamily` y el `fontFamily` de `body` devuelven `ui-sans-serif, system-ui, sans-serif…`.
  - `document.fonts.check('700 40px "Bricolage Grotesque"')` devuelve `false`. La única fuente cargada es Material Symbols.
  - Se ve en todas las capturas: los títulos son SF/Segoe, no Bricolage.
- **Causa:**
  - `app/layout.tsx` pone las variables de `next/font` (`--font-hanken`, `--font-bricolage`) en `<body>`.
  - `@theme` declara `--font-sans: var(--font-hanken)…` en `:root`, donde esas variables no existen.
  - Entonces `--font-sans` y `--font-display` quedan inválidas y `body` hereda la fuente por defecto de Tailwind.
- **Por qué importa:** la tipografía es la mitad de la personalidad del sistema FRESH. Bricolage es lo que lo separa de un "SaaS genérico". Hoy toda la app se ve como cualquier template de Tailwind, que es justo lo que la marca quiere evitar.
- **Recomendación:** mover `${hanken.variable} ${bricolage.variable}` al `className` de `<html>` en `app/layout.tsx`. La alternativa es declarar el bloque como `@theme inline`, pero eso toca `globals.css`, que es un archivo sensible. Después del fix hay que revisar los tamaños y el interlineado de los H1 y H2, porque Bricolage es más ancha que la fuente del sistema, y volver a capturar las pantallas clave.

#### D02 · El CTA naranja no pasa contraste
- **Severidad:** alto · **[Obj]** · **Rutas:** `/for-residences` (hero y CTA), toda variante `Button variant="secondary"` · **Agente:** `disenador` → `interfaz` · **Esfuerzo:** S
- **Evidencia:** blanco sobre `orange` #ef8551 da **2,58:1**; sobre `orange-600` (hover) da 3,28:1. No llega ni al 3:1 de texto grande. [cap: para-residencias-chips-tapan-boton_1280]
- **Recomendación:** hay dos opciones y la elige el dueño (afecta la marca).
  - **(a)** Texto `ink` sobre naranja, que da **5,96:1** y mantiene el naranja vivo. Es la recomendada.
  - **(b)** Fondo `orange-700` #c4561f con texto blanco, que da 4,47:1 y solo vale para botones `lg` (≥18,66 px en bold).

#### D03 · El texto terciario (`muted`/`ink-faint`) no pasa AA y se usa en textos que importan
- **Severidad:** alto · **[Obj]** · **Rutas:** todas · **Agente:** `interfaz` (token) · **Esfuerzo:** S
- **Evidencia:**
  - `#7c8a82` da 3,35:1 sobre `cream`, 3,61:1 sobre `paper` y 3,07:1 sobre `cream-2`.
  - Tiene unos 276 usos en `app/` y `components/`: metadata, ayudas de formulario, "≈ ARS … referencial", el descargo "La disponibilidad publicada es informativa…" del hero, "Enviar una solicitud no garantiza tu lugar" en la ficha y el pie legal.
  - Además hay 71 usos de `text-[9px]`/`[10px]`/`[11px]`, que agravan el problema.
- **Por qué importa:** los descargos que protegen al usuario y a EstuRed son, justamente, los textos menos legibles.
- **Recomendación:** oscurecer `--color-muted` y `--color-ink-faint` a **#5f6c65**, que da 5,1:1 sobre `cream` y 4,68:1 sobre `cream-2`. Prohibir texto por debajo de 12 px. Es un cambio en `globals.css` (archivo sensible): lo decide el dueño.

#### D04 · Badges y avisos naranja o butter con texto de bajo contraste
- **Severidad:** medio · **[Obj]** · **Rutas:** `Badge tone="amber"`, banners naranja (menor de edad, "Necesitan tu acción"), `butter-fg` · **Agente:** `interfaz` · **Esfuerzo:** S
- **Evidencia:** `orange-700` sobre `orange-tint` da 3,75:1, y en badges `text-xs`. `butter-fg` sobre `butter` da 3,51:1. [cap: inicio-estudiante-menor-launcher_1280]
- **Recomendación:** un token de texto `orange-800` ≈ #a3461a (5,11:1 sobre el tint) y `butter-fg` ≈ #7a5f0c (5,22:1). Los dos son tokens nuevos y se justifican solo por accesibilidad.

#### D05 · Los campos de formulario casi no se ven
- **Severidad:** alto · **[Obj]** · **Rutas:** `/register/student`, `/login`, perfiles, disponibilidad · **Agente:** `interfaz` · **Esfuerzo:** S
- **Evidencia:** el borde `line-2` #ded4c2 sobre `cream` da 1,36:1. WCAG 1.4.11 pide 3:1 para el contorno que identifica un control. Además el input usa fondo `cream` dentro de una card `paper`, así que el contraste lo hace casi solo el tono del relleno. [cap: registro-estudiante-formulario_1280]
- **Recomendación:** un borde de input propio (`--color-field-border` ≈ #9b8f78, 3,18:1 sobre `paper`), fondo `paper` dentro de las cards y foco con `border-forest` más un anillo `forest-tint` de 3 px. El foco ya existe en `Input.tsx`; conviene engrosarlo.

#### D06 · La semántica de color de los estados está gastada
- **Severidad:** alto · **[Obj]/[Op]** · **Rutas:** solicitudes (estudiante, residencia, admin), panel de residencia, ficha, Mi residencia · **Agente:** `disenador` (mapa) → `interfaz` · **Esfuerzo:** M
- **Evidencia:**
  - El **naranja** aparece en cosas muy distintas:
    - estados en curso que no requieren acción del usuario ("En revisión", "Fee en validación", "Reserva — fee pendiente");
    - un logro ("Ya renovaste tu estadía", banner durazno en Mi residencia);
    - eventos normales (los 7 egresos del panel con ícono naranja);
    - disponibilidad ("1 cama libre" en naranja y "2 camas libres" en verde, en la misma ficha).
  - El **verde** se usa igual para "Contacto establecido" (en curso) y "Reserva confirmada" (final).
  - Evidencia en [cap: solicitudes-estudiante-colores-estado_1280], [cap: panel-residencia_1280] y [cap: ficha-mapa-de-camas-denso_1280].
- **Por qué importa:** si todo es urgente, nada lo es. El estudiante no puede distinguir de un vistazo "tengo que hacer algo" de "estoy esperando".
- **Recomendación:** un helper único `statusTone(estado)` con cinco tonos (los `.st-*` de FRESH):
  - `forest` para logrado o final positivo;
  - `info` (azul) para "en curso, esperando a la otra parte";
  - `orange` solo para "requiere tu acción" o "vence pronto";
  - `red` para peligro o pérdida;
  - `neutral` para cerrado o histórico.

  El tono depende del rol que mira: "En revisión" es `info` para el estudiante y `orange` para la residencia. Siempre va con texto e ícono, nunca solo color. El copy oficial no cambia. Complementa H01.

#### D07 · Escala de tipografía y radios con valores sueltos
- **Severidad:** bajo · **[Obj]** · **Rutas:** paneles · **Agente:** `interfaz` · **Esfuerzo:** S
- **Evidencia:**
  - En tipografía hay `text-[9px]` ×4, `[10px]` ×27, `[11px]` ×40 y `[28px]` ×20.
  - En radios hay `rounded-[11px]`, `[9px]`, `[12px]`, `[14px]`, `[22px]`, `rounded-lg`, `rounded-xl`, `rounded-2xl` y `rounded-sm` (unos 35 usos fuera de la escala `sm/md/lg/field/full`).
- **Recomendación:** una escala tipográfica nombrada (`text-meta` 12, `text-label` 13, `text-body` 15, `text-lead` 18) y lint visual en las revisiones.

#### D08 · El admin tiene un segundo sistema de componentes
- **Severidad:** medio · **[Obj]** · **Rutas:** `/admin/*` · **Agente:** `interfaz` · **Esfuerzo:** M
- **Evidencia:**
  - Hay tokens JS (`components/admin/ui/tokens.ts`) consumidos con `style={{}}` en 16 páginas, y componentes propios `AdminButton`/`AdminBadge`/`AdminCard`.
  - Diferencias visibles:
    - los botones no son pill ("Revisar validaciones →");
    - los badges van en MAYÚSCULAS y en mobile se parten en tres líneas;
    - los íconos de la sidebar son de unos 16 px (contra 24 px en los otros roles);
    - los divisores de "Actividad reciente" son oscuros;
    - el subtítulo "SYSTEM CONTROLLER" está en inglés.
  - Evidencia en [cap: admin-dashboard_1280] y [cap: admin-solicitudes-badges-mobile_375].
- **Recomendación:** migrar el admin a `Button`/`Badge`/`Card`/`StatusTag` y a clases Tailwind. Mantener la densidad (tablas compactas), no la estética aparte. Cambiar "SYSTEM CONTROLLER" por "Panel operativo".

#### D09 · Controles nativos sin estilo, algunos en inglés
- **Severidad:** medio · **[Obj]** · **Rutas:** `/students/profile`, `/residence/[id]/profile`, `/register/student`, disponibilidad, formulario de solicitud · **Agente:** `interfaz` · **Esfuerzo:** M
- **Evidencia:** `<input type=file>` muestra "Choose File / No file chosen" porque toma el idioma del navegador. Los checkboxes, los selects y los date pickers (`dd/mm/yyyy`) son los nativos. [cap: perfil-estudiante-input-archivo-nativo_1280], [cap: perfil-residencia-espaciado-labels_1280]
- **Recomendación:**
  - Un `FileField` con zona de arrastre, nombre del archivo, estado subido o error y copy "Elegí un archivo".
  - Un `Checkbox` con estilo de marca y área táctil de 44 px.
  - Usar el `.switch` de FRESH para opt-ins como "Quiero aparecer en la comunidad".
  - Unificar el chevron de los `Select`.

#### D10 · El hero de la landing arranca invisible
- **Severidad:** medio · **[Obj]** · **Ruta:** `/` · **Agente:** `interfaz` · **Esfuerzo:** S
- **Evidencia:** el hero está dentro de `<Reveal>` (`app/(public)/page.tsx:199` y `:230`), que lo deja en `opacity:0` hasta que actúa el `IntersectionObserver`. En la primera captura del pane el hero estaba vacío. Sin JS, o si la hidratación es lenta, el primer pantallazo queda en blanco y el LCP empeora.
- **Recomendación:** no usar el reveal en contenido above the fold. Reservarlo para las secciones siguientes.

#### D11 · No hay estados de carga ni de error de marca
- **Severidad:** medio · **[Obj]** · **Rutas:** todo el panel · **Agente:** `interfaz` · **Esfuerzo:** M
- **Evidencia:**
  - Existe un solo `loading.tsx` (`/students/dashboard`) y ningún `error.tsx` en `app/`. Un error de render muestra la pantalla de Next en inglés.
  - No hay un sistema de toasts para confirmar acciones ("Guardado"), aunque FRESH lo define (§2 "Toasts").
  - El 404 con marca sí existe y está bien [cap no incluida].
- **Recomendación:**
  - `loading.tsx` con skeletons por área (lista, detalle, dashboard).
  - `error.tsx` con marca en `students`, `residence` y `admin`, con "Reintentar" y "Ir a Soporte".
  - Un componente `Toast` (`forest-ink`) para confirmaciones.

### B. Imagen y primera impresión

#### D12 · No hay estrategia de imagen: los placeholders vacíos dominan las pantallas
- **Severidad:** crítico · **[Obj]** (lo que se ve) **+ [Op]** (la dirección) · **Rutas:** card del hero `/`, hero de `/for-students`, cards de `/search` y de la landing, hero de la ficha, card de estadía en `/students/dashboard`, `/residence/dashboard`, vista previa de `/residence/[id]/profile` · **Agente:** `disenador` → `interfaz`, y `dueño` para fotos y operación · **Esfuerzo:** M
- **Evidencia:**
  - Bloques beige planos con un ícono `apartment` de unos 16 px:
    - 190 px en cada card;
    - 380 px en el hero de la ficha;
    - 290 px en el inicio de Lucía (390 px en mobile);
    - un gradiente gris-verde de 620 px en `/for-students`.
  - Evidencia en [cap: landing-hero-card-sin-foto_1280], [cap: para-estudiantes-placeholder-y-cta-partido_1280], [cap: catalogo-cards-sin-foto_1280], [cap: ficha-placeholder-sin-precio-invitado_1280] y [cap: inicio-estudiante-alojada_375].
  - Las referencias Stitch se apoyan en fotografía (search_results, mi_residencia con mosaico, favoritos). Por eso el layout copiado "con hueco" se ve roto.
- **Por qué importa:** una familia que entra a ver dónde va a vivir su hijo y encuentra cajas vacías concluye que no hay nada o que es una estafa. Es el opuesto exacto de "confianza".
- **Recomendación:**
  1. **Un placeholder de marca, no un vacío.** Un componente `ResidenceCover` con estado sin foto: fondo derivado de un tint (mint, butter o sky según el barrio), patrón o ilustración lineal de fachada porteña, monograma de la residencia y barrio en Bricolage. Tiene que leerse como una decisión, no como un error.
  2. **Un hero que se adapta.** Sin fotos, la ficha no reserva 380 px: el título, el sello y los datos clave suben y el hero se vuelve una banda de unos 120 px. Con una o dos fotos, una foto grande. Con tres o más, un mosaico 1+4 como en la referencia mi_residencia.
  3. **Regla operativa (dueño).** Exigir al menos 3 fotos propias para publicar. Hoy es solo una "Sugerencia" en la Fortaleza del perfil. Agregar una guía de fotos para residencias (luz natural, ambientes comunes, una por tipo de habitación).
  4. **No usar** las imágenes de `design-references/Fotos Residencias/`: son fotos de terceros scrapeadas de sitios de otras residencias, con riesgo legal (ver H27, marca de agua BA-H).
  5. **Imagen para las landings:** fotografía propia (sesión en una residencia piloto) o ilustración editorial de la vida en residencia (cocina compartida, estudio, mate). Hasta tenerla, el hero puede mostrar el producto real (card y comprobante) sin el slot de foto.

#### D13 · La landing se lee como template
- **Severidad:** medio · **[Op]** · **Ruta:** `/` · **Agente:** `disenador` · **Esfuerzo:** L (rediseño)
- **Evidencia:**
  - Siete secciones con el mismo patrón: eyebrow, H2 centrado, subtítulo centrado y grilla de cards.
  - La grilla de catálogo es de 3 columnas con 2 cards, así que queda un hueco a la derecha.
  - El componente "El problema / Cómo lo resuelve EstuRed", con 130 px vacíos arriba, se repite casi igual en `/`, `/for-students` y `/for-residences`.
  - Faltan pruebas concretas del diferencial. "Verificada presencialmente" no se muestra (qué se chequea, cómo es la visita) y el comprobante aparece solo como chip.
  - Evidencia en [cap: landing-hero-card-sin-foto_1280].
- **Recomendación:**
  - Romper el ritmo: un hero con imagen o producto, una sección "Así verificamos" con el checklist visual real (identidad, dirección, fotos) y la fecha de visita, y el comprobante como objeto con QR y descargo.
  - "Comunidad" con avatares de iniciales, sin datos falsos.
  - Centrar el catálogo cuando hay menos de 3 cards.
  - Alternar alineaciones (izquierda/derecha) en lugar de todo centrado.
  - Ver §6.

#### D14 · `/for-students`: CTAs partidos y copy de pre-lanzamiento
- **Severidad:** medio · **[Obj]** · **Ruta:** `/for-students` · **Agente:** `interfaz` · **Esfuerzo:** S
- **Evidencia:**
  - En 1280 px, "Buscar residencia en / CABA" y "Crear cuenta de / estudiante" se parten en dos líneas dentro del pill.
  - El cierre dice "Sumate a la lista de espera y te avisamos cuando el catálogo de tu zona esté activo", pero los botones son "Buscar residencia / Crear cuenta".
  - Evidencia en [cap: para-estudiantes-placeholder-y-cta-partido_1280].
- **Recomendación:**
  - `whitespace-nowrap` en `Button` y CTAs más cortos ("Buscar en CABA", "Crear mi cuenta").
  - Cierre con copy coherente: "Empezá a buscar con respaldo. Comparar es gratis; enviar una solicitud, también."

#### D15 · `/for-residences`: los chips flotantes tapan el botón del mock
- **Severidad:** bajo · **[Obj]** · **Ruta:** `/for-residences` · **Agente:** `interfaz` · **Esfuerzo:** S
- **Evidencia:** el chip "Lista de espera automática" cubre el botón "Aceptar" de la tarjeta "Solicitud nueva". [cap: para-residencias-chips-tapan-boton_1280]
- **Recomendación:** reubicar los chips en las esquinas libres. En la tarjeta del mock, mostrar "Establecer contacto", que es la acción real del inbox, en lugar de "Aceptar".

#### D16 · Footer sin marca ni contacto, con "links" que no son links
- **Severidad:** bajo · **[Obj]** · **Rutas:** públicas y `/residence/dashboard` · **Agente:** `interfaz` · **Esfuerzo:** S
- **Evidencia:** la columna "Confianza" lista tres frases con estilo de link que no navegan. El wordmark va sin isotipo. No hay email de contacto ni términos (H13).
- **Recomendación:** convertir "Confianza" en links reales (verificar un comprobante, cómo verificamos, privacidad, términos), sumar el isotipo y un email de contacto.

### C. Catálogo y ficha de residencia

#### D17 · Ficha: el invitado no ve precio en desktop, pero sí en mobile
- **Severidad:** alto · **[Obj]** · **Ruta:** `/residencias/[slug]` · **Agente:** `disenador` → `interfaz` · **Esfuerzo:** M · **Complementa:** H10
- **Evidencia:** en desktop, el panel lateral del invitado solo dice "Necesitás una cuenta de estudiante…" con "Iniciar sesión / Crear cuenta". En 375 px, la barra fija sí muestra "Desde USD 160 /mes · Solicitar". [cap: ficha-placeholder-sin-precio-invitado_1280]
- **Recomendación:** el panel lateral debe ser siempre una **card de precio y condiciones**, con:
  - "Desde USD X/mes", ARS referencial redondeado con `ExchangeRateNote`;
  - `StatusTag` por tipo;
  - estadía mínima, depósito y matrícula;
  - CTA "Solicitar" (que lleva al login si no hay sesión) y el descargo.

  El formulario aparece recién después de elegir el tipo. Esto unifica desktop y mobile.

#### D18 · Ficha: la sección "Comunidad y disponibilidad" aplasta la página y expone un estado interno
- **Severidad:** alto · **[Obj]** · **Rutas:** `/residencias/[slug]#disponibilidad`, `/students/residency` · **Agente:** `disenador` → `interfaz` · **Esfuerzo:** M · **Complementa:** H03
- **Evidencia:**
  - Cuatro niveles anidados (sección › tipo › habitación › persona) ocupan unos 1.800 px en Norte.
  - Las columnas son tan angostas que los rótulos se parten ("Habitación / 9", "Ingeniería / Industrial").
  - Hay un acordeón por persona.
  - El invitado ve "Plaza ocupada — Residente pendiente de activar cuenta", un estado técnico.
  - En Mi residencia, la bandera tapa la inicial del avatar.
  - Evidencia en [cap: ficha-mapa-de-camas-denso_1280] y [cap: mi-residencia-banderas-tapan-iniciales_1280].
- **Recomendación:**
  - En la ficha, un **resumen por tipo**: fila con `StatusTag`, "x de y plazas ocupadas", una pila de 4 avatares más "+n" y el link "Ver comunidad" a la página `/comunidad`, que ya existe.
  - El mapa de camas completo va colapsado o en esa página.
  - "Plaza ocupada", sin el motivo.
  - Bandera abajo a la derecha del avatar, fuera del glifo (avatar de 40 px y bandera de 14 px con anillo).

#### D19 · Ficha: el "mapa" de ubicación parece roto
- **Severidad:** medio · **[Obj]** · **Ruta:** `/residencias/[slug]` (`CompactMap`) · **Agente:** `disenador` → `interfaz` · **Esfuerzo:** S–M
- **Evidencia:** un rectángulo beige de unos 650 px de alto, sin calles, con tres círculos unidos por líneas punteadas. [cap: ficha-mapa-abstracto_1280]
- **Recomendación:** un mapa estático real del barrio con un círculo de zona aproximada (la dirección exacta se sigue ocultando). Si se mantiene el abstracto, que tenga menos de 220 px de alto, con el contorno del barrio y la lista de distancias como protagonista.

#### D20 · Ficha logueada: el botón de enviar la solicitud queda cortado
- **Severidad:** alto · **[Obj]** · **Ruta:** `/residencias/[slug]` como estudiante · **Agente:** `interfaz` · **Esfuerzo:** S
- **Evidencia:** el panel "Tu solicitud de reserva" es sticky con scroll interno. En 1280×860, el checkbox "Leí y acepto…" aparece cortado por el borde del card y el botón de envío no se ve sin scrollear dentro del panel (captura de Lucía en la ficha de Norte).
- **Por qué importa:** es el paso de conversión principal y el usuario no ve cómo terminarlo.
- **Recomendación:** sacar el scroll interno. El panel se vuelve sticky solo en su resumen (precio y CTA) y el formulario se despliega en el flujo normal o en un drawer. Como alternativa, un footer fijo dentro del panel con el CTA siempre visible.

#### D21 · Catálogo: buena fidelidad, faltan orden y densidad
- **Severidad:** bajo · **[Obj]** · **Ruta:** `/search` · **Agente:** `interfaz` · **Esfuerzo:** S
- **Evidencia:** respecto de la referencia search_results faltan el orden ("Recomendados") y la vista mapa. Sin foto, cada card dedica 190 px a un bloque vacío (D12). En mobile, los filtros colapsados funcionan bien. [cap: catalogo_375]
- **Recomendación:** agregar orden (precio y disponibilidad). El mapa queda para una fase posterior.

### D. Paneles estudiante y familiar

#### D22 · El panel no dice quién sos
- **Severidad:** medio · **[Obj]** · **Rutas:** `/students/*`, `/residence/*`, `/admin/*` · **Agente:** `interfaz` · **Esfuerzo:** S
- **Evidencia:** no hay topbar. El usuario aparece solo como email en el pie de la sidebar ("lucia.fernandez@example.com"). En `/residence/dashboard` se ve el email del owner en la topbar. Las referencias Stitch muestran nombre, rol y avatar arriba a la derecha.
- **Recomendación:** un bloque de identidad (avatar de iniciales, nombre de pila, rol: "Estudiante", "Familiar de Lucía", "Owner · Residencia Norte") arriba de la sidebar o en una topbar. El email va solo en el menú de cuenta.

#### D23 · La navegación del estudiante cambia de orden y de nombre según el estado
- **Severidad:** medio · **[Obj]** · **Ruta:** sidebar `/students/*` · **Agente:** `interfaz` · **Esfuerzo:** S
- **Evidencia:**
  - Lucía ve: Inicio, Mi residencia, Renovaciones, Mis solicitudes, Mi perfil, Favoritos, Lista de espera, Soporte.
  - Valentina ve: Inicio, Buscar residencias, Favoritos, Mis solicitudes, Lista de espera, Mi perfil, **Mi estadía**, Soporte.
  - Martín ve "Mi estadía".
  - Evidencia en [cap: inicio-estudiante-alojada_1280] y [cap: inicio-estudiante-menor-launcher_1280].
- **Recomendación:** un orden fijo, con los ítems condicionales en una posición fija, y un solo nombre ("Mi residencia"). Complementa H16.

#### D24 · El inicio es un lanzador de módulos sin un "próximo paso"
- **Severidad:** alto · **[Op]** · **Ruta:** `/students/dashboard` · **Agente:** `disenador` → `interfaz` · **Esfuerzo:** L
- **Evidencia:**
  - Entre 7 y 8 cards del mismo peso repiten la sidebar ("Tu centro de control — accedé rápido a cada sección").
  - Para Lucía, ya alojada, lo primero es "Tu familiar te sugirió una residencia", y aparecen las promos de Favoritos y Lista de espera.
  - Las grillas quedan con huecos (Soporte huérfano en la fila 3).
  - En mobile es un scroll de 2.500 px.
  - La referencia user_hub ordena por "Solicitud activa".
  - Evidencia en [cap: inicio-estudiante-alojada_1280], [cap: inicio-estudiante-alojada_375] y [cap: inicio-estudiante-menor-launcher_1280].
- **Recomendación:** un **inicio por etapa**:
  - una tarjeta de estado principal según la etapa (buscando, solicitud en curso, reserva, alojado), con una sola acción primaria y la línea de tiempo resumida;
  - debajo, "Pendientes" (documentos, propuestas del familiar, fee);
  - módulos secundarios en una lista compacta;
  - ocultar lo que no aplica a la etapa (Favoritos y Lista de espera para quien ya está alojado).

  Ver §6.

#### D25 · Cada pantalla del panel tiene un ancho de contenido distinto
- **Severidad:** medio · **[Obj]** · **Rutas:** `/students/*`, `/residence/[id]/*` · **Agente:** `interfaz` · **Esfuerzo:** S
- **Evidencia:**
  - El inicio ocupa todo el ancho, alineado a x=280.
  - Mis solicitudes tiene unos 850 px, alineado a x=344.
  - Favoritos, el detalle de solicitud y el comprobante están centrados en unos 620 px.
  - Disponibilidad está centrada en unos 720 px.
  - Habitaciones y Residentes ocupan todo el ancho.
- **Recomendación:** tres anchos tipificados, siempre alineados a la izquierda con el mismo padding: `dashboard` (completo), `lista` (`max-w-5xl`) y `documento o formulario` (`max-w-3xl`). Un `PageHeader` común (título, subtítulo, acciones y "volver" opcional).

#### D26 · Mis solicitudes: tarjetas indistinguibles y affordances confusas
- **Severidad:** medio · **[Obj]** · **Ruta:** `/students/applications` · **Agente:** `interfaz` · **Esfuerzo:** M
- **Evidencia:**
  - Cinco tarjetas con el título "Residencia Norte", sin miniatura ni última novedad.
  - "Ver detalle completo" usa el ícono `open_in_new` (link externo) para navegar dentro de la app.
  - La tarjeta "Necesitan tu acción" es entera durazno y su estado pasa a ser texto naranja sin pill.
  - La referencia mis_solicitudes destaca la solicitud activa con un contador y "¿Qué pasa después?".
  - Evidencia en [cap: solicitudes-estudiante-colores-estado_1280].
- **Recomendación:**
  - Una fila con miniatura (`ResidenceCover` chico), residencia, tipo e ingreso, `StatusTag` del estado y "Última novedad hace 2 h".
  - Solicitud activa como tarjeta grande con un contador cuando hay plazo.
  - El ícono `chevron_right` para navegar.
  - "Necesitan tu acción" con un borde izquierdo naranja, no con todo el fondo.

#### D27 · Detalle de solicitud: la urgencia no destaca y falta orientación
- **Severidad:** bajo · **[Obj]** · **Ruta:** `/students/applications/[id]` · **Agente:** `interfaz` · **Esfuerzo:** S
- **Evidencia:** "Qué sigue" y "Vence en 30 h" usan el mismo fondo beige. No hay "← Mis solicitudes". La línea de tiempo está bien resuelta. [cap: detalle-solicitud-timeline_1280]
- **Recomendación:** plazo en `orange-tint` con ícono de reloj e hora absoluta, breadcrumb de vuelta, y la línea de tiempo arriba a la derecha en desktop.

#### D28 · Mi residencia: comunidad ilegible y color de logro equivocado
- **Severidad:** medio · **[Obj]** · **Ruta:** `/students/residency` · **Agente:** `interfaz` · **Esfuerzo:** S–M
- **Evidencia:**
  - Las banderas tapan las iniciales y el texto se parte palabra por palabra en columnas de unos 190 px.
  - "Ya renovaste tu estadía" usa el banner durazno de urgencia.
  - La referencia mi_residencia abre con un mosaico de fotos.
  - Evidencia en [cap: mi-residencia-banderas-tapan-iniciales_1280].
- **Recomendación:** reutilizar el resumen de D18. Logro en `forest-tint` con ícono de check. Galería cuando haya fotos (D12). Complementa H03 y H19.

#### D29 · El familiar tiene una experiencia visualmente pobre
- **Severidad:** medio · **[Op]** · **Ruta:** `/students/dashboard` como familiar · **Agente:** `disenador` → `constructor` · **Esfuerzo:** M · **Complementa:** H16
- **Evidencia:** tres cards de texto. "Lucia F." no tiene avatar ni foto de su residencia, ni estado de su estadía. La landing presenta a la familia como público clave. [cap: inicio-familiar-escaso_1280]
- **Recomendación:** que el inicio del familiar sea "la tarjeta del estudiante": avatar, etapa actual, residencia, próximo pago o vencimiento, comprobante, y abajo "Propuestas que enviaste". Copy en tercera persona.

#### D30 · El comprobante no parece un documento oficial
- **Severidad:** alto · **[Obj]** (fidelidad) **+ [Op]** · **Rutas:** `/students/receipts/[id]` y el PDF · **Agente:** `disenador` → `interfaz` · **Esfuerzo:** M · **Complementa:** H07
- **Evidencia:**
  - Es una lista clave-valor de 12 filas con el mismo peso.
  - El botón "Descargar PDF" se parte en dos líneas.
  - La referencia comprobante_de_reserva_oficial muestra: sello y encabezado de documento, tiles de resumen (residencia, período, habitación, fee), partes intervinientes, detalle económico, "Condiciones" y "Rol de EstuRed" en dos columnas, y un bloque de verificación con QR.
  - Evidencia en [cap: comprobante-baja-fidelidad_1280].
- **Por qué importa:** es el artefacto de confianza más visible: lo ven el estudiante, la familia y la residencia, y cualquiera puede verificarlo.
- **Recomendación:** rediseñarlo siguiendo la referencia con alta fidelidad, con recortes. Sacar de la referencia "asegura la vacante" y "Soporte WhatsApp 24/7", y no mostrar email del garante sin regla de privacidad. Formato de "hoja" (`paper`, `max-w-3xl`, borde y sombra de documento) y una versión idéntica en el PDF.

### E. Panel de residencia

#### D31 · Tres cáscaras distintas para el mismo owner
- **Severidad:** medio · **[Obj]** · **Rutas:** `/residence/dashboard`, `/residence/[id]/*` · **Agente:** `interfaz` · **Esfuerzo:** M
- **Evidencia:**
  - "Todas mis residencias" lleva a una página con topbar y el **footer de marketing** del sitio público. El owner "sale" del producto.
  - "Gestionar residencia" se parte en dos líneas.
  - El panel de cada residencia usa sidebar.
  - Evidencia en [cap: residencias-owner-shell-distinto_1280] y [cap: panel-residencia_1280].
- **Recomendación:** la misma cáscara de sidebar con un selector de residencia arriba (combo con nombre y estado). El portfolio pasa a ser "Inicio" de esa sidebar.

#### D32 · Inbox: no se ve a la persona que pide el lugar
- **Severidad:** alto · **[Obj]** (fidelidad) **+ [Op]** · **Ruta:** `/residence/[id]/applications` · **Agente:** `disenador` → `interfaz`, `dueño` para la privacidad · **Esfuerzo:** M
- **Evidencia:**
  - El detalle muestra nombre, país, tipo, fechas, tarifa y objetivo académico.
  - No muestra avatar, edad o carrera, completitud del perfil, documentos cargados, "Sobre mí", ni intereses o hábitos. El estudiante sí carga todo eso y la referencia solicitudes_inbox lo muestra.
  - No hay búsqueda, filtros, orden por vencimiento ni una nota que explique qué pasa al "Establecer contacto".
  - Evidencia en [cap: inbox-residencia-sin-perfil-estudiante_1280].
- **Por qué importa:** "Elegir con quién convivir" es la promesa de marca también para la residencia. Sin el perfil, decide a ciegas o vuelve a WhatsApp.
- **Recomendación:** seguir la referencia:
  - lista con avatar, chips "Perfil 67%" y "Docs 1/2", y contador de plazo;
  - detalle con tiles de resumen, "Sobre mí", "Intereses y hábitos" y documentos con acceso auditado;
  - un footer de acciones con texto explicativo.

  "Señales de convivencia" de la referencia está fuera del MVP: se muestran los intereses y hábitos declarados. **El dueño decide** qué datos del perfil ve la residencia antes de establecer contacto (docs/10).

#### D33 · Panel: datos crudos y orden de lectura
- **Severidad:** medio · **[Obj]** · **Ruta:** `/residence/[id]` · **Agente:** `interfaz` · **Esfuerzo:** S
- **Evidencia:**
  - "Próximos ingresos y salidas" muestra un email como nombre ("camila.rojas@example.com").
  - Solo hay egresos, todos con ícono naranja.
  - La capacidad se informa como 30/35 en el panel y como 36 plazas, 83%, en Habitaciones (derivar a `constructor`, relacionado con H03).
  - Evidencia en [cap: panel-residencia_1280] y [cap: habitaciones-residencia_1280].
- **Recomendación:** nombre e inicial, nunca email. Ingresos en `forest` y salidas en `info`. Una sola cifra de capacidad en todo el rol.

#### D34 · Perfil de residencia: proximidad invertida, mayúsculas y título que no corresponde
- **Severidad:** medio · **[Obj]** · **Ruta:** `/residence/[id]/profile` · **Agente:** `interfaz` (+ `constructor` para los checkboxes) · **Esfuerzo:** S
- **Evidencia:**
  - El helper "Se fija al registrarse." queda pegado a la etiqueta "Dirección completa" del campo siguiente, que tiene más aire hasta su propio input. Lo mismo pasa con "Frase corta" y "Descripción".
  - Hay Title Case ("Datos Básicos", "Servicios Incluidos", "Áreas Comunes", "Fortaleza del Perfil") en lugar de sentence case.
  - La residencia ya publicada ve "Configuración de Residencia — Completá la información… para poder publicarla".
  - Los servicios publicados (WiFi, limpieza, lavadero) no aparecen tildados. Es probable que los valores del seed no coincidan con el catálogo de opciones: derivar a `constructor`.
  - Evidencia en [cap: perfil-residencia-espaciado-labels_1280].
- **Recomendación:**
  - Un `Field` (label, control, helper y error) con espaciado fijo: label→control 6 px, control→helper 4 px y campo→campo 20 px.
  - Sentence case en todo el producto.
  - Título "Perfil de la residencia", con un subtítulo distinto según el estado.

#### D35 · Disponibilidad: un formulario largo por tipo de habitación
- **Severidad:** medio · **[Op]** · **Ruta:** `/residence/[id]/availability` · **Agente:** `disenador` → `interfaz` · **Esfuerzo:** M
- **Evidencia:** son 4 formularios de unos 530 px cada uno (select, 3 campos y botón). No hay una vista resumen, no se ve cómo lo verá el estudiante y no se ve cuándo vence cada tipo. [cap: disponibilidad-formulario-largo_1280]
- **Recomendación:** una tabla editable con una fila por tipo:
  - `StatusTag` actual;
  - lugares;
  - "desde";
  - "vence en X días" (ver H23);
  - "Editar" inline, que despliega la nota pública;
  - un botón "Confirmar sin cambios" por fila para el refresco de 30 días, que es la acción más frecuente.

#### D36 · En mobile las tablas se cortan
- **Severidad:** alto · **[Obj]** · **Rutas:** `/residence/[id]/residents`, `/admin/applications` (y otras tablas admin) · **Agente:** `interfaz` · **Esfuerzo:** M
- **Evidencia:** en 375 px, Residentes muestra solo la columna del nombre. Habitación, estado, contrato, tarifa y "Gestionar" quedan detrás de un scroll horizontal sin señal visible. En admin, los badges se parten en tres líneas. [cap: residentes-tabla-cortada_375], [cap: admin-solicitudes-badges-mobile_375]
- **Recomendación:** por debajo de `md`, una lista de cards: nombre y estado arriba, habitación y contrato abajo, y la tarjeta entera tocable. Complementa H31.

### F. Admin

#### D37 · Dashboard admin sin jerarquía
- **Severidad:** medio · **[Obj]** · **Ruta:** `/admin/dashboard` · **Agente:** `interfaz` · **Esfuerzo:** S
- **Evidencia:** 9 KPIs del mismo peso, sin ícono. "Validaciones pendientes: 1 — Requiere acción" no se destaca. La referencia panel_maestro usa icon-tiles y un acento lateral en lo urgente. [cap: admin-dashboard_1280] (los estados crudos y la moneda están en H25)
- **Recomendación:**
  - Una fila superior "Requiere acción" con las validaciones, ediciones de perfil, pagos por revisar y casos de soporte, cada una con su CTA.
  - Debajo, los KPIs de salud con icon-tile.
  - Actividad con divisores `line`.

### G. Copy, tono y accesibilidad transversal

#### D38 · Microcopy con resabios SaaS y mezcla de convenciones
- **Severidad:** bajo · **[Op]** · **Rutas:** varias · **Agente:** `disenador` (`design:ux-copy`) → `interfaz` · **Esfuerzo:** S
- **Evidencia:**
  - "Tu centro de control en EstuRed" y "SYSTEM CONTROLLER" (tono de SaaS frío).
  - "alojado/a" (H29).
  - Title Case mezclado con sentence case.
  - "Configuración de Residencia".
  - "Dashboard operativo".
- **Recomendación:** una guía corta de microcopy (sentence case, saludo por nombre, títulos declarativos de FRESH §4) y una pasada de `design:ux-copy` por los títulos de los paneles.

#### D39 · Áreas táctiles e íconos sin texto
- **Severidad:** medio · **[Obj]** · **Rutas:** sidebar (botón colapsar de unos 24 px), campana, checkboxes nativos (unos 13 px), links "Ver residentes / Disponibilidad" de las cards · **Agente:** `interfaz` · **Esfuerzo:** S
- **Recomendación:** área táctil mínima de 44×44 px (relleno invisible), `aria-label` en el botón de colapsar y en la campana con el conteo ("33 notificaciones sin leer").

#### D40 · La navbar pública queda vacía mientras confirma la sesión
- **Severidad:** bajo · **[Obj]** (observado en captura) · **Rutas:** públicas con sesión · **Agente:** `interfaz` · **Esfuerzo:** S
- **Evidencia:** en la ficha como Lucía, el lado derecho de la navbar quedó vacío, sin "Mi panel" ni "Ingresar", mientras `/api/session` resolvía. Pasa por el `data-session-hint` de H15.
- **Recomendación:** mostrar un placeholder del ancho del botón (skeleton pill) en lugar de nada.

#### D41 · Fidelidad desigual respecto de las referencias
- **Severidad:** medio · **[Obj]** · **Agente:** `disenador` · **Esfuerzo:** —
- **Detalle:** ver la tabla de §3.4. Hay alta fidelidad en el catálogo, Habitaciones y el panel de residencia, y baja en el comprobante, el inbox, el inicio y Mis solicitudes.

#### D42 · No hay modo de "vista previa pública" fiel para la residencia
- **Severidad:** bajo · **[Obj]** · **Ruta:** `/residence/[id]/profile` (card "Vista previa") · **Agente:** `interfaz` · **Esfuerzo:** S
- **Evidencia:** la vista previa es una card distinta de `ResidenceCard`: chips verdes de servicios y "Ver" fantasma.
- **Recomendación:** renderizar el `ResidenceCard` real y un link "Ver mi ficha pública".

#### D43 · Los descargos legales están dispersos y con pesos distintos
- **Severidad:** bajo · **[Op]** · **Rutas:** hero, ficha, comprobante, footer · **Agente:** `disenador` · **Esfuerzo:** S
- **Evidencia:** el mismo descargo ("no garantiza…", "sujeta a confirmación", "plataforma intermediaria") aparece en 4 estilos distintos (texto de 11 px, caja beige, gris en el footer, tooltip).
- **Recomendación:** un componente `Disclaimer` con dos variantes (inline e info-box) e ícono `info`, con contraste AA (D03).

#### D44 · Instrucciones de diseño desactualizadas
- **Severidad:** medio · **[Obj]** · **Archivos:** `.claude/agents/disenador.md`, `CLAUDE.md` (sección Estilos) · **Agente:** `documentador` · **Esfuerzo:** S
- **Evidencia:** describen `petrol/sage/sand/amber-soft` y Manrope + Inter. Los tokens `petrol-*`, `sage-*` y `amber-soft-*` tienen 0 usos fuera de `globals.css`.
- **Recomendación:** apuntar a FRESH, borrar los tokens legacy sin uso y documentar los alias que siguen vivos (`sand-*` tiene 128 usos, más `surface`, `ink-faint`, `rounded-card`).

---

## 3. Auditoría del sistema de diseño

### 3.1 Tokens

| Tema | Estado | Acción |
|---|---|---|
| Fuentes | Bricolage/Hanken declaradas pero **no aplicadas** (D01) | Fix en `layout.tsx` |
| `muted`/`ink-faint` | 3,35:1, no pasa AA | Pasar a #5f6c65 (D03) |
| Texto sobre naranja | Blanco 2,58:1 | Texto `ink` (D02) |
| Texto de badges naranja/butter | 3,75 / 3,51:1 | Nuevos `orange-800` y `butter-fg` más oscuro (D04) |
| Borde de input | 1,36:1 | Nuevo `field-border` (D05) |
| Legacy `petrol/sage/amber-soft` | Definidos, 0 usos | Borrar |
| Alias `sand-*`, `surface`, `ink-faint`, `rounded-card`, `rounded-field` | Vivos (128 / 16 / 237 / 64 / 185 usos) | Mantener como alias documentados; nada nuevo con `sand-*` |
| `Badge` tones `petrol/sage/amber` | Nombres que ya no describen el color | Renombrar a `success/community/attention` (codemod) |
| Escala tipográfica | Valores sueltos ×91 | Escala nombrada (D07) |
| Tokens de estado | No existen como capa propia | `statusTone()` con 5 tonos (D06) |

> Los cambios de `globals.css` (D02–D05, borrar legacy) son de un **archivo sensible**: los decide el dueño. Ninguno introduce un tono nuevo. Son variantes más oscuras de tonos existentes, justificadas por AA.

### 3.2 Componentes que faltan
- `ResidenceCover`: imagen con estado sin foto de marca, mosaico y tamaños de card, ficha y miniatura (D12).
- `PageHeader`: título, subtítulo, acciones y "volver"; además, los tres anchos de contenido (D25).
- `Field`: label, control, helper y error con espaciado fijo (D34). También `Checkbox`, `Switch` (FRESH `.switch`) y `FileField` (D09).
- `StatusPill` sobre `statusTone()`: no reemplaza a `StatusTag`, que sigue siendo exclusivo de la disponibilidad oficial (D06).
- `Avatar`: iniciales, color determinístico y bandera opcional sin solaparse (D18, D28).
- `Toast`, `Skeleton` y `ErrorState` (D11).
- `Disclaimer` (D43).
- `DataList`: tabla en desktop y cards en mobile (D36).
- `DocumentSheet`: base del comprobante y del PDF (D30).

### 3.3 Componentes que sobran o están duplicados
- `components/admin/ui/AdminButton|AdminBadge|AdminCard` y `tokens.ts`, en paralelo a `components/ui/*` (D08).
- Dos o tres variantes del bloque "El problema / Cómo lo resuelve" en las landings (D13).
- Las vistas previas de residencia que no son `ResidenceCard` (D42).

### 3.4 Fidelidad contra las referencias (Stitch)

| Pantalla | Referencia | Fidelidad | Brecha principal |
|---|---|---|---|
| Catálogo `/search` | 4ta · search_results_1/2/3 | Alta (layout) | Fotos (D12), orden, mapa |
| Habitaciones (residencia) | 4ta · gestión_de_habitaciones / habitaciones_dashboard | Alta | — (mantener) |
| Panel residencia | 4ta · residence_admin_dashboard | Media-alta | Datos crudos (D33) |
| Inbox residencia | 4ta · gestión_de_solicitudes_inbox | **Baja** | Sin perfil del estudiante, filtros ni contador (D32) |
| Inicio estudiante | 4ta/6 · dashboard_inicio_user_hub_1/2 | Media-baja | Sin identidad, sin "solicitud activa", lanzador (D22, D24) |
| Mis solicitudes | 4ta · mis_solicitudes_dashboard | Media-baja | Acordeones en vez de solicitud activa más historial (D26) |
| Mi residencia | 4ta · mi_residencia_view_1/2 | Media | Sin galería; comunidad densa (D28) |
| Comprobante | 4ta · comprobante_de_reserva_oficial | **Baja** | Lista plana vs. documento (D30) |
| Perfil estudiante | 2da/4ta · completar_perfil | Media-alta | Controles nativos (D09) |
| Perfil residencia | 2da/4ta · configuración_de_residencia | Media | Espaciado, Title Case (D34) |
| Admin dashboard | 3ra · panel_maestro | Media-baja | Sin icon-tiles ni jerarquía de urgencia (D37) |
| Admin solicitudes | 3ra · gestión_global_de_solicitudes | Media | Sin filtros; mobile (D36) |
| Landing / landings de rol | 1ra · code.html (sin PNG válido) | Media | Patrón repetido; sin imagen (D13) |

---

## 4. Lo que ya funciona (no romper)

- **La paleta cálida FRESH y el tono en voseo** son distintivos, nada genéricos, y están aplicados de forma bastante pareja.
- **Habitaciones (residencia):** KPIs útiles, filtros por tipo, barras de ocupación y tarjetas por habitación. Es la pantalla más "producto real" y la vara para el resto del panel.
- **El detalle de solicitud** con "Cómo viene la solicitud" (línea de tiempo de 5 pasos con estados Listo / Sigue / Pendiente) y "Condiciones de la solicitud" con su snapshot. Es exactamente la claridad que promete la marca.
- **El formulario de solicitud transparente** (ya destacado en la auditoría del 20/10): objetivo académico en chips, aviso de estadía mínima, completitud del perfil.
- **El agrupamiento "Necesitan tu acción / Resto"** en Mis solicitudes y los grupos del inbox (Nuevas / En contacto y pago / Con reserva / Cerradas). Solo hay que corregirles el color (D06, D26).
- **El registro del estudiante** explica la privacidad campo por campo ("Privado — solo se muestra tu inicial") y tiene un opt-in de comunidad explicado.
- **El 404 con marca** y **`/verify`** con un campo para ingresar el número, el formato esperado y el descargo.
- **La KPI-card del panel de residencia** (icon-tile, dato y CTA) sigue FRESH al pie de la letra.
- **El catálogo en mobile** tiene los filtros colapsados en "Filtros" y no hay scroll horizontal de página en las pantallas públicas.
- **El foco visible:** no hay `outline-none` sin reemplazo. `Button` y la navbar tienen `focus-visible:outline-forest`.

---

## 5. Plan de acción

### Fase 1 — Quick wins (1 ciclo de `interfaz`; casi sin decisión de producto)

| # | Ítem | Hallazgos | Esfuerzo | Agente |
|---|---|---|---|---|
| 1 | Aplicar las fuentes de marca (variables en `<html>`) y revisar los H1/H2 | D01 | S | interfaz |
| 2 | Tokens AA: `muted`, texto sobre naranja, `orange-800`, `field-border` *(requiere OK del dueño, `globals.css`)* | D02–D05 | S | interfaz |
| 3 | Sacar `Reveal` del hero | D10 | S | interfaz |
| 4 | `whitespace-nowrap` en `Button` y CTAs más cortos; arreglar los chips superpuestos de `/for-residences` | D14, D15 | S | interfaz |
| 5 | Panel de solicitud de la ficha sin scroll interno (CTA visible) | D20 | S | interfaz |
| 6 | Ficha: "Plaza ocupada" sin estado técnico; avatar con bandera sin solaparse | D18 (parcial), D28 | S | interfaz |
| 7 | Panel residencia: nunca mostrar email como nombre; colores de ingreso y salida | D33 | S | interfaz |
| 8 | Perfil residencia: espaciado de `Field`, sentence case, título por estado | D34 | S | interfaz |
| 9 | Sidebar del estudiante: orden fijo y "Mi residencia" para todos | D23 | S | interfaz |
| 10 | Áreas táctiles de 44 px y `aria-label` en los íconos | D39 | S | interfaz |
| 11 | Skeleton en la navbar pública; links reales en el footer | D40, D16 | S | interfaz |
| 12 | Actualizar las instrucciones de `disenador` y `CLAUDE.md` a FRESH | D44 | S | documentador |

### Fase 2 — Mejoras estructurales (sistema y consistencia)

| # | Ítem | Hallazgos | Esfuerzo | Agente |
|---|---|---|---|---|
| 13 | Mapa de tono por estado: spec, después `statusTone()` y `StatusPill` en los tres roles | D06 | M | disenador → constructor (helper) + interfaz |
| 14 | `ResidenceCover` con placeholder de marca y hero adaptable | D12 | M | disenador → interfaz |
| 15 | Una sola cáscara de panel: identidad, selector de residencia, `PageHeader`, 3 anchos | D22, D25, D31 | M | disenador → interfaz |
| 16 | Controles de formulario de marca (`Field`, `Checkbox`, `Switch`, `FileField`) | D09, D05 | M | interfaz |
| 17 | `DataList` responsive (tabla en desktop, cards en mobile) para Residentes y admin | D36 | M | interfaz |
| 18 | `loading.tsx` y `error.tsx` por área, más `Toast` | D11 | M | interfaz |
| 19 | Migrar el admin a `components/ui` y jerarquía del dashboard | D08, D37 | M | interfaz |
| 20 | Escala tipográfica nombrada y limpieza de radios y tokens legacy | D07, §3.1 | S | interfaz |
| 21 | Disponibilidad como tabla editable con "Confirmar sin cambios" | D35 | M | disenador → interfaz (+ constructor si cambia la action) |
| 22 | Pasada de microcopy y `Disclaimer` | D38, D43 | S | disenador → interfaz |

### Fase 3 — Rediseños mayores

| # | Ítem | Hallazgos | Esfuerzo | Agente |
|---|---|---|---|---|
| 23 | Ficha de residencia | D17–D20, H10 | L | disenador (mockup + SPEC) → interfaz |
| 24 | Comprobante (pantalla y PDF) | D30, H07 | M | disenador → interfaz (+ constructor para el PDF) |
| 25 | Inbox de solicitudes de residencia | D32 | M | disenador → interfaz (+ constructor si se exponen campos del perfil) |
| 26 | Inicio del estudiante y del familiar por etapa | D24, D29, H16 | L | disenador → constructor + interfaz |
| 27 | Mis solicitudes (solicitud activa más historial) | D26 | M | disenador → interfaz |
| 28 | Landing y landings de rol | D13 | L | disenador → interfaz |

### Decisiones que necesitan al dueño

1. **Tokens AA en `globals.css` (D02–D05).** Elegir entre texto `ink` sobre naranja (recomendado) o fondo `orange-700`. Aprobar `muted` #5f6c65 y los tokens nuevos `orange-800` y `field-border`.
2. **Fotografía (D12):**
   - si se exige un mínimo de 3 fotos propias para publicar;
   - si se encarga una sesión de fotos o ilustración para las landings;
   - descartar las imágenes de terceros de `design-references/Fotos Residencias/`.
3. **Qué datos del perfil ve la residencia en el inbox (D32)** y en qué paso: "Sobre mí", intereses y hábitos, completitud, documentos. Afecta docs/10 y a menores.
4. **El placeholder de ubicación (D19):** mapa estático real con zona aproximada (proveedor de tiles, costo) o versión abstracta compacta.
5. **Cáscara del owner (D31):** confirmar que "Todas mis residencias" pasa a vivir dentro del panel con selector, sin footer de marketing.

---

## 6. Pantallas que requieren rediseño completo

Orden recomendado y por qué. Los mockups quedan para una segunda etapa, en `design-proposals/<tema>/` con su SPEC.

1. **Ficha de residencia** (`/residencias/[slug]`). **Va primero:** es donde el invitado y la familia deciden, y hoy acumula cinco problemas (hero vacío, sin precio, comunidad desbordada, mapa roto, CTA cortado).
   - **Dirección:** encabezado compacto con nombre, sello, barrio, universidades y "Guardar". Galería adaptable (D12).
   - **Desktop:** dos columnas. A la izquierda, "Lo esencial" (precio por tipo con `StatusTag`, mínimo, depósito, ajustes), convivencia (cita, reglas, resumen de comunidad con avatares), servicios y áreas, FAQ y ubicación compacta. A la derecha, una card sticky de precio y CTA.
   - **Mobile:** la misma card como barra fija.
   - Mapa de camas solo en `/comunidad`.
2. **Comprobante.** Es el objeto de confianza que se comparte y se verifica. Alta fidelidad con la referencia oficial (sello, tiles, partes, detalle económico, condiciones / rol de EstuRed, QR) y el mismo `DocumentSheet` para la pantalla y el PDF. Esfuerzo acotado e impacto de marca alto.
3. **Inbox de solicitudes (residencia).** Es la herramienta diaria del cliente que paga el plan. Sin ver a la persona, el diferencial "la convivencia se elige" no existe del lado de la residencia. Referencia de alta fidelidad; requiere la decisión 3.
4. **Inicio por etapa (estudiante y familiar).**
   - **Dirección:** un "Hoy" con una sola tarjeta de estado y acción, más pendientes y lo demás compacto.
   - **Familiar:** la tarjeta del estudiante.
   - Necesita lógica (`constructor`) para resolver la etapa.
5. **Mis solicitudes.** Solicitud activa con contador y "¿Qué pasa después?", más un historial con miniaturas. Está muy cerca de la referencia.
6. **Landings (`/`, `/for-students`, `/for-residences`).** Al final, porque dependen de tener imagen propia (decisión 2) y de que D01 ya esté aplicado. Ver la dirección en D13.

---

## 7. No auditado

- **Roles y estados:**
  - Sofía (staff), Superadmin y `/admin/pricing` y `/admin/support-cases` (redirigieron a `/login` con la sesión de admin operativo; revisar si son exclusivos de superadmin).
  - Modales (iniciar renovación, gestionar residente, evaluar), las pantallas de negociación y fee con datos y el detalle de renovación.
- **Interacción y entornos:**
  - Hover, animaciones y microinteracciones en vivo: se revisó el código, no se grabó.
  - Modo oscuro, tablet, lector de pantalla y zoom al 200%.
  - PDFs y emails transaccionales.
- **Fuentes:** con D01 corregido cambian las métricas tipográficas. Conviene volver a capturar las pantallas clave antes de diseñar los rediseños de §6.
