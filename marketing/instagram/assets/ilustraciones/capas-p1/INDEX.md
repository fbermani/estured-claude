# Capas del reel Post 1 (capas-p1)

Origen: SVG de `../escenas/` (sin IA, a mano). Cada capa tiene `.svg` (fuente editable, lienzo completo 1080x1920, posición 0,0) y `.png` transparente recortado al contenido; x,y es la esquina superior izquierda del PNG en el lienzo 1080x1920. Los fondos (c0) son PNG completos, opacos, en 0,0 y llevan el grano de papel. Orden de apilado: c0 abajo, número mayor arriba (en e4, c5 va sobre c0 y debajo de c1).

| Escena | Archivo (.png y .svg) | Tamaño px | x,y | Nota |
|---|---|---|---|---|
| e1 | `p1-e1-c0-fondo-mapa` | 1080x1920 | 0,0 | opaco, pleno |
| e1 | `p1-e1-c1-cama-valija` | 837x372 | 95,1009 |  |
| e1 | `p1-e1-c2-e1-cuerpo` | 378x779 | 374,582 |  |
| e1 | `p1-e1-c3-celular` | 50x67 | 563,888 |  |
| e1 | `p1-e1-c4-e1-brazo-mano` | 200x210 | 420,774 |  |
| e2 | `p1-e2-c0-fondo` | 1080x1920 | 0,0 |  |
| e2 | `p1-e2-c1-celular` | 680x1340 | 200,300 |  |
| e2 | `p1-e2-c2-chat-1` | 420x94 | 262,420 | entrada escalonada: 1 a 5 |
| e2 | `p1-e2-c2-chat-2` | 400x64 | 420,560 | entrada escalonada: 1 a 5 |
| e2 | `p1-e2-c2-chat-3` | 460x124 | 262,650 | entrada escalonada: 1 a 5 |
| e2 | `p1-e2-c2-chat-4` | 430x94 | 390,830 | entrada escalonada: 1 a 5 |
| e2 | `p1-e2-c2-chat-5` | 360x64 | 262,980 | entrada escalonada: 1 a 5 |
| e2 | `p1-e2-c3-foto-1` | 403x315 | 272,996 | entrada escalonada: 1 a 3 |
| e2 | `p1-e2-c3-foto-2` | 397x310 | 424,1139 | entrada escalonada: 1 a 3 |
| e2 | `p1-e2-c3-foto-3` | 392x298 | 307,1275 | entrada escalonada: 1 a 3 |
| e2 | `p1-e2-c4-mano` | 934x740 | 0,1180 |  |
| e3 | `p1-e3-c0-fondo-mapa` | 1080x1920 | 0,0 |  |
| e3 | `p1-e3-c1-ruta` | 268x283 | 455,511 | path: M464.4 520.4 Q677.2 623.0 722.8 816.8 |
| e3 | `p1-e3-c2-marcadores` | 304x342 | 444,500 |  |
| e3 | `p1-e3-c3-reloj` | 140x162 | 564,388 |  |
| e3 | `p1-e3-c4-valija` | 96x209 | 795,672 |  |
| e4 | `p1-e4-c0-fondo-fachada` | 1080x1920 | 0,0 |  |
| e4 | `p1-e4-c1-sello` | 196x192 | 444,914 |  |
| e4 | `p1-e4-c2-equipo-cuerpo` | 95x353 | 705,1247 |  |
| e4 | `p1-e4-c3-carpeta` | 35x84 | 780,1358 |  |
| e4 | `p1-e4-c4-equipo-brazo` | 29x108 | 777,1321 |  |
| e4 | `p1-e4-c5-puerta-entreabierta` | 200x360 | 440,1200 |  |
| e5 | `p1-e5-c0-fondo-casa` | 1080x1920 | 0,0 |  |
| e5 | `p1-e5-c1-f1` | 408x695 | 589,1225 |  |
| e5 | `p1-e5-c2-e1` | 433x836 | 163,1084 |  |
| e5 | `p1-e5-c3-celular` | 231x406 | 537,934 |  |
| e5 | `p1-e5-c4-e1-brazo-mano` | 172x249 | 511,1277 |  |
| e5 | `p1-e5-m-pantalla-mascara` | 201x366 | 552,954 | auxiliar |
| extra | `p1-textura-grano` | 1080x1920 | 0,0 | opcional |

## Notas
- Verificación: apilando las capas de e1 y e5 se reproduce el compuesto original (diferencia <=3/255). En e2, e3 y e4 el original tenía el grano sobre todo; aquí está solo en el fondo (c0). `p1-textura-grano` (opcional, 55%) permite ponerlo encima de todo.
- e1: la valija (c1) y el celular (c3) se separan del cuerpo; el brazo (c4) va sobre el celular. Zoom 100% a 106% se aplica al conjunto.
- e2: entrada escalonada sugerida: chat 1 a 5, luego foto 1 a 3; la mano (c4) queda arriba. E1 con ceño: usar `../personajes/e1-expresion-ceno`.
- e3: ruta `M464.4 520.4 Q677.2 623.0 722.8 816.8` (origen 464.4,520.4; CABA 722.8,816.8). La valija (c4) ya está en el extremo, 120 px a la derecha de CABA; para animarla sobre la ruta, moverla con offset-path.
- e4: la puerta entreabierta (c5, dibujada nueva, 200x360 en 440,1200) reemplaza la puerta cerrada; el interior es un pasillo mínimo. La persona del equipo es silueta (c2 cuerpo, c3 carpeta, c4 brazo/mano).
- e5: máscara de pantalla `p1-e5-m-pantalla-mascara` (no mostrar). Pantalla de captura: centro 652.5,1137; 178.2x356.4 px; esquinas 19.8; rotación -4 grados. Las capturas C1 a C5 se pegan ahí.

## Escena 7 (último cuadro)
`../escenas/p1-e1-escena-compuesta.png` se puede reutilizar sin cambios: 1080x1920, E1 sentado con valija cerrada, celular y mapa a su espalda con línea punteada a CABA, igual a la escena 1. Para que el loop cierre bien, mostrarlo a escala 100% (sin el zoom). El titular de la escena 1 (centro-arriba) se superpone al cuadro del mapa (y 300 a 700), conviene un velo o subirlo.
