# Video de presentación de EstuRed (Remotion)

Proyecto aislado de la app (su propio `package.json`). Versiones a 30 fps.

## Launch v3 — referencia revisada, narración y subtítulos (2026-11-05)

- **Versión actual:** `EstuRed-Launch-16x9` (1920×1080) y `EstuRed-Launch-9x16` (1080×1920), 71,27 segundos. Preview: `http://localhost:3100/EstuRed-Launch-16x9` y `/EstuRed-Launch-9x16`.
- La grabación aportada se revisó mediante cuadros de los recorridos visuales: órbitas de mensajes, profundidad, acercamientos a interfaces y cambios de escala. No tenía pista de audio.
- Guion basado en `docs/01_PRODUCT_BRIEF.md` y reglas de verificación/reserva de `docs/03_BUSINESS_RULES.md`: estudiante que se muda a CABA, familia que acompaña, comparación a distancia, proceso registrado, comprobante, comunidad y Soporte. Sin garantías de plaza anticipadas ni prioridad de vacantes no implementada.
- Ocho escenas con cambios de encuadre, círculos de transición, interfaces de escritorio y celular, cursores y personajes vectoriales. Las interfaces son ilustrativas; no se inventan precios ni residencias reales.
- Narración sintética argentina `es-AR-ElenaNeural`, obtenida con `edge-tts` (ver [documentación del generador](https://github.com/rany2/edge-tts)). Archivos en `public/launch/voice-*.mp3`. Guion y tiempos en `src/launch/story.json`; subtítulos externos en `public/launch/estured.srt` e integrados en la composición.
- Música original estéreo a 128 BPM, sin muestras de terceros: `public/launch/launch-music.wav`, mezclada a menor volumen bajo la voz. Regeneración: `python3 scripts/make-launch-music.py` (numpy).
- Regenerar voz/subtítulos: instalar `edge-tts` en un entorno Python aislado y ejecutar `scripts/generate-launch-voice.py` desde ese entorno; necesita conexión y usa `afinfo` de macOS para medir duración. Regenerar música después si cambia el guion/duración.
- Validaciones: ESLint + TypeScript + bundle de video; cuadros de las ocho escenas en ambos formatos, con ajustes de márgenes, vista móvil y contraste. Las composiciones anteriores y sus MP4 se conservan. No se ha exportado MP4 de Launch v3.

## Motion v2 — storyboard aprobado el 2026-11-05

- Composiciones nuevas `EstuRed-Motion-16x9` y `EstuRed-Motion-9x16`; las originales se conservan.
- Previsualización: `npm run dev -- --port=3100`, abrir `/EstuRed-Motion-16x9` o `/EstuRed-Motion-9x16` en la URL local.
- Ocho escenas: mensajes, viaje, verificación, búsqueda en familia, reserva/comprobante, comunidad, Soporte y registro.
- Interfaces simbólicas, sin fotografías ni datos de residencias ficticias. El proceso muestra pago a residencia y fee antes de reserva confirmada. Los íconos de comunidad son ilustrativos.
- Música instrumental original a 120 BPM: `public/music/estured-original.wav`. Regenerar con `python3 scripts/make-music.py` (sin dependencias externas).
- Fuente: `src/MotionVideo.tsx`; no cambia las reglas ni los flujos de la app.
- La referencia de YouTube no se pudo reproducir; esta primera versión sigue el brief y el storyboard aprobados, pendiente de cotejo visual con la referencia.
- Validación: lint/TypeScript y bundle del proyecto de video; cuadros de las ocho escenas en ambos formatos en `out/stills/EstuRed-Motion-*`. No se exportó MP4 de esta versión.

- `EstuRed-16x9` (1920×1080) y `EstuRed-9x16` (1080×1920) comparten escenas (`src/scenes/`); el layout se adapta solo.
- Imágenes: capturas reales del dev server con usuarios demo (`public/shots/`) y fotos del seed de Residencia Sin Fronteras (`public/photos/`).
- Música: placeholder, ver `public/music/LEEME.md`.

```bash
npm i
npm run dev                                   # Remotion Studio
npx remotion render EstuRed-16x9 out/estured-16x9.mp4
npx remotion render EstuRed-9x16 out/estured-9x16.mp4
node scripts/stills.mjs 420,1760              # cuadros clave para revisar
```

Nota: el `chrome-headless-shell` que descarga Remotion falla en esta Mac, por eso `remotion.config.ts` usa el Chrome del sistema.
