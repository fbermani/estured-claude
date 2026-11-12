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
- Poses dibujadas (post 3, 2026-11-12, a revisar): `e1-pose-entrando-valija` (escena 1, camina tirando de la valija), `e1-pose-cerrando-puerta` (escena 3, de espaldas empuja la puerta de su cuarto), `e1-e2-pose-saludo` (escena 3, los dos se saludan con la mano) y `e1-r1-pose-conversando` (escena 4, sentados a una mesa con la carpeta del reglamento entre los dos). QA: miniatura de 300 px y silueta OK.
- Poses pendientes: posts 2 y 4 según la lista de cada guion.
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
- Poses dibujadas: `e1-f1-pose-pantalla` (post 1, escena 5).
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
