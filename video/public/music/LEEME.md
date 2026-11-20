# Música y narración

## Launch v3

Las composiciones `EstuRed-Launch-*` tienen música electrónica original estéreo a 128 BPM en `public/launch/launch-music.wav`, creada con `scripts/make-launch-music.py`. Voz sintética argentina en ocho MP3 `public/launch/voice-*.mp3`; subtítulos en `public/launch/estured.srt`. La mezcla se realiza en `src/launch/LaunchVideo.tsx`. La música no contiene muestras ni grabaciones de terceros. La grabación de referencia no tenía audio.

## Motion v2

Las composiciones `EstuRed-Motion-*` usan `estured-original.wav`: pista instrumental original sintetizada para el proyecto, 60 s, 120 BPM. Se regenera con `python3 scripts/make-music.py`. No contiene muestras ni grabaciones de terceros. Las indicaciones siguientes corresponden al video original.

El video hoy no tiene audio. Para sumar una pista libre de derechos:

1. Copiarla acá (p. ej. `pista.mp3`).
2. `npx remotion add @remotion/media`
3. En `src/EstuRedVideo.tsx`, descomentar el `<Audio src={staticFile("music/pista.mp3")} volume={0.5} />`.

No usar audio con derechos.
