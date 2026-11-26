# Producción de Instagram: una pieza por chat

Documento vivo, 2026-11-25. Decisión del dueño: guion y producción de cada posteo en chats aparte, uno a uno, con Opus 5.5.

## 1. Cómo trabajar
1. Abrí un chat nuevo en la carpeta de este proyecto.
2. Elegí Opus 5.5 en el selector de modelo. Esfuerzo: alto en las piezas que crean plantillas, medio en el resto.
3. Pegá el pedido de §2 con el código de la pieza.
4. Aprobá el guion antes de producir.
5. Trabajá un chat por vez: comparten carpeta y archivos.

## 2. Pedido para pegar

Empezá por CAP: las demás piezas dependen de las capturas.

```text
Producí la pieza CAP de Instagram de EstuRed.
Leé marketing/instagram/PRODUCCION.md, BRAND_KIT.md, las reglas de GUIONES_Y_POSTS.md §1 y la fuente de esa pieza (tabla de §2).
Primero mostrame el guion final o el plan y esperá mi aprobación. Después producí.
Al cerrar, actualizá el estado en PRODUCCION.md.
No uses el agente ilustrador ni personajes.
```

| Código | Fuente de la pieza |
|---|---|
| CAP | `GUIONES_Y_POSTS.md` §7 |
| HL | `HISTORIAS_DESTACADAS.md` |
| P1 a P3 | `GUIONES_Y_POSTS.md` §4 |
| P4 a P12 | `GUIONES_Y_POSTS.md` §5 |

**CAP escribe datos.** Solo en `estured-dev`, nunca en producción. Sin Sin Fronteras ni residencias del CRM. Fotos propias o autorizadas.

## 3. Qué entrega cada chat

| Pieza | Guion final | Producción |
|---|---|---|
| Carrusel | Texto exacto por diapositiva, texto del post, hashtags (3 a 5), texto alternativo | PNG 1080×1350 |
| Reel | Tabla por segundo, voz, texto en pantalla, sonidos, portada, texto del post, hashtags | MP4 1080×1920 y portada PNG |
| Historias | Texto final, captura, sticker y link por historia | PNG 1080×1920 y portadas |

- Carpeta: `marketing/instagram/produccion/<código>/`, con `guion.md`, fuentes y `export/`.
- Herramienta sugerida para imágenes: HTML con Playwright, como `brand/muestra.html`.
- Herramienta sugerida para reels: Remotion (`video/`). Confirmala en P4.
- Control final: `BRAND_KIT.md` §10 y `GUIONES_Y_POSTS.md` §1.
- Videos: no los subas a git sin acordarlo.

## 4. Orden y estado

| Orden | Código | Pieza | Depende de | Estado |
|---|---|---|---|---|
| 0 | CAP | Residencia de ejemplo y capturas K01 a K19 | Fotos propias o autorizadas | Pendiente |
| 1 | P1 | Carrusel familias. Crea la plantilla de carrusel | CAP | Pendiente |
| 2 | P2 | Carrusel estudiantes | CAP | Pendiente |
| 3 | P3 | Carrusel residencias | CAP | Pendiente |
| 4 | HL | 6 portadas y 29 historias (`HISTORIAS_DESTACADAS.md`) | CAP, validar historias | Pendiente |
| 5 | P4 | Reel filtros. Crea la plantilla de reel y define la voz | CAP | Pendiente |
| 6 | P5 | Carrusel verificación | CAP | Pendiente |
| 7 | P6 | Reel consultas repetidas | P4 | Pendiente |
| 8 | P7 | Reel ficha por dentro | P4 | Pendiente |
| 9 | P8 | Carrusel checklist | CAP | Pendiente |
| 10 | P9 | Reel comunidad | P4 | Pendiente |
| 11 | P10 | Reel lista de espera | P4 | Pendiente |
| 12 | P11 | Carrusel acompañar | CAP | Pendiente |
| 13 | P12 | Carrusel pagos | CAP | Pendiente |

**Para abrir la cuenta hacen falta:** avatar, bio, P1 a P3 y las seis destacadas. Y el popup abierto en producción.

Las historias diarias (`GUIONES_Y_POSTS.md` §6) se producen por semana, después de P4.

## 5. Decisiones pendientes
- Fotos de la residencia de ejemplo (bloquea CAP).
- Voz de los reels: sintética o humana (P4).
- Color de las portadas de destacadas (HL).
- Segundo link «Soy residencia» en la bio.
- Titular de los popups: alinear o no con las portadas.

En el chat de estrategia quedan: métricas, plan de lanzamiento y automatización (`ESTRATEGIA_INSTAGRAM.md` §5).
