# SPEC — «Una solicitud, de punta a punta» (storyline B)

Estado: **aprobado 2026-11-10** (CTA «Sumate a EstuRed» · estured.com). v2 construida (88,5 s, 12 escenas); la tabla de SHOTS de abajo es la v1 — la línea de tiempo vigente está en `timeline.json` y el detalle de v2 en `REVIEW.md`.

## Ajustes tras capturar el dev (2026-11-10)
- Tinta real de la app: `#1d2722` (no `#0c3a2c`, que queda para campos oscuros); papel `#fffdf8`, crema de fondo de la app.
- **Solo residencias demo ficticias** (`residencia-norte-demo`, `residencia-rio-de-la-plata-demo`). El dev tiene residencias REALES importadas del CRM (Wanna, La Casa de Cris, Family Home, Sin Fronteras…): nunca aparecen. La home y /search muestran tarjetas reales → se recortan por encima del carrusel o se tapan.
- **Precios ocultos**: las capturas demo muestran tarifas en USD/ARS; toda cifra de precio se recorta o se reemplaza en el rearmado de UI (se conservan etiquetas reales).
- Capturas en `captures/{desktop,mobile}/` (índice en `_index*.tsv`). Usos: S4 `ficha-norte` (sello «Residencia Verificada»), S5 panel «Tu solicitud de reserva» de la ficha, S6 `lucia-family-proposals` + `martin-dashboard`, S7 `res-applications` («Solicitudes recibidas», tarjeta «Solicitud de Lucía F.»), S8 `lucia-app-4` («Lo que ya pasó»: solicitud → contacto → pago a la residencia → fee → reserva confirmada), S9 `lucia-receipt` + `verify-ok` («Existe un comprobante con este número»), S10 `lucia-support` + `comunidad-norte`.
- Logo: el SVG oficial (provisorio) de `components/ui/BrandMark.tsx` (casa + R + cama), sin redibujar.

## Guion de voz (≈160 palabras, ~2 pal/s)
1. Te vas a estudiar a Buenos Aires. Y tenés que elegir dónde vivir… desde lejos.
2. Fotos que no sabés si son de hoy. Precios que cambian por chat. Una seña sin comprobante.
3. Por eso existe EstuRed.
4. Cada residencia está verificada en persona: identidad, dirección y fotos, revisadas por EstuRed.
5. Comparás desde tu casa y enviás tu solicitud. Queda registrada, y sujeta a la confirmación de la residencia.
6. Tu familia puede proponerte opciones y acompañarte en cada paso. La decisión es tuya.
7. Y la residencia recibe solicitudes ordenadas, con la información completa. Menos mensajes repetidos, más tiempo para responder.
8. Las condiciones se acuerdan por escrito. El pago a la residencia y el fee de EstuRed van por separado.
9. Con todo confirmado, recibís tu Comprobante de Reserva Confirmada, con un código que cualquiera puede verificar.
10. Si algo se traba, tenés Soporte. Y antes de llegar, podés conocer la comunidad de cada residencia.
11. Porque la convivencia también se elige. Sumate a EstuRed.

GOAL: que quien mira entienda que EstuRed convierte la duda de elegir residencia a distancia en una solicitud registrada, con residencia verificada en persona y comprobante verificable, y haga una sola cosa: sumarse.

OUTPUT: HyperFrames, 1920×1080 @ 30 fps (principal) + composición propia 1080×1920 @ 30 fps (Instagram).
TIME: 80 s × 30 = 2400 frames. Música 120 BPM: 1 beat = 15 f, 1 compás (4 beats) = 60 f = 2 s; 40 compases. Cada escena empieza en un compás (múltiplo de 60 f) salvo el hook (f0).

## LOOK (marca FRESH vigente, `video/src/theme.ts`; sin petrol/sage/sand)
- Mundos (cada uno con su suelo, nunca un lienzo único):
  - M1 «el cuarto»: campo pleno `#e2f1ea` (forestTint), textura 0 %.
  - M2 «el escritorio de la app»: `#f8fbf7`, la UI real sobre él, sombra 0 24 px 65 px `#0c3a2c` al 9 % + 0 3 10 al 3 %.
  - M3 «campo de marca»: `#0c3a2c` (forestInk) a pantalla completa solo en reveal y cierre, con un héroe ≥ 40 % del alto (nunca elementos chicos flotando).
- Tinta: texto `#0c3a2c` sobre claro (contraste ≥ 7:1); `#f8fbf7` sobre forestInk. Verde de marca `#1f7d5c` para acciones y tildes.
- Acento único: naranja `#c0521d` (`#ef8551` solo sobre forestInk). Aparece solo en: la palabra clave de cada título (1 por escena), el sello «Residencia Verificada», el botón final.
- Tipografía (archivos propios de la marca, en `assets/fonts/` con `@font-face`): display Bricolage Grotesque 700, 86 px (8 % del alto), tracking −2 %, interlineado 1.05; cuerpo Hanken Grotesk 500, 32 px. Subtítulos Hanken Grotesk 600, 36 px (9:16: 44 px), fondo forestInk al 92 %, radio 16 px.
- Medio: UI real del producto (capturas existentes en `video/public/shots/`, `proceso-1…5` y fichas) + personas/objetos vectoriales mínimos del mismo sistema que v3 (teléfono, cursor). Grano 0 %, viñeta 0 %. Sin glow.
- Las pantallas y datos son **ilustrativos**: aviso «Interfaz ilustrativa» 24 px `#0c3a2c` al 60 % durante los últimos 2 s del cierre (no en cada escena).

## OBJECTS
- Teléfono: marco 14 px `#0c3a2c`, radio 56 px, alto 700 px (65 % del alto), pantalla de chat genérico (burbujas verdes/blancas, SIN logo ni marca de WhatsApp).
- Burbujas: radio 28 px, texto Hanken 30 px, solo preguntas (sin precios ni cupos).
- Cursor: 54 px (5 % del alto), entra desde fuera de cuadro, su clic causa lo siguiente en el mismo frame.
- Pin de mapa: 120 px, naranja con borde blanco 6 px; mapa estilizado de CABA (calles como trazos 3 px `#b9dfce`).
- Sello «Residencia Verificada»: el real de la ficha, 1.8× su tamaño.
- Comprobante: el real (`proceso-5-comprobante`), con QR; teléfono de lectura 560 px de alto.

## MOTION
- enter: `power3.out` (cubic-bezier .16,1,.3,1), 18 f. move/cámara: `expo.inOut`, 16 f (0.53 s), con motion blur. exit: `power2.in`, 8 f. Ningún título se mueve después de aterrizar.
- Springs: solo el cursor al hacer clic (amortiguación 0.7, 10 f) y el sello (0.55). Nunca sobre opacidad ni color.
- Escalonado: 4 f entre elementos de un grupo. Algo nuevo cada 2–4 s; nuevo layout cada compás.
- Transiciones (5 tipos, cada una con causa): (1) match cut burbuja→pin; (2) placa de color forestInk barre 14 f; (3) morfing de contenedor botón→tarjeta→comprobante; (4) zoom a través de la pantalla del teléfono hacia el escritorio; (5) corte duro en beat (lectura del QR).

## SHOTS (frames a 30 fps; tiempos de voz se ajustan a la locución real y se re-clavan al compás)
| # | Frames | Mundo | Movimiento héroe | Se lee (ventana) | Sonido | Entrega al siguiente |
|---|---|---|---|---|---|---|
| 1 Hook | 0–150 | M1 | teléfono 700 px sube 40 px en 12 f; 1ª burbuja ya visible en f0 «¿Es como en las fotos?»; 2ª–4ª en f15/30/45 | burbujas: «¿A quién le transfiero?», «¿Hay lugar de verdad?» (≥ 1.5 s cada una) | pop por burbuja; voz 1 desde f12 | la burbuja 1 crece hasta cubrir la pantalla |
| 2 Tensión | 150–330 | M1→mapa | la burbuja se aplasta en pin sobre el mapa de CABA (match cut, 16 f); 3 chats se apilan sin respuesta | «Fotos que no sabés si son de hoy» (título 86 px, «hoy» en naranja) | tic de reloj apagándose | placa forestInk barre |
| 3 Reveal | 330–450 | M3 | el logo real de EstuRed entra por el pin que se vuelve su punto; wordmark se escribe 24 f; ocupa 25 % del ancho | «EstuRed» + «Ya fuimos por vos» | entra la música (compás 6) | zoom a través del logo hacia la ficha |
| 4 Verificada | 450–690 | M2 | ficha real (`ficha-top`) 1.6×, push de cámara 16 f al sello; 4 tildes (identidad, dirección, visita presencial, fotos) uno por beat | «Residencia Verificada» (sello naranja, 3 s) | tick por tilde, sello | el botón «Enviar solicitud» del panel queda al centro |
| 5 Solicitud | 690–930 | M2 | cursor entra, clic en «Enviar solicitud» (`solicitud-panel`, 1.8×); el botón se vuelve tarjeta | «Queda sujeta a confirmación de la residencia» (texto real, 2.2 s) | clic, whoosh corto | la tarjeta viaja a la derecha |
| 6 Familia | 930–1110 | M2 | tarjeta superior «Tu familia te propone esta residencia» (`familia-top`, a verificar); el estudiante aprueba con clic | «La decisión es tuya» (título, «tuya» naranja) | clic | corte lateral 12 f |
| 7 Residencia | 1110–1350 | M2 panel | la tarjeta cae en el panel de la residencia: lista ordenada vs. pila de mensajes que se apaga; 3 filas con estados | «Solicitudes ordenadas, sin mensajes repetidos» | pila de pops → silencio, luego clic | el estado de la tarjeta cambia |
| 8 Condiciones y pagos | 1350–1590 | M2 | 3 piezas separadas aparecen una por compás, cada una con su forma y su ubicación: «Condiciones» (ajuste opcional), «Pago a la residencia», «Fee EstuRed» (`proceso-4-pago`); nunca se funden | «Cada paso, por separado» | clic por pieza | la última pieza se vuelve comprobante |
| 9 Comprobante | 1590–1830 | M2→corte duro | comprobante 1.6×; un teléfono 560 px lo escanea; corte duro en beat a la página pública de verificación | «Comprobante de Reserva Confirmada» + «Verificable con QR» | scan, sello | placa forestInk |
| 10 Soporte y comunidad | 1830–2070 | M2 | `soporte` luego `comunidad-desktop` (1.4×), cursor abre una plaza | «Si algo se traba, Soporte» / «La convivencia también se elige» | clics | placa |
| 11 Cierre | 2070–2400 | M3 | el teléfono del hook vuelve, ahora ordenado, su pantalla se convierte en el logo (25 % del ancho); botón CTA se escribe | CTA (ver decisiones) 2.5 s de hold; «Interfaz ilustrativa» | acorde final, 2 s de cola | fin |

## VOZ Y SUBTÍTULOS
- Locución en español rioplatense (voseo). Guion ~170 palabras (≈ 2.3 pal/s, con pausas), nunca palabra por palabra lo que dice el título en pantalla. Guion definitivo se muestra antes del TTS. Voz gratis: `edge-tts es-AR-ElenaNeural` (como v3); opción de pago HeyGen.
- Subtítulos: un grupo por frase, ≤ 2 líneas, dentro del 80 % title-safe, sincronizados con transcripción de la voz real.
- Palabras prohibidas: «mediación», «garantizamos», «reserva garantizada», «gratis», precios, cupos, nombres de residencias, API de WhatsApp.

## SONIDO
Música original (generada local, sin muestras de terceros): 120 BPM, entra en f330, −16 dB bajo la voz, sidechain 3 dB en cada frase. SFX sobre cada acción visible (pop, clic, tic, sello, scan), −10 dB. Cola de 2 s al final.

## 9:16 (composición propia, mismos tiempos)
Héroe al 80 % del ancho, un elemento por vez, UI 2× más grande, subtítulos entre 62 % y 72 % del alto (fuera de la zona de interfaz de Instagram), contenido dentro del 90 % del alto/ancho.

## BANNED
Los de `spec.md`, más: el mismo círculo de transición en cada escena (como v3); subtítulos que repiten el título; logo de WhatsApp/Instagram; precios, cupos, nombres reales de residencias; «reserva garantizada»; foto de residencia presentada como real si es de seed; tres tarjetas en fila; título sobre captura atenuada; píldoras decorativas; el logo en una esquina.

## QA (frames a mirar con `snapshot --review`)
f0 (hook ya con burbuja), f45 (4 burbujas), f165 (match cut), f390 (logo), f540 (sello), f750 (clic), f1020 (propuesta familiar), f1230 (panel residencia), f1470 (3 piezas separadas), f1710 (QR), f1950 (comunidad), f2200 y f2390 (cierre). En cada uno: texto ≥ 28 px, dentro del 80 %, contraste ≥ 4.5:1, héroe ≥ 40 %, ningún dato inventado.

## Elementos a conseguir (reales, no inventados)
- Logo/wordmark oficial de EstuRed (archivo de marca, no redibujar).
- Capturas faltantes: panel de la residencia con solicitudes (demo, local) y página pública `/verify/[código]`; `familia-top.png` a confirmar. Si no se pueden capturar, se usa placeholder rotulado.
- Fuentes Bricolage Grotesque y Hanken Grotesk como archivos (descarga desde Google Fonts).
