# Guiones y textos de los posts (versión de producción)

Documento vivo. Orden y criterio: `ESTRATEGIA_INSTAGRAM.md` §4. Esta versión reemplaza a la anterior: cada pieza trae todo lo necesario para recrearla en cualquier herramienta de imagen, animación o video (todavía sin definir): qué se ve, qué se lee, qué se dice, cuánto dura y qué no puede aparecer.

Cómo se usa:
1. §A es la **biblia de producción común**: medidas, marca, personajes, capturas, audio, reglas. Se lee una vez.
2. Cada post (§B a §E) tiene su **ficha**: objetivo, gancho elegido, guion o diapositivas, portada, texto del post, accesibilidad y chequeo. Las historias de apoyo están en §F.
3. §G tiene la lista de entrega y los pendientes.

Estado: posts 1 a 4 (tanda de apertura) reescritos, en validación.

---

## A. Biblia de producción (común a todas las piezas)

### A1. Formatos y medidas
| Pieza | Medida | Notas |
|---|---|---|
| Reel | 1080×1920 (9:16), 30 fps, MP4 H.264, audio AAC | Duración según ficha. Zona segura: dejar libres 250 px arriba y 250 px abajo (contenido clave dentro de 1080×1420) y 120 px a la derecha, donde van los botones de Instagram |
| Portada del reel | 1080×1920; el texto debe leerse recortado al centro 4:5 (1080×1350) | Se elige al publicar y no se puede editar después |
| Carrusel | 1080×1350 (4:5), PNG, todas las diapositivas iguales | Márgenes de 90 px; número de diapositiva fijo abajo a la derecha |
| Historia | 1080×1920; contenido clave dentro de 1080×1420 | Cada tramo de video, de hasta 15 s; imágenes fijas se ven unos 5 s |

Nota: las medidas de zonas seguras pueden cambiar con la interfaz de Instagram; revisar una vez antes de producir en serie.

### A2. Marca (para recrear cualquier pieza)
- **Colores:** forest `#1f7d5c` (portadas y acentos), forest oscuro `#0c3a2c` (fondos oscuros), crema `#fbf6ec` (fondos claros), tinta `#1d2722` (texto), arena `#f1d9a8` (detalle decorativo, nunca para texto). Logo: fondo oscuro `#252A31` con crema `#F0EAE4`.
- **Tipografías:** Bricolage Grotesque 800 en titulares; Hanken Grotesk en texto de apoyo (son las de la web, `app/layout.tsx`). Tres pesos como máximo por pieza.
- **Texto:** contraste mínimo 4,5:1; titular de 70 a 96 px; apoyo de 38 a 46 px; nunca menos de 34 px. Sin mayúsculas sostenidas, sin signos de exclamación.
- **Un acento por diapositiva:** una sola palabra o cifra en forest o arena. Sin degradados de lavado. Esquinas redondeadas parejas (radio único).
- **Logo:** la casa con R y cama (`assets/logo/`) como firma pequeña en la esquina superior izquierda de las diapositivas y en el cierre de los reels. No es protagonista.

### A3. Personajes (ilustrados, sin definir el estilo de dibujo)
El estilo y la herramienta de producción todavía no están elegidos. Mientras tanto, este es el **reparto fijo** para que cualquier herramienta mantenga consistencia. Cuando se elija el estilo, se completa la hoja de cada uno.

| Código | Quién es | Rasgos fijos a definir | Aparece en |
|---|---|---|---|
| E1 | Estudiante del interior, 18 a 24 años. Protagonista | Peinado, color de abrigo, mochila, valija | Posts 1 a 4 |
| E2 | Compañero o compañera de residencia, misma edad | Peinado y ropa distintos a E1 | Post 3 |
| F1 | Familiar adulto que acompaña a distancia | Cabello, ropa de casa | Posts 1, 2 y 4 (solo acompaña, nunca decide) |
| R1 | Responsable de residencia, adulto | Camisa o cardigan, carpeta | Post 3 |

Reglas de consistencia:
- Misma paleta de ropa en todas las piezas; E1 usa siempre la misma prenda principal.
- Cada herramienta debe entregar a cada personaje en las poses que pide la ficha (lista en cada guion).
- Sin marcas de terceros: ni logos de WhatsApp o Instagram, ni marcas de ropa. Los chats se dibujan con burbujas genéricas.
- Sin texto legible en fondos (carteles, pantallas), salvo el que pida la ficha.
- Sin retratos de personas reales. Familiar y estudiante: nunca infantilizar; el familiar no toma decisiones por el estudiante.

### A4. Escenarios y elementos reutilizables
- **Pieza de E1 en su ciudad:** cuarto con cama, ventana y valija cerrada; luz cálida.
- **Habitación vacía en residencia:** cama sin hacer, ventana, escritorio, valija en la entrada.
- **Cocina común:** mesada, heladera, una pila de platos; versión tranquila (limpia, dos personas conversando).
- **Mapa:** silueta simple de Argentina con línea punteada de una provincia (sin nombrar cuál) hasta Buenos Aires (CABA marcada).
- **Casa del logo con tilde:** íconos de verificación; la misma casa se repite en los reels.
- **Celular:** dibujado de frente, sin marca; en él se reproducen las capturas de la app.

### A5. Capturas de la app (regla central)
**Las capturas que hay en `public/landing/proceso-1…5` NO se pueden usar:** muestran nombres de residencias, precios en USD y ARS, el nombre de un estudiante y números de comprobante.

Cómo se obtienen las capturas válidas:
1. Capturar en el servidor de desarrollo (datos demo, nunca producción), en viewport de celular de 390×844 a 3x, PNG.
2. Antes de capturar, usar una residencia demo con nombre neutro ("Residencia" en el título). Si no es posible, difuminar en la edición.
3. **Siempre difuminar o tapar con barra:** nombres de residencias, todos los precios (USD y ARS), nombre del estudiante, número de comprobante, fecha de ingreso y tipo de cambio. El barrio puede quedar visible.
4. Para reels: grabación de pantalla vertical del flujo (mejor) o capturas fijas con zoom lento. Mostrar el cursor o el toque con un círculo.
5. Cada captura va dentro del celular dibujado o sobre fondo crema con esquinas redondeadas, nunca a pantalla completa sin marco.

Capturas a producir (se reutilizan en reel 1, carrusel 4 e historias):
| Código | Pantalla | Qué debe verse | Qué se oculta |
|---|---|---|---|
| C1 | Búsqueda | Filtros (universidad, barrio, tipo de habitación, precio, servicios), sello "Residencia Verificada", etiqueta "Disponibilidad informada" y el aviso "Requiere confirmación al solicitar" | Nombres y precios de las tarjetas |
| C2 | Ficha y solicitud | Selector de tipo de habitación y botón de solicitar | Nombre y tarifas |
| C3 | Seguimiento de la solicitud | Pasos completados | Nombre de la residencia |
| C4 | "Qué pagás y a quién" | Dos bloques: "A la residencia" y "A EstuRed: fee (5%)"; el texto "solo se abona si la residencia confirma la reserva" | Todos los montos (reemplazar por barras) |
| C5 | Comprobante de Reserva Confirmada | Título, sello "Válido", estructura de filas | Nombre, residencia, fechas, tarifas, número |

### A6. Voz, audio y subtítulos
- **Voz en off:** castellano rioplatense, neutra y tranquila, ritmo de unas 2,8 palabras por segundo. Referencia ya usada: voz sintética argentina `es-AR-ElenaNeural` (ver `video/README.md`); la voz definitiva se elige en producción. Si la voz es sintética, ver A8.
- **Música:** instrumental original, sin samples de terceros (`video/public/launch/launch-music.wav`, 128 BPM, o equivalente). Siempre por debajo de la voz. Se evita audio en tendencia: si se quiere uno, se agrega a mano dentro de Instagram.
- **Efectos:** sonidos suaves de interfaz (toque, tilde, deslizamiento). Nada de sonidos dramáticos.
- **Subtítulos:** siempre quemados en la imagen, reproducen la voz en off palabra por palabra, una a dos líneas, en la franja y entre 1250 y 1500 px de altura. El **titular** va aparte, en la franja entre 300 y 800 px, y es una frase corta, no la voz entera.
- Toda pieza debe entenderse **sin sonido**: titular y subtítulos cuentan la historia completa.
- Tiempo mínimo de lectura de un texto en pantalla: 1 segundo cada 3 palabras, más 0,5 s.

### A7. Movimiento (para animar)
- Corte o transición cada 2 a 4 segundos; ninguna escena de más de 6 s.
- Entrada de texto: aparece con fundido y desplazamiento de 20 px en 0,3 s. Salida: fundido de 0,2 s.
- Entre escenas: deslizamiento lateral de 0,3 s o corte seco en el golpe de la música; sin giros ni efectos de video.
- Animar solo posición, escala y opacidad.
- Zoom lento sobre las capturas: de 100% a 110% en la duración de la escena.

### A8. Divulgación de IA, accesibilidad y chequeo legal
- Si las imágenes o la voz se generan con IA y parecen reales, marcar el contenido como generado con IA en Instagram (es manual). Los personajes ilustrados no se confunden con personas reales, pero conviene dejarlo declarado si la voz es sintética.
- **Texto alternativo** en cada imagen publicada (cada ficha lo trae).
- **Líneas rojas, siempre:** no mostrar ni nombrar residencias; no mostrar precios; no mencionar Sin Fronteras; decir "EstuRed verifica residencias", nunca personas; no decir "reserva garantizada, asegurada o inmediata"; no decir "mediación" (decir "Soporte"); decir "fee EstuRed (5%)", no "comisión"; no decir "pioneras", "beta" ni "MVP".
- **Afirmaciones que deben ser ciertas el día que se publican:** "visitadas en persona" (visita presencial antes de publicar, `docs/03` §5.2 y `docs/19` §6.6) y "verificada" (identidad, ubicación y fotos revisadas; **no** garantía legal ni de calidad). Si el catálogo todavía no tiene residencias verificadas en persona, ajustar el texto antes de publicar.
- "Reservá" está en la bio como riesgo aceptado (estrategia §2). En estas piezas la solicitud siempre va "sujeta a confirmación".

---

## B. Post 1: Reel fijado, presentación (35 s)

**Objetivo:** que alguien que nunca escuchó de EstuRed entienda en 35 segundos qué es y qué hacer.
**Envío:** estudiante del interior se lo manda a la persona de la familia que le ayuda a buscar; familiar se lo manda al estudiante.
**Idea única:** elegir residencia desde otra ciudad es posible porque las residencias se visitan en persona antes de publicarse y todo el proceso queda registrado.
**Audio:** voz en off + música original baja. **Prueba (Trial Reel):** no; la cuenta es nueva y sin seguidores. Publicar normal y fijar al perfil.

### Gancho (tres alternativas, elegida la 1)
| # | Mecanismo | Texto | Resultado |
|---|---|---|---|
| 1 | Pregunta con tensión real | "¿Cómo elegís una residencia en Buenos Aires sin poder ir a verla?" | **Elegida.** Abre una brecha concreta para quien no puede viajar y el reel la responde. Lleva las palabras clave "residencia" y "Buenos Aires" |
| 2 | Llamado al público | "Si sos del interior y estudiás en Buenos Aires, mirá esto." | Clara, pero no abre una pregunta |
| 3 | Disonancia | "Vas a vivir solo en otra ciudad. ¿Elegís por una foto?" | Fuerte, pero más cercana al miedo que al hecho |

### Versión muda (lo que se lee sin sonido)
1. ¿Cómo elegís residencia en Buenos Aires sin poder ir a verla? → 2. ¿Fotos y chats? → 3. Viajar antes no siempre se puede → 4. Visitadas en persona → 5. Compará desde donde estés → 6. Solicitar es gratis. Cada paso queda registrado → 7. Sumate gratis.

### Guion de producción
| # | Tiempo | Visual (qué se ve) | Titular (en pantalla) | Voz en off (= subtítulos) | Audio y transición |
|---|---|---|---|---|---|
| 1 | 0,0–4,0 | E1 sentado en su pieza (A4), valija cerrada a un costado, mira su celular. A su espalda, un mapa con línea punteada hasta CABA. Cámara fija con zoom lento de 100% a 106% | "¿Cómo elegís residencia en Buenos Aires sin poder ir a verla?" (centro-arriba, aparece desde el primer fotograma) | "¿Cómo elegís una residencia en Buenos Aires… sin poder ir a verla?" | Música entra desde el segundo 0. Corte seco al golpe |
| 2 | 4,0–9,0 | Primer plano del celular de E1: burbujas de chat genéricas y fotos de habitaciones (siluetas de cuartos, sin texto) que se superponen y empujan unas a otras. E1 frunce el ceño | "¿Fotos y chats?" | "Las fotos y los chats no alcanzan para decidir dónde vas a vivir." | Efecto de deslizamiento lateral |
| 3 | 9,0–13,0 | Mapa a pantalla completa: línea punteada de provincia a CABA, reloj y ruta que se alargan. Ícono de valija en el extremo | "Viajar antes no siempre se puede" | "Y viajar antes a verlas todas no siempre se puede." | Corte seco |
| 4 | 13,0–19,0 | Fachada simple de una residencia (genérica, sin nombre). Una persona del equipo de EstuRed (silueta con carpeta, sin rostro definido) entra y recorre el pasillo. Aparece la casa del logo con tilde sobre la puerta | "Visitadas en persona" | "Por eso en EstuRed las residencias se visitan en persona antes de publicarse." | Sonido suave de tilde cuando aparece el sello |
| 5 | 19,0–26,0 | Celular con C1 (búsqueda) y luego C2; zoom lento. F1 aparece a un costado, mirando con E1 (los dos, de espaldas o de perfil) | "Compará desde donde estés" y, a los 5 s, "La decisión es tuya" | "Comparás ubicación, servicios y reglas desde tu casa, con tu familia si querés. La decisión es tuya." | Deslizamiento lateral al cambiar de captura |
| 6 | 26,0–31,5 | Celular con C3 y luego C5. Pasos que se tildan uno a uno | "Solicitar es gratis" y luego "Cada paso queda registrado". Texto pequeño abajo: "Solicitud sujeta a confirmación de la residencia" | "Enviás tu solicitud sin costo, seguís cada paso y todo queda registrado." | Sonido suave de tilde por cada paso |
| 7 | 31,5–35,0 | Fondo forest oscuro. Logo EstuRed grande y centrado. Debajo, el botón dibujado "Sumate gratis". El último fotograma vuelve a la composición de la escena 1 (E1 en su pieza) | "Sumate gratis" y "Link en la bio" | "Sumate gratis desde el link en la bio." | Música baja. El corte del loop une el final con la pregunta del comienzo |

**Poses de personajes pedidas:** E1 sentado con celular (escena 1); E1 con el ceño fruncido (escena 2); E1 y F1 de perfil frente a una pantalla (escena 5).
**Gatillo de rewatch:** el cierre vuelve a la imagen y la pregunta del inicio; quien mira de nuevo ya conoce la respuesta.

**Portada:** fondo forest. Titular "Elegir residencia a distancia" en el centro (dentro del recorte 4:5). Logo pequeño abajo a la izquierda. Sin personajes en la portada.

**Texto del post:**
> ¿Cómo elegir una residencia estudiantil en Buenos Aires si no podés ir a verla?
> En EstuRed las residencias se visitan en persona antes de publicarse. Comparás desde donde estés, con tu familia si querés, y seguís cada paso de tu solicitud. Todo queda registrado.
> Solicitar es gratis. Sumate desde el link en la bio.
> #ResidenciaEstudiantil #EstudiarEnBuenosAires #MudarseABuenosAires #EstuRed

**Ajustes de publicación:** compartir en feed activado, fijar al perfil, sin audio en tendencia.
**Texto alternativo de la portada:** "Título 'Elegir residencia a distancia' sobre fondo verde con el logo de EstuRed".
**Chequeo:** ¿gancho a los 3 s por texto, voz e imagen? ¿se entiende en mudo? ¿no hay nombres ni precios? ¿"solicitud sujeta a confirmación" visible? Sí a todo.

---

## C. Post 2: Carrusel, cómo elegir una residencia (9 diapositivas)

**Objetivo:** guardados (utilidad de referencia).
**Fuente:** guía 01 (`content/guias/01-como-elegir-residencia-estudiantil.md`); el sentido no se cambia.
**Idea única:** un checklist de cinco cosas para revisar antes de elegir una residencia.
**Envío y guardado:** el estudiante lo guarda para comparar opciones y se lo manda a su familia.

### Portada (tres alternativas, elegida la 1)
| # | Mecanismo | Texto | Resultado |
|---|---|---|---|
| 1 | Especificidad + promesa | "5 cosas que revisar antes de elegir residencia en Buenos Aires →" | **Elegida.** Número real, palabra clave y promesa clara |
| 2 | Llamado al público | "Si elegís residencia desde otra ciudad, guardá este checklist →" | Más cerrada al público; queda para la diapositiva 7 |
| 3 | Dolor | "El error de elegir residencia solo por la foto →" | Sin dato que sostenga "error más común"; descartada |

### Diseño común
Fondo crema `#fbf6ec`, titular en tinta (Bricolage 800, 80 px), apoyo en Hanken (40 px), acento forest en una palabra por diapositiva, logo pequeño arriba a la izquierda, número "2/9" abajo a la derecha. La portada es forest `#1f7d5c` con titular crema.

### Diapositivas
| # | Titular | Apoyo (texto exacto) | Visual (para ilustrar) |
|---|---|---|---|
| 1 (portada) | 5 cosas que revisar antes de elegir residencia en Buenos Aires → | Checklist para guardar | Fondo forest. E1 con laptop y una lista con tildes. Flecha de deslizar abajo a la derecha |
| 2 | 1. Tus prioridades primero | Presupuesto mensual · Tiempo hasta tu facultad · Tipo de habitación · Privacidad · Espacio para estudiar | Cinco íconos simples en fila (billete sin monto, reloj, cama, puerta, escritorio) |
| 3 | 2. El recorrido real | Calculalo en los horarios en que vas a viajar. Mirá más de un transporte | Mapa con dos rutas distintas hasta una sede (sin nombre) |
| 4 | 3. Habitaciones y convivencia | ¿Cuántas personas comparten la habitación? ¿Cómo se usan baños, cocina y lavandería? ¿Hay lugar para estudiar? | Plano simplificado de una residencia con zonas marcadas |
| 5 | 4. El reglamento | Descanso, visitas, limpieza, uso de espacios, salida anticipada y renovación | Documento con una lista y tildes |
| 6 | 5. El costo total | Mensual, reserva o matrícula, depósito, ajustes, servicios adicionales y devolución | Lista con ícono de signo $ y filas vacías (sin montos) |
| 7 | Si elegís desde lejos | Leé y mirá todo con atención. Si algo no queda claro, revisá reglamento y preguntas frecuentes antes de consultar | E1 con celular y F1 al lado, mirando juntos |
| 8 | Checklist final | ¿Conozco el costo total? ¿Sé qué cama o habitación pido? ¿Leí el reglamento? ¿Conozco el proceso de ingreso y egreso? ¿Tengo un contacto responsable? ¿Sé qué pasa si cambio de planes? | Seis casillas con tilde. Pie: "Si alguna respuesta es no, resolvela primero" |
| 9 (cierre) | Guardá este checklist | Comparás con todo a la vista en EstuRed. Link en la bio | Fondo forest oscuro, logo grande, ícono de marcador |

Notas: la diapositiva 8 es la más densa; en la maqueta se admiten dos columnas de tres. Cada diapositiva tiene una sola idea y no lleva más de una línea de apoyo, salvo las listas.

**Texto del post:**
> Antes de elegir una residencia estudiantil en Buenos Aires, ordená lo que tenés que revisar: ubicación, convivencia, reglamento y costo total.
> Guardalo para tenerlo a mano cuando compares opciones. Es una versión resumida de nuestra guía completa del Centro de Guías.
> La disponibilidad y las condiciones se confirman en la ficha de cada residencia.
> #ResidenciaEstudiantil #EstudiarEnBuenosAires #GuiaEstudiantil #EstuRed

**Texto alternativo:** una descripción por diapositiva con el titular y el apoyo; ejemplo de la portada: "Portada verde: '5 cosas que revisar antes de elegir residencia en Buenos Aires'".

### Pack de ilustraciones (para generar las imágenes con la herramienta que se elija)
- **Prompt maestro:** "Ilustración plana, estilo [a definir], paleta forest #1f7d5c, crema #fbf6ec, tinta #1d2722 y arena #f1d9a8, sin texto, sin logos, fondo liso, fondo para colocar texto después".
- El texto de cada diapositiva **no se genera dentro de la imagen**: se coloca en una plantilla (mejor legibilidad y tipografía de marca).
- Cada ilustración se pide por separado con la descripción de la columna "Visual".
- Si se usa IA, marcar el contenido como generado con IA.

---

## D. Post 3: Reel, errores comunes al mudarte solo (27 s)

**Objetivo:** envíos y guardados. Tono serio, de adulto a adulto.
**Fuente:** guía 03 (`content/guias/03-errores-comunes-mudanza.md`), errores 1, 2 y 4.
**Envío:** quien ya se mudó se lo manda a quien está por mudarse; el estudiante se lo manda a un compañero.
**Prueba (Trial Reel):** sí; probar el gancho con no seguidores antes de abrirlo a todos.
**Audio:** voz en off + música original baja.

### Gancho (tres alternativas, elegida la 1)
| # | Mecanismo | Texto | Resultado |
|---|---|---|---|
| 1 | Especificidad + error | "3 errores al mudarte solo a Buenos Aires" | **Elegida.** Número real, palabra clave y promesa que el reel cumple |
| 2 | Llamado | "Te mudás solo a Buenos Aires. Evitá esto." | Buena, menos específica |
| 3 | Vacía | "Lo que nadie te cuenta antes de mudarte solo" | Descartada: plantilla gastada, no abre una brecha real |

**Bucle abierto:** la voz dice que el segundo error "se parece a algo sano".

### Versión muda
1. 3 errores al mudarte solo a Buenos Aires → 2. 1. Llegar sin margen → 3. 2. Confundir independencia con aislamiento → 4. 3. Dejar pasar los problemas de convivencia → 5. Hay tres más en la guía.

### Guion de producción
| # | Tiempo | Visual | Titular | Voz en off (= subtítulos) | Audio y transición |
|---|---|---|---|---|---|
| 1 | 0,0–3,5 | E1 entra a una habitación vacía y deja la valija. Plano medio, cámara fija | "3 errores al mudarte solo a Buenos Aires" | "Si te mudás solo a Buenos Aires, evitá estos tres errores." | Música desde el segundo 0. Corte seco |
| 2 | 3,5–9,0 | Calendario dibujado con la fecha de llegada y el primer día de clases pegados; íconos de valija, trámite y cansancio se apilan | "1. Llegar sin margen" | "Uno: llegar sin margen. Clases, trámites y cansancio se superponen. Si podés, llegá antes." | Deslizamiento lateral |
| 3 | 9,0–16,5 | Dos planos: E1 cierra la puerta de su cuarto y se sienta solo; corte a E1 en la cocina común saludando a E2 | "2. Confundir independencia con aislamiento" | "Dos: confundir independencia con aislamiento. Tu espacio es sano; encerrarte por incomodidad, no. Presentate y sumá una actividad en común." | Sonido suave de puerta; música igual |
| 4 | 16,5–22,5 | Cocina con pila de platos y burbuja de queja sin texto; corte a E1 y R1 conversando con tranquilidad con una carpeta (reglamento) sobre la mesa | "3. Dejar pasar los problemas de convivencia" | "Tres: dejar pasar los problemas de convivencia. Conocé el reglamento y hablalo a tiempo, con respeto." | Deslizamiento |
| 5 | 22,5–27,0 | Fondo forest oscuro. Libro abierto grande en el centro con logo EstuRed. El último fotograma vuelve a E1 entrando a la habitación | "Hay tres errores más en nuestra guía" y "Link en la bio" | "Hay tres errores más en nuestra guía. Link en la bio." | Música baja |

**Poses pedidas:** E1 con valija entrando; E1 de espaldas cerrando la puerta; E1 y E2 saludándose; E1 y R1 sentados conversando.
**Gatillo de rewatch:** tres numerales rápidos y la promesa de tres más. El final vuelve a la imagen inicial.
**Portada:** fondo forest, titular "3 errores al mudarte solo" centrado, E1 con valija a la izquierda.

**Texto del post:**
> Mudarte solo a Buenos Aires es un cambio grande. Estos tres errores son comunes y se evitan con un poco de planificación.
> Mandáselo a quien esté por mudarse. En la guía completa del Centro de Guías hay seis, con cómo evitarlos.
> #MudarseABuenosAires #VidaUniversitaria #EstudiarEnBuenosAires #EstuRed

**Texto alternativo de la portada:** "Título '3 errores al mudarte solo' sobre fondo verde con un personaje con valija".
**Chequeo:** todo lo que dice el reel está en la guía 03; no se agrega ningún dato nuevo.

---

## E. Post 4: Carrusel, cómo funciona EstuRed en 5 pasos (7 diapositivas)

**Objetivo:** que se entienda el proceso completo.
**Fuente:** pasos de la landing (`components/marketing/HomeLanding.tsx`) y pantallas "Qué pagás y a quién" y comprobante.
**Idea única:** de la búsqueda a la reserva confirmada, sin viajar a Buenos Aires, y cada paso queda registrado.

### Portada (tres alternativas, elegida la 2)
| # | Mecanismo | Texto | Resultado |
|---|---|---|---|
| 1 | Resultado | "De buscar a reservar sin viajar: así funciona EstuRed →" | Clara; "reservar" en la portada pesa más |
| 2 | Especificidad + público | "Cómo elegir residencia en Buenos Aires desde otra ciudad, en 5 pasos →" | **Elegida.** Palabra clave, público y número |
| 3 | Pregunta | "¿Qué pasa después de enviar la solicitud?" | Buena para historias; queda como idea |

### Diseño común
Igual a C. Cada diapositiva interna lleva arriba el número de paso en un círculo forest, el titular, una línea de apoyo, y una captura dentro del celular dibujado (ver A5).

### Diapositivas
| # | Titular | Apoyo (texto exacto) | Visual |
|---|---|---|---|
| 1 (portada) | Cómo elegir residencia en Buenos Aires desde otra ciudad, en 5 pasos → | Todo desde donde estés. Cada paso queda registrado | Fondo forest, E1 con celular. Cinco puntos unidos por línea |
| 2 | 1. Buscás tu residencia | Filtrá por universidad, barrio, tipo de habitación, precio y servicios | Celular con **C1** |
| 3 | 2. Enviás tu solicitud | Elegís el tipo de habitación y la enviás sin costo. Tu familia puede acompañarte | Celular con **C2**; F1 a un costado |
| 4 | 3. La residencia responde | Acepta tu solicitud o te propone un ajuste. Vos decidís si avanzás | Celular con **C3** |
| 5 | 4. Abonás lo acordado | Pagás directo a la residencia. Ella confirma que lo recibió | Celular con **C4**, solo con el bloque "A la residencia" resaltado en forest |
| 6 | 5. Confirmás tu reserva | Abonás el fee EstuRed (5%), solo si la residencia confirma la reserva, y recibís tu comprobante con número verificable | Celular con **C4** resaltando "A EstuRed: fee" y luego **C5** |
| 7 (cierre) | Sumate gratis | La solicitud está sujeta a confirmación de la residencia. Link en la bio | Fondo forest oscuro, logo grande |

Notas: el cierre lleva una sola petición (sumarse). El aviso de "sujeta a confirmación" queda visible en la misma diapositiva.

**Texto del post:**
> Así funciona EstuRed: buscás, enviás tu solicitud sin costo, la residencia responde, abonás lo acordado y confirmás con un comprobante verificable. Cada paso queda registrado.
> La solicitud está sujeta a confirmación de la residencia. Sumate gratis desde el link en la bio.
> #EstuRed #ResidenciaEstudiantil #EstudiarEnBuenosAires #ComoFunciona

**Texto alternativo:** una por diapositiva; ejemplo del paso 4: "Pantalla de la app que muestra qué se paga a la residencia y qué se paga a EstuRed, con los montos ocultos".
**Chequeo:** ninguna captura con nombres ni precios; las cifras del fee solo como "5%".

---

## F. Historias de apoyo (una secuencia por post)

Objetivo de las historias: profundizar la relación con quienes ya siguen la cuenta y llenar las destacadas. Una meta por secuencia. Los stickers (encuesta, pregunta, quiz, enlace) se agregan **a mano en Instagram**: no se programan. Las respuestas por mensaje las contesta el dueño, no se automatizan. No se publican resultados de encuestas inventados.

| Post | Destacada que alimenta | Fotograma 1 (gancho) | Fotograma 2 | Fotograma 3 | Sticker y meta |
|---|---|---|---|---|---|
| 1 | Cómo funciona | "¿Cómo elegís residencia si no podés ir a verla?" sobre fondo forest | Casa con tilde: "Las residencias se visitan en persona antes de publicarse" | Compartir el reel con el texto "Mirá cómo funciona" | Encuesta: "¿Podés viajar antes de elegir?" (Sí / No). Meta: ver el reel y sumarse |
| 2 | Guías | "Antes de elegir residencia, revisá esto" | Las 5 cosas, una lista simple | Compartir el carrusel con "Guardalo" | Pregunta: "¿Qué es lo que más te cuesta decidir?". Meta: guardar el post |
| 3 | Guías | "3 errores al mudarte solo" con E1 y la valija | Los tres numerales en una lista | Encuesta con las tres opciones | Encuesta: "¿Cuál te preocupa más?" (Llegar sin margen / Aislarme / La convivencia). Meta: responder; al día siguiente, contestar con la guía correspondiente |
| 4 | Cómo funciona y Costos | "5 pasos, todo a distancia" | C1 a C5 en dos fotogramas con números | Quiz: "¿A quién se le paga la reserva?" (A la residencia / A EstuRed) | Quiz con respuesta correcta "A la residencia (pago directo)". Cierre con enlace: "Sumate gratis". Meta: preregistro |

Medidas: igual que A1. Cada fotograma con una sola idea y el texto dentro de la zona segura.

---

## G. Entrega y pendientes

### Lista de entrega por pieza
- [ ] Respeta las medidas y las zonas seguras (A1).
- [ ] Usa solo los colores, la tipografía y el logo de A2.
- [ ] Los personajes cumplen A3 y no hay marcas de terceros.
- [ ] Las capturas son las de A5 (sin nombres, precios ni datos personales).
- [ ] Se entiende sin sonido; subtítulos quemados.
- [ ] Texto alternativo cargado.
- [ ] Sin las frases prohibidas de A8; "solicitud sujeta a confirmación" donde corresponde.
- [ ] Hashtags: confirmar sus variantes dentro de Instagram antes de publicar.
- [ ] Si hay IA, marcada como contenido generado con IA.

### Pendientes
- Herramienta y estilo de dibujo para el dúo de estudiantes: definir y completar la hoja de personaje (A3).
- Voz definitiva: sintética `es-AR-ElenaNeural` u otra.
- Producir las capturas C1 a C5 en dev (A5), con una residencia demo de nombre neutro.
- Confirmar que "visitadas en persona" es cierto el día de publicación (A8).
- Píxel de Meta y UTM: siguen sin existir en el repo; resolver antes de pautar (estrategia §5.4).
- Revisar con la guía de voz si "fee EstuRed (5%)" en la diapositiva 6 debe aclarar "de la estadía inicial": en la app el texto es "5% de la estadía inicial".
- Posts 5 a 10: siguientes guiones.
