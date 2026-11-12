# REVIEW — EstuRed Launch (HyperFrames) · 16:9 · 2026-11-10 (v2 tras feedback del dueño)

Estado: **16:9 aprobado (2026-11-11); 9:16 en previsualización; sin render MP4** hasta aprobar el 9:16.

## v2 — feedback del dueño (2026-11-10)
- **Toda la información:** la escena 4 (11 s) suma, después del checklist de verificación, un recorrido por la ficha real: servicios y áreas comunes → reglas de convivencia con «Leer reglamento» → «Tarifas y condiciones» (las 6 tarjetas reales de condiciones de admisión; «Documentos para admisión» se da vuelta con su texto real; el monto del depósito se oculta) → panel real «Filtrar por» del buscador con «Palermo» marcado.
- **Comprobante como momento central:** más grande, con «Válido» que aterriza con peso, fila «Condiciones aceptadas: Registradas», QR escaneado y corte a la verificación pública.
- **Por fuera vs. con EstuRed (anti-bypass), escena nueva:** pantalla dividida que colapsa en «Con EstuRed», con el copy real y aprobado de la home (`WhyEstuRed`): Acuerdos / Reserva confirmada / Si algo no coincide. Soporte vive acá. El pago a la residencia sigue siendo externo (no se dice lo contrario).
- **Comunidad, escena nueva:** página real con sesión iniciada: «35 actuales», reparto por tipo (Individual 8 · Doble 8 · Triple 7…), habitaciones con nombre/edad/carrera, y un perfil abierto (Sobre mí, Intereses, Hábitos). Datos demo ficticios.
- Guion: 5 frases reescritas; 88,5 s, 12 escenas. Música rearmada desde `timeline.json`.

## Decisiones creativas
- Storyline B «Una solicitud, de punta a punta». No construidas: A «Tres preocupaciones, una pantalla» y C «Ya fuimos por vos» (ver `STORYLINES.md`).
- Orden de escenas 5↔6 invertido respecto del SPEC original: la familia **propone** (la estudiante aprueba) y recién después la estudiante **envía** la solicitud; la tarjeta enviada viaja directo al panel de la residencia (cadena objeto a objeto).
- 88,5 s, 12 escenas, 120 BPM. Transiciones (5 tipos con causa): whip (1→2, 4→5, 9→10, 10 interna), iris desde el pin (2→3), zoom a través del ícono (3→4), blur swap (5→6, 7→8), traslado de la tarjeta (6→7), corte duro en beat (9 interna: escaneo → verificación), inundación de color (10→11).
- UI: recortes de capturas reales del dev (`captures/`) + piezas reconstruidas con **etiquetas reales** del código («Enviar solicitud de reserva», «Nueva», «Tenés 48 horas para responder esta solicitud.», «Pendiente/Aprobada», «Cómo viene la solicitud», «Enviaste tu solicitud. / Queda sujeta a confirmación de la residencia.»).
- Solo residencias demo ficticias (Norte, Río de la Plata). Las residencias reales del CRM que hay en el dev (Wanna, La Casa de Cris, Family Home, Sin Fronteras…) no aparecen. Sin precios ni cupos en pantalla. Aviso «Interfaz ilustrativa · residencias y datos de ejemplo» en el cierre.
- El QR del comprobante apunta a https://estured.com (no a un comprobante real).
- Registry usado: `oversized-cursor` (forma y mecánica del cursor), `chat-message` (entrada de burbujas 0,75 → 1 en 0,12 s), `logo-brand-close` (cascada de letras del logotipo). Remotion → HyperFrames: **nivel de conversión: ninguno** (no se portó código de Launch v3; solo se usó como referencia narrativa).

## Qué se midió y qué solo se miró
- `npx hyperframes lint`: 0 errores, 0 avisos. `check --json`: ok, 0 errores.
- `snapshot --review`: hojas de beats, costuras y teléfono revisadas; notas P0/P1 corregidas (fantasma del logo al inicio del cierre, cuadro vacío 6→7, texto partido en «Cómo viene la solicitud», zoom que cortaba el nombre de la ficha, banner familiar ilegible).
- **Audio: medido, no escuchado.** Voz `es-AR-ElenaNeural` (edge-tts), música original sintetizada (numpy, Re mayor, 120 BPM, ducking −7 dB bajo cada frase, pico −1 dBFS), efectos de la librería incluida en HyperFrames. Falta medir loudness del mix final sobre el MP4 (`npx hyperframes audio`).

## Avisos que quedan a propósito
- `text_below_floor` en textos dentro de capturas (sidebar, chips del teléfono) y en la letra chica legal de la solicitud (26 px): son UI real, no texto de lectura principal.
- `line_unread` en las burbujas de «mensajes repetidos» (escena 7): están para leerse como ruido, no una por una; y en la tarjeta de propuesta/checklist, cuyo contenido lo dice la voz.

## Plano más débil y qué cambiaría con más tiempo
- Comunidad (escena 11) sigue siendo captura con cámara; con más tiempo, reconstruiría los perfiles como piezas animadas. La escena 4 es densa (cuatro ideas en 11 s): si se siente rápida, se puede partir en dos.
- La música es sintética: correcta en estructura y niveles, pero no tiene la calidez de una producción real. Alternativa: tema del catálogo de HeyGen o Lyria (requiere plan Pro).

## 9:16 (Instagram) — 2026-11-11
- Subproyecto `vertical/` (index.html propio; `assets` y `compositions` son enlaces al proyecto principal). Escenas en `compositions/v/`, subtítulos en `compositions/captions-v.html`. Misma voz, música, efectos y tiempos que el 16:9 (88,5 s).
- Recompuesto, no recortado: todo texto y producto dentro de la franja 176–1160 px; subtítulos al pie de la franja (termina en 1320 px); debajo de 1330 px solo fondo (ahí Instagram dibuja su propio texto y botones).
- Cambios de puesta: el mapa, la ficha (zoom ×1,3 en servicios/reglamento), condiciones en 2 columnas, banner familiar reconstruido con su copy real, «Cómo viene la solicitud» con la etiqueta debajo, «Por fuera / Con EstuRed» arriba/abajo, comunidad con cámara sobre la captura real.
- `check`: ok, 0 errores. Avisos que quedan: los mismos `line_unread` del 16:9 (la voz los cubre), `text_below_floor` en el banner familiar ya achicado (contexto, no lectura) y un contraste medido durante la entrada de un subtítulo (4,9 s).

## Regenerar
- Voz: `python scripts/make-voice.py` (edge-tts ≥ 7.3). Música: `python scripts/make-music.py`. Root + subtítulos: `python3 scripts/build-root.py` (16:9) y `python3 scripts/build-root.py --vertical` (escribe `vertical/index.html`).
