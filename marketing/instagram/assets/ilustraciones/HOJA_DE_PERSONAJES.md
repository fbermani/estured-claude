# Hoja de personajes (fuente de verdad del estilo)

Reparto fijo de `GUIONES_Y_POSTS.md` §A3. Ninguna pieza cambia un rasgo fijo sin actualizar primero esta hoja.

## Estilo (propuesta, a confirmar por el dueño)

- 2D plano, formas simples, sin contorno. Basado en el estilo **A. Plano con textura** del boceto `bocetos/duo-tres-estilos-v1` (el recomendado), con un ajuste: **cabeza más chica** (unas 6 cabezas de alto) para que se lea joven-adulto y no infantil.
- Ojos de punto, cejas en trazo redondeado, boca mínima que no se mueve (pantomima: el personaje no habla).
- Sin sombras duras ni degradados. La textura de papel va en el fondo de cada pieza, no en el personaje (más simple de animar).
- Colores definidos como clases CSS en el `<style>` de cada SVG: se cambian en un solo lugar.

## E1 — estudiante protagonista (master v1)

| Rasgo fijo | Definición |
|---|---|
| Edad y lectura | 18 a 24 años; proporción adulta, postura erguida, tono serio y cálido |
| Peinado | Rulos oscuros cortos, con volumen arriba y costados cortos |
| Piel | Morena media `#b97a4f` |
| Prenda principal (siempre la misma) | Campera parka **forest** `#1f7d5c` hasta la cadera, cierre central, cuello alto en forest oscuro `#0c3a2c` |
| Pantalón | Gris azulado `#2f3b45` (de la paleta del logo) |
| Calzado | Zapatillas tinta `#1d2722` |
| Mochila | Ocre `#d8b06a`, siempre puesta en la espalda (de frente se ven las dos tiras) |
| Objeto característico | **Valija** de cabina forest oscuro `#0c3a2c` con dos bandas arena `#f1d9a8` y manija extensible |
| Señas de silueta | Masa de rulos arriba + campera recta tipo parka + valija con manija alta al costado |

- Master: `personajes/e1-master.svg` (+ `.png`). Vistas: frente y 3/4, fondo crema liso.
- Grupos con nombre en el SVG: `cabeza`, `pelo`, `ojos`, `cejas`, `boca`, `torso`, `brazo-izq`, `brazo-der`, `pierna-izq`, `pierna-der`, `mochila`, `valija` (izquierda y derecha son del personaje).
- Control de calidad (2026-11-12): silueta en negro sólido reconocible (rulos + parka + valija; en 3/4 también la mochila); prueba de un segundo OK en miniatura de 300 px.
- **Master aprobado por el dueño (2026-11-12):** estilo plano sin contorno, campera forest, rulos.
- Poses dibujadas (post 1, a revisar): `e1-pose-sentado-celular` (escena 1, sentado al borde de la cama con la valija al lado) y `e1-expresion-ceno` (escena 2, primer plano con el ceño fruncido, preocupado y no enojado).
- Pose dibujada (post 1, escena 5, a revisar): `e1-f1-pose-pantalla`, los dos de espaldas mirando el celular que sostiene E1; la pantalla (`#pantalla-captura`) queda libre para pegar C1/C2.
- Poses del post 3 aprobadas por el dueño (2026-11-12): `e1-pose-entrando-valija` (escena 1, camina tirando de la valija), `e1-pose-cerrando-puerta` (escena 3, de espaldas empuja la puerta de su cuarto), `e1-e2-pose-saludo` (escena 3, los dos se saludan con la mano) y `e1-r1-pose-conversando` (escena 4, sentados a una mesa con la carpeta del reglamento entre los dos y una laptop grafito abierta hacia R1, sin logo ni pantalla visible). QA: miniatura de 300 px y silueta OK.
- Poses de los carruseles (posts 2 y 4) aprobadas por el dueño (2026-11-12): `e1-pose-laptop` (de pie, sostiene la laptop abierta con un brazo; solo se ve el dorso de la tapa) y `e1-pose-celular` (de pie, mira el celular a la altura del pecho; solo se ve el dorso). En el post 2, diapositiva 7, se reutiliza `e1-f1-pose-pantalla`. QA: miniatura y silueta OK (el celular sobresale del torso).
- Runware: probado el 2026-11-12, la cuenta no tiene crédito; el dueño decidió seguir sin IA.
- IA en su producción: no (SVG dibujado a mano).

## E2 — compañero o compañera de residencia

Compañera, misma edad que E1. Aparece en el post 3 (cocina común, saludo con E1).

**Master aprobado por el dueño (2026-11-12).**

| Rasgo fijo | Definición (master v1) |
|---|---|
| Edad y lectura | 18 a 24 años, misma altura que E1, postura relajada |
| Peinado | Cola de caballo alta, lacia y larga, negra `#1a1412`, con gomita terracota |
| Piel | Morena oscura `#8a5638` (distinta de E1 y F1) |
| Prenda principal (ropa de casa) | Buzo con capucha amplio terracota `#c0603f`, bolsillo canguro y cordones crema |
| Pantalón y calzado | Pantalón ancho caqui `#a8946e`, zapatillas claras `#f3ead8` con suela tinta |
| Objeto característico | Auriculares de vincha al cuello, tinta, sin marca |
| Señas de silueta | Cola de caballo que sobresale + buzo en caja + pierna ancha |

- Terracota en vez de la mostaza propuesta antes: la mostaza quedaba demasiado cerca del ocre de la mochila de E1, y la terracota contrasta con el forest de E1 cuando aparecen juntos.
- Master: `personajes/e2-master.svg` (+ `.png`), mismos grupos con nombre que E1, más `auriculares`.
- Poses dibujadas: `e1-e2-pose-saludo` (post 3, escena 3).
- Control de calidad (2026-11-12): en negro sólido se distingue de los otros tres (la cola de caballo y el buzo en caja); prueba de un segundo OK a 420 px.
- IA en su producción: no.

## F1 — familiar adulto a distancia

Solo acompaña, nunca decide: nunca sostiene el celular de E1 ni señala por él; mira, escucha, acompaña.

**Master aprobado por el dueño (2026-11-12).**

| Rasgo fijo | Definición (master v1) |
|---|---|
| Edad y lectura | Adulta de 45 a 55 años, postura tranquila, un poco más baja que E1 |
| Peinado | Melena lacia a la mandíbula con flequillo de costado, castaño `#4a3a30` con un mechón de canas `#a3958a` |
| Piel | Trigueña clara `#d39a72` (distinta de E1 para que el dúo no se confunda) |
| Anteojos | Redondos, de marco fino tinta: seña de silueta y de edad |
| Prenda principal (ropa de casa) | Cárdigan largo abierto gris azulado `#6f8290` sobre remera crema `#f3ead8` |
| Pantalón y calzado | Pantalón marrón `#5a4a42`, chatitas `#3d2f29` |
| Objeto característico | Mate con bombilla (sin marca), en la mano |
| Señas de silueta | Melena en bloque redondeado + anteojos + cárdigan largo hasta la cadera + mate |

- Master: `personajes/f1-master.svg` (+ `.png`), mismos grupos con nombre que E1, más `anteojos` y `mate`.
- Control de calidad (2026-11-12): silueta reconocible y distinta de E1 (melena en bloque frente a rulos; cárdigan largo frente a parka); en la escena 5 se distinguen los dos en negro sólido.
- Poses dibujadas: `e1-f1-pose-pantalla` (post 1, escena 5; se repite en el post 2, diapositiva 7). En el post 4, diapositiva 3, va de pie con el mate al costado del celular grande, mirándolo sin tocarlo (vista de tres cuartos del master, con la cabeza apenas inclinada).
- IA en su producción: no.

## R1 — responsable de residencia

Adulto que gestiona la residencia. Aparece en el post 3, conversando con E1 con el reglamento sobre la mesa. Habla de igual a igual: no reta ni señala.

**Master aprobado por el dueño (2026-11-12).**

| Rasgo fijo | Definición (master v1) |
|---|---|
| Edad y lectura | Adulto de 40 a 50 años, un poco más alto y ancho de hombros que E1, postura tranquila |
| Peinado | Pelo corto entrecano `#6b625c` y barba corta `#5c544e` |
| Piel | Trigueña `#c98b62` |
| Prenda principal | Camisa celeste `#9fbcd0` con mangas arremangadas y cuello claro (camisa y no cárdigan, para no repetir a F1) |
| Pantalón y calzado | Pantalón gris oscuro `#3d3a36`, cinturón `#3a2a20`, zapatos marrones `#5a3d2b` |
| Objeto característico | Carpeta verde `#2f6b5a` con hojas crema (el reglamento), sin texto |
| Señas de silueta | Cabeza redonda con barba + hombros anchos + carpeta al costado |

- Master: `personajes/r1-master.svg` (+ `.png`), mismos grupos con nombre que E1, más `barba` y `carpeta`.
- Poses dibujadas: `e1-r1-pose-conversando` (post 3, escena 4; la carpeta va sobre la mesa).
- Control de calidad (2026-11-12): en negro sólido se distingue de E1 (cabeza lisa frente a rulos, más alto, carpeta); prueba de un segundo OK a 420 px.
- IA en su producción: no.

## Escenas y fondos (posts 1 y 3, aprobados por el dueño el 2026-11-12)

Formato reel 1080×1920, con la textura de papel en el fondo (filtro `#papel`, encima del fondo y debajo de los personajes). Todo en `escenas/`, SVG + PNG. Cada elemento que se anima (burbujas, fotos, ruta, reloj, valija, sello, persona del equipo, íconos) es un grupo con nombre. Los titulares se agregan en la edición: ninguna imagen lleva texto.

| Archivo | Post y escena | Qué es |
|---|---|---|
| `p1-e1-fondo-pieza` | 1 · 1 | Pieza de E1: ventana con luz de tarde y mapa enmarcado con la ruta |
| `p1-e2-celular-chats` | 1 · 2 | Celular en primer plano con chats sin texto y tres fotos de cuartos |
| `p1-e3-mapa` | 1 · 3 | Argentina (con Malvinas), ruta punteada desde una provincia del norte sin nombrar hasta CABA, reloj y valija |
| `p1-e4-fachada` | 1 · 4 | Residencia genérica sin nombre, sello de la casa del logo con tilde y persona del equipo en silueta con carpeta |
| `p1-e5-fondo-casa` | 1 · 5 | Sala de la casa de E1 (ventana, repisa, lámpara) |
| `p3-e1-fondo-habitacion` | 3 · 1 | Habitación vacía: puerta al pasillo, escritorio, ventana, cama sin hacer |
| `p3-e2-calendario` | 3 · 2 | Calendario sin números con llegada y primer día de clases pegados; íconos de valija, trámite y cansancio |
| `p3-e3-fondo-cuarto` | 3 · 3 | Pared del cuarto para la pose de la puerta |
| `p3-e3-cocina` | 3 · 3 y 4 | Cocina común ordenada |
| `p3-e4-cocina-platos` | 3 · 4 | La misma cocina con platos acumulados y burbuja de queja sin texto |
| `p3-e5-libro` | 3 · 5 | Fondo forest oscuro con libro abierto y la marca de EstuRed |

- Vistas previas compuestas (fondo + pose, escala 0,9): `p1-e1`, `p1-e5`, `p3-e1`, `p3-e3a`, `p3-e3b`, `p3-e4b` con el sufijo `-escena-compuesta`. Sirven de referencia de encuadre; para animar se usan las capas por separado.
- No se dibujaron (son de edición o usan capturas): escena 6 y cierre del post 1 (capturas C3/C5, botón «Sumate gratis»), y la portada de cada reel.
- QA: hojas de contacto en miniatura (360 px de ancho) legibles; se movió el sello de la fachada para no tapar la puerta y se quitó la planta de la ventana de la cocina, que competía con el saludo.
- IA en su producción: no.

## Carruseles (posts 2 y 4, aprobados por el dueño el 2026-11-12)

Formato 1080×1350, misma textura de papel. Todo en `escenas/`, SVG + PNG. El titular, el apoyo, el logo chico y el número de diapositiva van en la plantilla: ninguna imagen lleva texto. La zona de arriba (hasta y ≈ 520) queda libre para el texto; la ilustración ocupa de y ≈ 540 a 1260 (márgenes de 90 px).

| Archivo | Diapositiva | Qué es |
|---|---|---|
| `p2-d1-portada` | 2 · 1 | Fondo forest; E1 con laptop sobre círculo arena, tarjeta con tres casillas tildadas y botón de deslizar |
| `p2-d2-prioridades` | 2 · 2 | Cinco íconos en fila: billete sin monto, reloj, cama, puerta, escritorio |
| `p2-d3-recorrido` | 2 · 3 | Plano de barrio sin nombres con dos recorridos (colectivo y subte) hasta una sede sin nombre |
| `p2-d4-plano` | 2 · 4 | Plano de residencia: habitaciones privadas en arena y espacios compartidos en verde claro |
| `p2-d5-reglamento` | 2 · 5 | Documento con broche y seis renglones tildados |
| `p2-d6-costo-total` | 2 · 6 | Hoja con el signo pesos, seis renglones con montos vacíos y un total vacío |
| `p2-d7-desde-lejos` | 2 · 7 | E1 y F1 de espaldas miran juntos el celular (pantalla libre) |
| `p2-d8-checklist` | 2 · 8 | Seis casillas tildadas en dos columnas (x 90 y 560; y 600, 790 y 980; 76 px) |
| `p2-d9-cierre` | 2 · 9 | Forest oscuro, logo grande y marcador |
| `p4-d1-portada` | 4 · 1 | Fondo forest; E1 con celular y cinco puntos unidos que suben hasta un tilde |
| `p4-celular` | 4 · 2, 4, 5 y 6 | Celular de frente sin marca; `#pantalla-captura` de 310×671 (proporción 390×844) para C1, C3, C4 y C5 |
| `p4-d3-celular-f1` | 4 · 3 | El mismo celular con F1 al costado, para C2 |
| `p4-d7-cierre` | 4 · 7 | Forest oscuro y logo grande |

- Las capturas C1 a C5 y el resaltado en forest de los bloques de C4 se hacen en la edición, sobre la captura (regla A5).
- QA: hoja de contacto a 360 px legible; se movió F1 fuera del celular y se quitó una ventana en la diapositiva 2·7 que competía con el celular.
- IA en su producción: no.
