# Brand kit de Instagram de EstuRed

Versión 1, 2026-11-25. En validación. Muestra visual: `brand/muestra.html` y `brand/muestra.png`.

Base: los mismos tokens de la app (`app/globals.css`). Una pieza y una captura deben verse como la misma marca.

## 1. Idea de marca

- **Promesa:** elegí tu residencia con todo a la vista.
- **Rasgos:** cercana, clara y seria.
- **Regla central:** el texto tranquiliza a la familia. La imagen entusiasma al estudiante.
- **Material:** capturas reales de la app, tipografía y motion graphics. Sin personajes animados ni ilustraciones de personas.

## 2. Colores

### Primarios
| Nombre | Hex | Uso |
|---|---|---|
| Forest | `#1f7d5c` | Marca, acciones, tildes |
| Forest oscuro | `#0c3a2c` | Fondos de residencias y cierres |
| Crema | `#fbf6ec` | Fondo claro base |
| Tinta | `#1d2722` | Texto principal |

### Secundarios
| Nombre | Hex | Uso |
|---|---|---|
| Naranja | `#c0521d` | Gancho, palabra destacada, fondo de estudiantes |
| Naranja oscuro | `#9a4118` | Texto naranja chico sobre crema |
| Naranja claro | `#ef8551` | Acento solo sobre forest oscuro |
| Dorado | `#e9b84b` | Acento solo sobre forest oscuro |
| Papel | `#fffdf8` | Tarjetas, marcos y texto sobre color |
| Gris texto | `#5f6c65` | Notas y rótulos |

### Apoyo (fondos de etiquetas, nunca base)
| Menta `#d7efe2` | Durazno `#fde1d2` | Manteca `#fbeec3` | Cielo `#d9ebf5` | Lila `#e7e2f8` |
|---|---|---|---|---|

### Color por público
| Público | Fondo de portada | Texto | Acento |
|---|---|---|---|
| Familias | Crema | Tinta | Forest |
| Estudiantes | Naranja | Papel | Manteca |
| Residencias | Forest oscuro | Papel | Dorado |

### Contraste medido
| Combinación | Ratio | Permitido para |
|---|---|---|
| Tinta sobre crema | 14,28 | Todo |
| Papel sobre forest oscuro | 12,47 | Todo |
| Tinta sobre dorado | 8,36 | Todo |
| Dorado sobre forest oscuro | 6,89 | Todo |
| Gris texto sobre crema | 5,10 | Todo |
| Papel sobre forest | 4,98 | Todo |
| Naranja claro sobre forest oscuro | 4,91 | Todo |
| Forest sobre crema | 4,70 | Todo |
| Papel sobre naranja | 4,63 | Todo |
| Naranja sobre crema | 4,37 | Solo titulares de 48 px o más |
| Dorado sobre forest o naranja | menos de 3 | Prohibido |

Proporción por pieza: 60% fondo, 30% texto y capturas, 10% acento.

### Colores que salen
- Arena `#f1d9a8`: se retira. No está en la app.
- Gris `#252A31` y crema `#F0EAE4`: quedan solo dentro del logo y el avatar.
- Portadas de destacadas: propongo cambiar el círculo gris por forest oscuro.

## 3. Tipografía

| Rol | Fuente | Peso |
|---|---|---|
| Titulares y ganchos | Bricolage Grotesque | 800 |
| Apoyo | Hanken Grotesk | 500 |
| Botones, rótulos y números | Hanken Grotesk | 700 |

| Nivel (lienzo de 1080 px) | Tamaño | Interlineado | Límite |
|---|---|---|---|
| Gancho de portada | 104 a 128 px | 1,02 | 10 palabras |
| Titular de diapositiva | 72 a 88 px | 1,08 | 8 palabras |
| Texto cinético en reel | 88 a 120 px | 1,05 | 5 palabras por golpe |
| Apoyo | 40 a 46 px | 1,35 | 25 palabras |
| Rótulo | 34 px | 1,2 | 6 palabras |

- Nunca menos de 34 px.
- Alineá a la izquierda.
- Sin mayúsculas sostenidas, sin signos de exclamación, sin sombras en texto.
- Una sola palabra destacada por titular.

## 4. Grilla y medidas

| Pieza | Lienzo | Zona segura |
|---|---|---|
| Carrusel | 1080×1350 | 90 px por lado |
| Portada en la grilla del perfil | recorte 3:4 | texto dentro de los 1012 px centrales |
| Reel | 1080×1920 | libre: 250 px arriba, 320 px abajo, 120 px a la derecha |
| Portada de reel | 1080×1920 | texto dentro de los 1080×1440 centrales |
| Historia | 1080×1920 | contenido dentro de 1080×1420 |

Verificá recortes en la vista previa de Instagram antes de producir en serie.

## 5. Elementos

| Código | Elemento | Especificación |
|---|---|---|
| E1 | Firma | Logo (`assets/logo/`) arriba a la izquierda, 64 px de alto |
| E2 | Etiqueta de público | Píldora: «Para familias», «Para estudiantes», «Para residencias» |
| E3 | Marco de celular | Genérico, sin marca. Borde tinta de 14 px, radio 64 px |
| E4 | Marco de escritorio | Barra con tres puntos, radio 28 px |
| E5 | Lupa | Recorte ampliado, borde naranja de 6 px, radio 28 px |
| E6 | Resaltador | Bloque de color detrás de una palabra |
| E7 | Rótulo de honestidad | «Así va a funcionar · datos de ejemplo». Obligatorio en capturas |
| E8 | Contador | «2/8» abajo a la derecha |
| E9 | Deslizar | «Deslizá →» abajo, solo en portada |
| E10 | Toque | Círculo con onda donde se toca la pantalla |
| E11 | Cierre | Botón píldora naranja o dorado y «Link en la bio» |

- Radios: tarjetas 48 px, interiores 28 px, píldoras completas.
- Sombras cálidas (tinta al 16%), nunca negras.
- Íconos: Material Symbols Outlined, los de la app.
- Sin degradados de lavado, sin emojis dentro de las piezas, sin fotos de banco.

## 6. Plantillas

| Código | Plantilla | Composición |
|---|---|---|
| T1 | Portada fijada | Color del público, etiqueta, gancho grande, captura cortada abajo, «Deslizá →» |
| T2 | Portada de dolor | Crema, pregunta grande, palabra en naranja, captura chica |
| T3 | Portada de función | Captura protagonista con lupa y gancho arriba |
| T4 | Captura y titular | Titular arriba, apoyo, captura en marco, rótulo |
| T5 | Lista | Titular y hasta 4 renglones con ícono |
| T6 | Cierre | Una sola acción |
| T7 | Cuadro de reel | Captura a pantalla, texto cinético arriba, rótulo abajo |
| T8 | Historia | Captura, una frase y espacio libre para el sticker |

## 7. Movimiento (reels)

- Cambiá de plano cada 2 a 3 segundos.
- **Entrada:** 250 ms, `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Transición:** 400 ms, `cubic-bezier(0.22, 0.61, 0.36, 1)`.
- **Zoom:** de 1,0 a 1,8 en 600 a 900 ms. Terminá siempre sobre el dato que nombra la voz.
- **Alejamiento:** mostrá la pantalla completa después de cada detalle.
- **Texto cinético:** palabra por palabra, 70 ms de desfase.
- **Lectura:** cada frase queda 1,2 s más 0,3 s por palabra.
- Animá solo posición, escala, giro y opacidad.
- Capturá en 3x para que el zoom no pixele.

## 8. Sonido

| Momento | Sonido |
|---|---|
| Toque en pantalla | Clic suave |
| Cambio de plano | Soplido corto |
| Aparición de etiqueta | Golpe sordo breve |
| Sello de verificación | Campanilla de dos notas |
| Fondo | Música instrumental, 100 a 115 pulsos por minuto |

- Voz en primer plano. Música 18 dB por debajo.
- Mezcla final cerca de -14 LUFS.
- Usá solo audio propio o con licencia. El audio de tendencia se agrega desde Instagram.
- Subtítulos siempre. El reel debe entenderse sin sonido.
- Voz: `es-AR-ElenaNeural` o voz humana. Falta elegir.

## 9. Tono por público

| Público | Cómo hablar | Verbos | Ejemplo |
|---|---|---|---|
| Familias | Calma, empatía y pasos concretos | acompañar, revisar, conversar, seguir | «Vos acompañás. La decisión es de tu estudiante.» |
| Estudiantes | Corto, activo y visual | filtrar, mirar, elegir, sumarte | «Filtrá, mirá y elegí.» |
| Residencias | Concreto y centrado en tiempo | publicar, ordenar, avisar, compartir | «Tu ficha responde lo de siempre.» |

| Usá | No uses |
|---|---|
| Sumate gratis | Reservá ya |
| Visitada en persona | 100% segura, garantizada |
| Solicitud sujeta a confirmación | Reserva asegurada |
| Soporte | Mediación |
| Fee EstuRed (5%) | Comisión |
| Residencias fundadoras | Pioneras, beta |

Excepción registrada: la bio usa «Reservá» (`ESTRATEGIA_INSTAGRAM.md` §2).

## 10. Control antes de publicar

1. ¿La portada se lee en miniatura?
2. ¿Las capturas llevan el rótulo E7?
3. ¿Hay precios, nombres, contadores de resultados o datos personales visibles?
4. ¿Cada afirmación cumple las reglas de veracidad (`GUIONES_Y_POSTS.md` §1)?
5. ¿El contraste figura como permitido en §2?
6. ¿Hay una sola acción?
