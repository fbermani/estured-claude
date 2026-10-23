# Ficha pública de residencia `/residencias/[slug]`: rediseño

**Estado:** propuesta de diseño, sin implementar. **Autor:** agente `disenador`, 2026-10-23.
**Cubre:** D17, D18, D19 y D20 de `docs/audits/AUDITORIA_DISENO_2026-10-21.md`, y H10 y H03 (lado ficha) de `docs/audits/AUDITORIA_2026-10-20.md`.
**Mockups:** `mockup-desktop.html` y `mockup-mobile.html`. Se abren con cualquier servidor estático. Cada uno tiene un panel "Estados del mockup" para cambiar de rol, disponibilidad, fotos, hoja abierta, error, enviada y carga. También aceptan un hash, por ejemplo `#role=guest&avail=full&photos=5&sel=1&sheet=open&dir=b&mk=0`.
**Capturas:** `assets/` (lista en §13).

---

## 1. Objetivo y problema

**Quién llega y qué decide.** Un estudiante o su familia, casi siempre desde el catálogo, comparando 2 o 3 residencias. En los primeros segundos quieren resolver tres cosas: cuánto cuesta, si hay lugar en el tipo de habitación que buscan y si el lugar es confiable. Recién después miran la convivencia, los servicios y la ubicación. La decisión que toman en esta pantalla es si envían una solicitud (sujeta a confirmación) o si siguen buscando.

**Qué pasa hoy** (`assets/actual-invitado-1280.png`, `assets/actual-invitado-375.png`):

- **El invitado no ve precios en desktop (D17/H10).** El panel lateral solo ofrece "Iniciar sesión" y "Crear cuenta". En mobile, la barra inferior sí muestra "Desde USD 160", así que desktop y mobile se contradicen. Ese "USD 160" corresponde además a la Cuádruple, que está **completa**.
- **"Comunidad y disponibilidad" ocupa unos 2.900 px (D18/H03).** Tiene 4 niveles anidados y ofrece "Cama disponible · Elegí este lugar" a partir del mapa de camas, aunque el tipo esté marcado "Completo" en `profile_availability`. También le muestra al invitado el estado técnico "Residente pendiente de activar cuenta".
- **El mapa no sirve (D19).** Es un rectángulo beige de unos 650 px con círculos y líneas punteadas.
- **El formulario se corta (D20).** El panel es sticky y tiene scroll interno, así que el botón de envío queda fuera de la vista.

## 2. Direcciones

| | A · Columna de decisión (**recomendada**) | B · Tarjeta en el flujo + barra fija |
|---|---|---|
| Idea | La columna derecha sticky es una **card de precio y condiciones** con selector de tipo y CTA. El formulario se abre en una **hoja lateral**. | Una sola columna de contenido de unos 760 px. La card de solicitud va dentro de "Tarifas" y hay una barra fija inferior también en desktop. |
| A favor | El precio y el CTA quedan siempre a la vista, y es el patrón que el usuario ya conoce de la ficha actual. Cambia poco: se reutiliza el `aside` y el `ReservationSelectionProvider`. Resuelve D20 por diseño, porque la card es corta y el formulario va aparte. | Unifica desktop y mobile en un solo patrón y mejora la lectura. |
| En contra | En pantallas de menos de 820 px de alto hay que condensar la card (ver §7). | Desaprovecha el ancho, y una barra fija en desktop se siente a app móvil y tapa contenido. El precio se pierde de vista al leer Comunidad o Ubicación. |
| Captura | `propuesta-desktop-estudiante-1280.png` | `direccion-b-desktop-1280.png` |

**Recomendación: A.** El usuario de desktop es el que compara (sobre todo las familias), y tener el precio y la disponibilidad siempre visibles vale más que el ancho de lectura. En mobile las dos direcciones terminan en lo mismo: una sección de tarifas, una barra inferior y una hoja a pantalla completa.

## 3. Jerarquía y orden de bloques

### Desktop (≥ 1024 px): grilla `minmax(0,1fr) 360px`, gap de 40 px, `max-w-6xl`

1. Migas: "Residencias › {barrio} › {nombre}" (nuevo, liviano).
2. **Hero adaptable** (`ResidenceGallery`, ya implementado). Ajuste propuesto: el estado de 0 fotos pasa de `h-56/h-72` a **200 px de alto** en desktop y 150 px en mobile, para que el título y el precio suban.
3. **Encabezado:** H1 + `TrustBadge` + "Guardar" (`FavoriteButton`, solo estudiante, como hoy) / zona "Palermo, CABA · zona aproximada" / **fila de datos clave** (chips): "Desde USD X/mes", tipos ofrecidos, "Estadía mínima N meses", universidad más cercana con distancia, "N residentes" / descripción recortada a unas 3 líneas con "Leer más".
4. **Subnav sticky** (debajo de la navbar, `top: 68px`): Tarifas y condiciones · Comunidad · La residencia · Ubicación · Preguntas. El activo lleva subrayado forest de 3 px, con scrollspy.
5. Columna izquierda:
   1. **Tarifas y condiciones** (nuevo, H10). Incluye la tabla por tipo, las condiciones, "Qué pagás y a quién" y "Qué revisó EstuRed".
   2. **Comunidad y convivencia** (resumen compacto, D18).
   3. **La residencia:** Servicios y Áreas comunes en 2 columnas + Reglas (`RulesHighlight`).
   4. **Ubicación** (D19).
   5. **Preguntas frecuentes** (`FaqAccordion` + `AskQuestionForm`, sin cambios de lógica).
   6. "¿Buscás más opciones? Mirá el catálogo completo."
6. Columna derecha: **card de precio y condiciones**, sticky (`top: 132px`) durante **toda** la página. Deja de liberarse al llegar a Comunidad: con la comunidad compacta, la razón del Ciclo 35 ya no existe.

### Mobile (< 1024 px; diseñado a 375 px)

1. Hero (0 fotos: banda de 150 px; 1 o más: carrusel con scroll-snap y contador "1 / N").
2. H1, sello + zona, chips de datos con scroll horizontal, descripción recortada.
3. Subnav sticky (`top: 56px`) con scroll horizontal.
4. **Tarifas y condiciones.** En mobile esta sección **es** el panel de solicitud (`id="solicitud"`): tarjetas seleccionables por tipo → condiciones en lista → "Qué pagás y a quién" → **card de solicitud** (precio elegido + CTA + descargo) → "Qué revisó EstuRed".
5. Comunidad → La residencia → Ubicación (mapa de 214 px) → Preguntas.
6. **Barra inferior** (`MobileRequestBar`): "Desde USD X /mes" o "{Tipo} USD X /mes" + CTA. Se oculta cuando la card de solicitud o el footer están a la vista (comportamiento actual).

## 4. Bloques en detalle

### 4.1 Tarifas y condiciones (nuevo, visible para todos)

**Tabla por tipo (desktop)** = `radiogroup` "Elegí un tipo de habitación". Cada fila es un `<label>` con un radio.

| Columna | Contenido | Fuente |
|---|---|---|
| Radio | Deshabilitado si el tipo está `full` | `profile_availability.status` |
| Tipo | Nombre + subtítulo "N personas por habitación". Si están cargados, se suma "· mixta · baño compartido" | `room_types.name`, `capacity_per_room`, `gender_policy`, `bathroom_type` |
| Por mes | "USD 220 /mes" + "≈ ARS 345.500" | `monthly_price_usd`, `usdToArsRounded` |
| Disponibilidad | `StatusTag` **con `withTip`**, uno por tipo | `profile_availability` (D3) |
| Acción | "Elegir" / "Elegida" (botón outline xs). Si el tipo está completo: "Lista de espera" (ghost) | |

- Pie de la tabla: "Los pesos son referenciales, al dólar blue de hoy (ARS 1.570)." + `ExchangeRateNote`.
- Elegir un tipo en la tabla, en la card lateral o con `?room=` es **el mismo estado** (`ReservationSelectionProvider`). La fila elegida lleva fondo `forest-tint` al 55% y un filete izquierdo forest de 3 px.
- **Mobile:** una tarjeta por tipo. Arriba, nombre y capacidad; a la derecha, precio USD con ARS debajo; abajo, `StatusTag`. Si está completa: "Sumarme a la lista de espera".
- **No se muestran cantidades de lugares libres** (`available_count`) ni camas libres en la ficha (ver §4.4).

**Condiciones** (grilla de 3×2 en desktop, lista en mobile). Cada ítem lleva ícono, rótulo, valor grande y una línea de ayuda. Si el dato no está cargado, el ítem no se muestra.

| Rótulo | Valor | Ayuda | Fuente |
|---|---|---|---|
| Para reservar | "Primer mes" / "USD X" (monto fijo) | "Pago inicial a la residencia: el mes del tipo que elijas." / "Monto fijo que pide la residencia para reservar." | `initialPaymentConfigFromRow` |
| Depósito | "USD 300" | "Reembolsable al irte si no hay daños. ≈ ARS 471.000" | `deposit_usd` |
| Matrícula | "USD X" + "(única vez)" / "(anual)", o "No cobra" | "Cargo administrativo de ingreso." | `enrollment_fee_*` |
| Estadía mínima | "6 meses" | "Podés pedir una estadía más larga en la solicitud." | `minimum_stay_months` |
| Ajuste de la tarifa | Mensual / Trimestral / Semestral / Anual / Sin ajuste | "La residencia puede actualizar la tarifa cada 3 meses." (el texto cambia según el valor; con "none": "La tarifa no se ajusta durante la estadía inicial.") | `residences.adjustment_policy` (hoy la página no lo lee) |
| Si reservás con anticipación | "50% por mes" | "Por cada mes completo entre la reserva y tu ingreso (hasta 3)." | `empty_month_charge_percent`, `MAX_EMPTY_MONTHS` |

**"Qué pagás y a quién"** (2 columnas en desktop, apiladas en mobile). Existe para que el usuario no confunda pago a la residencia, fee y reserva (regla 3):

- **A la residencia** (tile forest): "Pago inicial para reservar (primer mes) · Renta mensual, mes a mes · Depósito reembolsable". Nota: "Se paga directamente a la residencia, recién cuando confirma tu reserva y habilita el pago."
- **A EstuRed** (tile orange): "Fee del 5% sobre el total de la reserva · Solo si la residencia confirma tu reserva". Nota: "Enviar la solicitud es gratis. Te mostramos el detalle exacto antes de enviarla." El 5% ya es público en `/terms`.

**"Qué revisó EstuRed"** (alcance del sello, `docs/01 §11`, contenido obligatorio de `docs/08 §4.5`): "Identidad, ubicación y fotos revisadas por EstuRed mediante control presencial." Checks: Identidad de los responsables · Dirección · Visita presencial · Fotos comparadas con el lugar. Pie: "El sello no reemplaza leer las condiciones y el reglamento de la residencia."

### 4.2 Card de precio y condiciones (desktop, columna derecha, `id="solicitud"`)

De arriba hacia abajo:

1. Eyebrow: "Desde" (sin tipo elegido) o el nombre del tipo.
2. Precio grande: "USD 190 /mes" + "≈ ARS 298.500 por mes, referencial" + `ExchangeRateNote`.
3. Aviso de estado de la residencia (solo si corresponde, ver §5).
4. Fieldset "Elegí tu tipo de habitación": filas compactas con radio, nombre, una línea de estado (texto del `StatusTag`) y precio. El tipo completo se ve atenuado, con "Completa".
5. Datos clave: Para reservar "Primer mes · USD 220" / Depósito / Estadía mínima.
6. CTA según el rol (§5).
7. Descargo: "Enviar la solicitud es gratis. La residencia la revisa y responde en hasta 48 horas. Toda reserva está sujeta a confirmación."
8. Pie: "¿Tenés dudas? · Preguntale a la residencia →" (ancla a `#preguntas`).

Alto con 4 tipos: unos 700 px. Con un alto de ventana menor a 820 px se ocultan los datos clave (5) y el pie (8), porque esos datos ya están en Tarifas. Así **el CTA nunca queda fuera de la vista** y no se usa scroll interno (D20).

### 4.3 Hoja de solicitud (`ApplyForm` en un diálogo)

- **Desktop:** hoja lateral derecha de 500 px, radio de 24 px a la izquierda, fondo con `rgb(18 30 24 / .5)` + blur de 3 px, entrada `translateX` con `--ease-out`. **Mobile:** hoja inferior a casi pantalla completa (`100% - 24px`), con tirador.
- **Encabezado fijo:** eyebrow con el nombre de la residencia, H2 "Tu solicitud de reserva", "Sujeta a confirmación de la residencia." y botón cerrar (36×36 en desktop, 44×44 en mobile).
- **Cuerpo con scroll:**
  - "1 · Tu estadía": tipo (precargado con la elección), fecha de ingreso, duración + hint de estadía mínima, Entrada → Salida y el desglose actual sin cambios de cálculo (renta, mes vacío, total, depósito aparte, "A la residencia: pago inicial", "A EstuRed: fee 5%").
  - "2 · Sobre vos": objetivo académico, detalle y el aviso de completitud del perfil.
  - Microcopy: en el aviso de completitud, "Completarlo ayuda a que la residencia te conozca" en lugar de "aumenta tus probabilidades de ser aceptado", que es una promesa implícita.
- **Pie fijo** (resuelve D20): error inline si lo hay + checkbox "Leí y acepto…" + "Enviar solicitud de reserva" + "La residencia verá tu carrera y universidad y tiene 48 horas para responder; si no lo hace, la solicitud vence."
- **Éxito** (reemplaza cuerpo y pie):
  - Check en tile forest, "Enviamos tu solicitud", "Residencia Norte · Doble · desde el 1 mar 2027".
  - Lista de próximos pasos: "La residencia la revisa y responde en hasta 48 horas." / "Si la acepta, coordinan el contacto y te comparte la dirección." / "Tu reserva queda confirmada cuando la residencia registra el pago inicial."
  - CTAs: "Ver mis solicitudes" y "Seguir explorando".
  - Si hoy el envío redirige, se mantiene la redirección y esta pantalla queda como destino o como toast.
- **Error:** "No pudimos enviar tu solicitud. Revisá tu conexión y probá de nuevo; no se perdió nada de lo que cargaste." Los errores de validación del servidor se muestran tal como hoy, en `role="alert"`.

### 4.4 Comunidad y convivencia (D18)

- Cita de la residencia (`community_statement`) con "— La residencia".
- **Card resumen:** "30 residentes actuales" + etiqueta neutra "Cada estudiante decide qué mostrar". Luego una fila por tipo: nombre, "N residentes", pila de 4 avatares de iniciales + "+n" y el `StatusTag` del tipo. Este es el mismo dato que Tarifas; se repite para que no aparezca una segunda verdad.
- Pie: "La convivencia es dinámica: los perfiles son los de hoy y pueden cambiar antes de tu ingreso." Invitado: "Creá tu cuenta para ver nombres, carreras e intereses de quienes eligen mostrarlos."
- Link "Ver comunidad →" a `/residencias/[slug]/comunidad`. **El mapa de camas completo (`CommunityBrowser`) sale de la ficha y queda solo en esa página.**
- **Regla H03/D3:** la ficha no muestra camas libres ni "x de y plazas", porque se calculan desde habitaciones y `resident_stays` y pueden contradecir a `profile_availability`. En `/comunidad`, el slot libre solo ofrece "Elegí este lugar" si su tipo está `available_to_confirm`. Si no, muestra "Plaza libre (sin disponibilidad informada)", sin CTA. "Plaza ocupada", sin motivo.
- Avatares: solo iniciales, sin nombres, en la ficha y para todos los roles. Los menores se cuentan pero nunca se individualizan (se mantiene `getCommunityVisibility`).

### 4.5 Ubicación (D19)

- Mapa estático real de OpenStreetMap, de 290 px (desktop) / 214 px (mobile): teselas z14 + capa SVG.
  - **Zona aproximada:** círculo de unos 600 m de radio, relleno naranja al 16% y borde punteado naranja, con punto central.
  - **Universidades:** marcadores numerados en `blue-ink`.
  - Etiqueta flotante "Zona aproximada · radio de 600 m" y atribución obligatoria "© colaboradores de OpenStreetMap".
  - Teselas con `filter: saturate(.55) sepia(.12)` para que se integren a la paleta cálida.
- Lista de universidades: número, nombre y "~1,8 km". Pie: "Distancias aproximadas en línea recta desde el centro de la zona. Ver la zona en OpenStreetMap" (link al centro de la zona, nunca a la dirección).
- Subtítulo: "Zona aproximada en Palermo. La dirección exacta te la comparte la residencia cuando confirma el contacto." Reemplaza el "una vez confirmada la reserva" actual, según la decisión del dueño.
- Sin JS de mapas: solo `<img>` de teselas y un `<svg>`, sin interacción ni API key. Las teselas van con `loading="lazy"`.

### 4.6 Preguntas frecuentes

Sin cambios funcionales (D9). Visualmente: card única con `details` divididos por líneas, "Pregunta de un visitante" como eyebrow, y el formulario "¿Tenés otra pregunta?" en una card aparte. El equipo de la residencia ve el aviso actual que lleva a su panel.

## 5. Estados por rol y disponibilidad (card / sección de solicitud)

| Caso | Precio y tipos | CTA principal | Texto |
|---|---|---|---|
| Invitado | Visibles | "Solicitar lugar en {Tipo}" | "Te pedimos que ingreses con tu cuenta de estudiante; volvés acá con tu elección guardada." + link "Crear cuenta de estudiante" |
| Estudiante | Visibles | "Solicitar lugar en {Tipo}" → abre la hoja. Sin tipo: "Elegí un tipo para solicitar" (deshabilitado) | Descargo §4.2 |
| Estudiante menor sin familiar / sin teléfono | Visibles | Aviso neutro "Primero, vinculá a un familiar" + "Invitar a un familiar" (o "Ir a Soporte") | Copy actual |
| Familiar vinculado | Visibles | "Proponer a {Nombre}" (`ProposeForm` en la misma hoja) | "Una propuesta no es una solicitud: {Nombre} la ve en su panel y decide si la envía." |
| Equipo de la residencia / admin | No se muestra el selector | "Vista previa · Así ven tu ficha los estudiantes" + "Editar perfil de la residencia" / "Actualizar disponibilidad" | Sin CTA de solicitud ni barra mobile |
| Algún tipo completo | El tipo aparece atenuado, radio deshabilitado | Botón "Lista de espera" en su fila | |
| Todos los tipos completos | Precio "Desde" = mínimo de todos | "Sumarme a la lista de espera" (`JoinWaitlistForm`) | Aviso `StatusTag full` "Residencia completa · Podés sumarte a la lista de espera…" + "Sumarte a la lista de espera no es una solicitud ni reserva un lugar…" |
| Sin disponibilidad actualizada | Tipos con `StatusTag not_updated` | "Solicitar lugar en {Tipo}" (se permite, `docs/04`) | Aviso neutro: "La residencia no actualizó su disponibilidad. Podés enviar la solicitud igual: te confirma si hay lugar." |
| Sin tarifas cargadas | Se oculta la tabla | `EmptyState`: "La residencia todavía no publicó sus tarifas" + "Hacer una pregunta" / "Ver más residencias". Card: "Todavía sin tarifas publicadas" | |

**"Desde" (barra mobile, chip y card):** el mínimo entre los tipos **no completos**. Si todos están completos, el mínimo de todos. Hoy toma el mínimo de todos, y en Norte eso da USD 160, de un tipo completo.

## 6. Estados de página

- **Carga:** skeleton con hero, título, chips y bloque de tarifas en la izquierda, card de 460 px en la derecha (`propuesta-desktop-carga-1280.png`). En Next, un `loading.tsx` del segmento.
- **No existe o no está publicada:** el `notFound()` actual.
- **Error parcial:** si fallan la FAQ, la comunidad o el tipo de cambio, el bloque se oculta o degrada sin romper la ficha:
  - FAQ: mensaje actual.
  - Comunidad: se oculta el bloque.
  - Tipo de cambio: la cascada de `lib/exchange/rate.ts`.
  - Teselas: fondo `cream-2` con "No pudimos cargar el mapa. La residencia está en la zona de Palermo, CABA." y la lista de universidades sigue visible (botón "Mapa sin conexión" del mockup).
- **Vacíos:** sin fotos → placeholder de marca; sin servicios, áreas o reglas → se omite el subtítulo; sin universidades → mapa sin lista; sin FAQ → solo el formulario.

## 7. Responsive

- **≥ 1024 px:** grilla de 2 columnas, card sticky y hoja lateral.
- **< 1024 px:** una columna; Tarifas actúa de panel y aparece la barra inferior. Con tipo elegido, la barra abre la hoja. Sin tipo, o para invitados, lleva a `#tarifas`.
- **Alto < 820 px (desktop):** card condensada (§4.2).
- **375 px:** sin scroll horizontal de página (verificado). Chips y subnav con scroll horizontal propio y sin barra visible. Tarjetas de tipo a ancho completo. Inputs de 16 px para que iOS no haga zoom.
- **Safe area:** barra e hoja con `env(safe-area-inset-bottom)`.

## 8. Accesibilidad

- Selección de tipo: `radiogroup` con `<label>` envolvente y `aria-label` completo ("Doble, USD 220 por mes, Disponibilidad informada"). Los tipos completos usan `disabled` en el input, no solo el color: también llevan el texto "Completa".
- La disponibilidad nunca depende solo del color: el `StatusTag` siempre lleva texto, y el `withTip` explica el estado.
- Hoja: `role="dialog"`, `aria-modal`, foco inicial en el selector de tipo, trampa de foco, `Esc` y clic en el fondo cierran, y el foco vuelve al disparador. En mobile, el `inert` del resto de la página.
- Subnav: `<nav aria-label="Secciones de la ficha">` con `aria-current` en el activo.
- Mapa: `role="img"` con descripción textual. La información del mapa (zona y distancias) también está en texto.
- Contraste: todo con tokens AA del Ciclo 52. `ink-faint` #5f6c65 sobre `paper`/`cream` ≥ 4,6:1; `info-fg` sobre `info-bg`, `warning-fg` sobre `warning-bg` y blanco sobre `forest` ≥ 4,5:1.
- Objetivos táctiles de ≥ 44 px en mobile (CTA de 54 px, barra de 48 px, cerrar de 44 px, chips de 40 px de alto con área extendida). El `(i)` de 15 px se amplía con un pseudo-elemento.
- `prefers-reduced-motion`: sin smooth scroll, transiciones de la hoja ni shimmer del skeleton.

## 9. Tokens y componentes

**Tokens:** solo los existentes de `app/globals.css`. **No se propone ningún token nuevo.**

- Paleta: `forest*`, `orange*` (solo acento de zona y del bloque fee), `blue-ink`/`blue-tint` (universidades, info), `cream*`, `paper`, `line*`, `field-border` (radios), `mint`/`butter`/`sky` (placeholder).
- Radios: `rounded-card` (22) para cards, `rounded-sm` (16) para condiciones y tarjetas de tipo en mobile, `rounded-field` (12) para filas de la card e inputs, pill para botones y chips.
- Sombras: `shadow-card` (card de solicitud), `shadow-float` (hoja, barra).
- Tipografía: Bricolage para H1 (40/30 px), H2 (24/22) y precios; Hanken para el resto.

**Componentes a reutilizar:**

| Componente | Uso |
|---|---|
| `ResidenceGallery` / `ResidencePhotoPlaceholder` | Hero (ajuste de alto en 0 fotos) |
| `TrustBadge` | Encabezado |
| `StatusTag` (`withTip`) | Por tipo, en tabla, card, comunidad y mobile |
| `ExchangeRateNote` | Junto a cada ARS |
| `Button` | primary / outline / ghost |
| `Card`, `SectionHeader`, `EmptyState`, `InfoTip`, `Icon` | |
| `AmenityGrid`, `RulesHighlight`, `FaqAccordion`, `AskQuestionForm` | Sin cambios de lógica |
| `ApplyForm`, `ProposeForm`, `JoinWaitlistForm` | Contenido de la hoja |
| `FavoriteButton` | Existente, sin features nuevas |
| `MobileRequestBar` | Barra mobile; recibe tipo, precio y acción |
| `ReservationSelectionProvider` | Estado único del tipo elegido |
| `CommunityBrowser` | Solo en `/comunidad` |

**Componentes nuevos (UI):**

| Componente | Propósito |
|---|---|
| `RatesTable` / `RoomTypeRateCard` (mobile) | Tabla o tarjetas de tarifas por tipo |
| `ReservationConditions` | Grilla de condiciones |
| `WhoGetsPaid` | "Qué pagás y a quién" |
| `VerificationScope` | Alcance del sello |
| `RequestPanel` | Card lateral por rol y estado (reemplaza la lógica inline del `aside`) |
| `RequestSheet` | Diálogo lateral o inferior que envuelve `ApplyForm`/`ProposeForm` |
| `CommunitySummary` | Resumen por tipo |
| `ApproxZoneMap` | Reemplaza a `CompactMap`: teselas OSM + SVG |
| `SectionNav` | Subnav sticky con scrollspy (único `"use client"` nuevo además de `RequestSheet`) |

## 10. Notas de implementación

### Solo UI (`interfaz`)

1. Reordenar la página según §3, sacar `CommunityBrowser` de la ficha y crear `CommunitySummary` con los datos de `getCommunityVisibility` (que ya trae `cards` por tipo).
2. `RatesTable` y condiciones con los datos que **ya** carga `loadResidence` + `conditions`. Sumar `adjustment_policy` a `conditions`: está en la fila (`select *`), solo hay que mapearlo con las etiquetas de `lib/residences/options.ts`.
3. `RequestPanel` sticky sin `max-h`/`overflow-y-auto` + `RequestSheet` con `ApplyForm` adentro (pie fijo con checkbox y CTA). `ProposeForm` y `JoinWaitlistForm` van en la misma hoja.
4. "Desde" = mínimo de los tipos no completos (§5), en el chip, la card y `MobileRequestBar`.
5. `MobileRequestBar`: aceptar el tipo elegido y una acción (abrir la hoja o ir a `#tarifas`). Sigue ocultándose con el panel o el footer.
6. Alto del placeholder del hero en 0 fotos: 200/150 px.
7. Copy: el de este SPEC. Ver además "Completarlo ayuda a que la residencia te conozca" en §4.3.
8. `loading.tsx` con el skeleton y el fallback del mapa.

### Requiere lógica o datos (`constructor`, más el dueño donde se indica)

1. **Volver del login con la elección:** `next=/residencias/{slug}?room={id}&solicitar=1`. Al volver con sesión de estudiante se abre la hoja con el tipo precargado. `?room=` ya existe; falta `solicitar=1`.
2. **`/comunidad` (H03):** el slot libre solo ofrece "Elegí este lugar" si el tipo está `available_to_confirm` (pasar `profile_availability` a `CommunityBrowser`/`FreeBedSlot`). "Plaza ocupada" sin motivo.
3. **Mapa:** centro del círculo y proveedor de teselas (decisiones 3 y 4). Si se elige la coordenada por residencia: columnas nuevas + carga desde admin o geocodificación al verificar, siempre redondeada o desplazada del lado del servidor, nunca la coordenada exacta en el HTML.
4. **Dirección tras el contacto:** confirmar que la dirección exacta aparece en la solicitud del estudiante en `contact_established`. Si hoy solo aparece con la reserva confirmada, hay que alinearlo con la decisión del dueño, que dijo "hasta confirmar contacto".
5. **Etiqueta "completa" por tipo:** depende de la decisión 2 (cambio en `StatusTag.tsx`, archivo sensible).
6. **Matrícula "No cobra":** confirmar que `enrollment_fee_mode = null` significa "no cobra" y no "no informado". Si puede ser "no informado", el ítem debe ocultarse en vez de afirmar "No cobra".
7. **Inconsistencia de datos demo:** en Norte, Triple tiene `available_to_confirm` con `available_count = 0`. La ficha propuesta no muestra la cantidad, así que no se nota, pero conviene revisar el seed.

### Qué se recorta por reglas de negocio

- Ningún "Cama disponible", "x camas libres" ni "Elegí este lugar" en la ficha (D3/H03).
- Ningún "asegurá tu lugar", "garantizado" ni "aumenta tus probabilidades".
- La lista de espera se aclara como "no es una solicitud".
- Sin chat, sin mensajes a la residencia antes de solicitar (solo la FAQ existente), sin favoritos nuevos (se mantiene el "Guardar" que ya existe), sin fotos de terceros, sin tiempos de viaje ni transporte (no hay datos: solo la distancia en línea recta), sin reseñas ni puntajes.

## 11. Decisiones del dueño (de a una)

1. **Dirección de layout.** A: columna de decisión sticky + hoja lateral (recomendada). B: una columna + tarjeta en el flujo + barra fija en desktop.
2. **Cómo se llama un tipo de habitación completo.** Hoy `StatusTag` (`full`) dice "Residencia completa", que es falso cuando solo un tipo está lleno. Opciones:
   - (a) Agregar a `StatusTag` una variante por tipo, "Completa", con tip "No hay lugar informado en este tipo. Podés sumarte a la lista de espera." (recomendada).
   - (b) Usar "Residencia completa" también por tipo.
   - (c) "Sin lugar informado".

   Es copy oficial de `docs/08 §4.5`: requiere doc primero.
3. **Centro del círculo de zona.**
   - (a) Centroide del barrio, como hoy. No necesita datos nuevos, pero en barrios grandes como Palermo el círculo puede quedar a más de 1 km de la residencia y las distancias se calculan desde ahí.
   - (b) Coordenada aproximada por residencia: la dirección geocodificada, redondeada o desplazada unos 300 m del lado del servidor (recomendada; necesita columna y carga).
4. **Teselas de OpenStreetMap.** La política de uso de `tile.openstreetmap.org` desaconseja el tráfico de producción intenso.
   - (a) Servirlas desde OSM para el MVP, con atribución y caché del navegador.
   - (b) Un proveedor de teselas OSM con plan gratuito y API key (recomendada antes del lanzamiento masivo).
   - (c) Generar una imagen estática por residencia y guardarla en Storage al verificar.

## 12. Verificación hecha

- Mockups abiertos con un servidor estático local y capturados con Chrome headless a 1280×860 / 1280×4500 y a 375×812 / 375×4300 (con un iframe de 375 px reales). Sin scroll horizontal a 375 ni a 1280.
- La card lateral mide unos 705 px con 4 tipos y entra en 1280×860 con `top: 132px`. Por debajo de 820 px de alto se condensa.
- La ficha actual se miró en `localhost:3000` solo para leer y capturar, como invitado y como estudiante demo, sin enviar nada. Las condiciones y precios de Norte se leyeron de `estured-dev` con un `select` de solo lectura.

## 13. Capturas (`assets/`)

| Archivo | Qué muestra |
|---|---|
| `actual-invitado-1280.png`, `actual-invitado-375.png` | Ficha actual (invitado) |
| `propuesta-desktop-estudiante-1280.png` | Página completa, estudiante con Doble elegida |
| `propuesta-desktop-pliegue-invitado-1280.png` | Primer pliegue del invitado |
| `propuesta-desktop-hoja-solicitud-1280.png`, `-hoja-error-`, `-hoja-enviada-` | Hoja de solicitud y sus estados |
| `propuesta-desktop-completa-1280.png` | Todos los tipos completos (lista de espera) |
| `propuesta-desktop-sin-actualizar-familiar-1280.png` | Sin actualizar + familiar ("Proponer a…") |
| `propuesta-desktop-menor-1280.png` | Menor sin familiar |
| `propuesta-desktop-equipo-5fotos-1280.png` | Vista previa del equipo + mosaico de 5 o más fotos |
| `propuesta-desktop-sin-tarifas-1280.png` | Estado vacío de tarifas |
| `propuesta-desktop-carga-1280.png` | Skeleton |
| `direccion-b-desktop-1280.png` | Dirección B |
| `propuesta-mobile-estudiante-375.png` | Página completa en mobile |
| `propuesta-mobile-pliegue-invitado-375.png` | Primer pliegue del invitado con barra |
| `propuesta-mobile-hoja-solicitud-375.png`, `-hoja-enviada-` | Hoja a pantalla completa |
| `propuesta-mobile-completa-375.png` | Todo completo en mobile |
