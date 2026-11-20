# Estrategia de marketing e Instagram de EstuRed

Documento vivo. Se actualiza al cerrar cada etapa. Última actualización: 2026-11-11.
Fuentes: `docs/23_PREAPERTURA.md`, `design-proposals/voz-y-tono/GUIA_DE_VOZ.md`, `design-proposals/identidad-marca-2026-10-30/SPEC.md`. Ante contradicción manda `docs/00_DECISION_LOG.md`.

## Estado de las etapas
| Etapa | Estado |
|---|---|
| 1. Identidad | Cerrada (personaje y herramienta de producción quedan pendientes, ver abajo) |
| 2. Bio y perfil | Cerrada |
| 3. Historias destacadas | Cerrada |
| 4. Primeros posts | Cerrada |
| 5. Éxito desde el día 1 (hashtags, interacción, métricas, lanzamiento, automatización) | En validación |

## 0. Contexto y decisiones del dueño
- **Cuenta:** Instagram nueva, todavía no creada. Hay que crearla ya para ponerla en el formulario de fundadoras y en el footer (`docs/23` §9 la deja pendiente).
- **Dominio para la bio:** `estured.com` (provisorio; el repo hoy usa `estured.vercel.app`).
- **Publicidad en Meta:** dirigida a estudiantes que buscan alojamiento en Buenos Aires (el público más fácil de encontrar).
- **Objetivo:** captar preregistros de estudiantes y familias y, como consecuencia del tráfico, la atención de residencias fundadoras. Reparto **60/40**: 60% estudiantes y familias, 40% relato de EstuRed y propuesta a residencias.
- **Público principal:** estudiantes y familias del interior de Argentina y de Latinoamérica. Dos perfiles: quienes **no pueden viajar** antes (elegir a distancia) y quienes **sí pueden** (saber cuáles visitar y que todo quede registrado).
- **Propuesta a residencias:** gestión y administración, facilidades, hacer las cosas mejor, **previsibilidad, anticipación y mejor comunicación**. Se dice "residencias fundadoras", nunca "pioneras", "beta" ni "MVP".
- **Identidad:** faceless, joven, dinámica y viral. Estilo de dibujos animados con motion graphics y explicaciones. Material principal: capturas reales de la app.
- **Recursos:** lo hace una sola persona. Objetivo: automatizar lo más posible (recomendaciones en Etapa 5). Sin fecha de lanzamiento definida.
- **Líneas rojas:** no mostrar ni nombrar residencias; no mostrar precios; no mencionar Sin Fronteras (`docs/23` §5); no decir que se verifican personas ("EstuRed verifica a las residencias").
- **Competidores y referentes:** referentes de nicho: Casa Rica, Wanna, Palo Alto, Casaires. Competencia real: boca a boca, grupos de Facebook, Marketplace, inmobiliarias, **Instagram y Google** como canales de búsqueda actuales de los estudiantes.

## 1. Identidad (en validación)
### Propuesta de valor
**Lema:** "Elegí tu residencia en Buenos Aires con todo a la vista." (el dueño votó esta opción; "sin ir a ciegas" descartado).
**Línea de apoyo (bio):** "Residencias visitadas en persona y todo tu proceso registrado."

### Personalidad y tono
- Tres rasgos: cercana, clara y seria. Hablamos de adulto a adulto con jóvenes que se mudan solos y con familias que acompañan sin decidir por ellos. Humor mínimo y siempre sobre situaciones.
- Voseo, frases cortas, hechos antes que adjetivos. Humor sobre situaciones, no sobre el miedo.
- Familias: tono más tranquilo ("seguís cada paso, la decisión es de tu estudiante").
- No hacemos: prometer disponibilidad ("garantizado", "asegurado"), decir "mediación", dramatizar, lunfardo fuerte. Detalle: guía de voz §4, §5, §7.

### Pilares de contenido
| Pilar | Peso | Qué es |
|---|---|---|
| 1. Mudarse con todo claro | 30% | Educativo y de guardado: qué preguntar al visitar, costos, alertas, checklist |
| 2. Llegar a Buenos Aires | 20% | Barrios, trámites, transporte (reutiliza el Centro de Guías) |
| 3. Convivencia y vida independiente | 10% | Identificación y compartidos, con el personaje. Tono serio y de adulto a adulto; humor solo liviano y sobre situaciones, nunca infantilizar ni apelar a "mamá/papá" |
| 4. Cómo funciona EstuRed | 25% | Capturas de la app, proceso, "solicitar es gratis", comprobante |
| 5. Hacer las cosas mejor | 15% | Para dueños: previsibilidad, anticipación, mejor comunicación, residencias fundadoras. Sin nombrar ninguna |

### Lineamientos visuales
- Personaje: **dúo de estudiantes** (opción 2, elegida por el dueño). **Estilo de dibujo y herramienta de producción de imágenes y video sin definir**: se decide cuando se elija la herramienta (consistencia entre piezas). Estilos con menor riesgo de inconsistencia: plano minimalista y muñecos bean. La casa del logo queda como firma y no como protagonista.
- Paleta: forest `#1f7d5c`, crema `#fbf6ec`, forest oscuro `#0c3a2c`, tinta `#1d2722`, arena `#f1d9a8` (decorativo; `#b9a07a` nunca en texto).
- Tipografía: Bricolage Grotesque 800 en títulos.
- Formatos: reels 9:16 con subtítulos grandes; carruseles 4:5 con portada forest y titular grande.
- Capturas: en dev con datos demo; nombres y precios de residencias difuminados o reemplazados. Solo flujos (perfil, solicitud, comprobante, comunidad).
- Material existente: video de lanzamiento de 71 s en `video/` (personajes vectoriales, narración).
- **Logo definitivo:** casa con R y cama, enviado por el dueño (ya no hay opciones A/B/C). Marca madre: solo **EstuRed**. El módulo de gestión (EstuResi, nombre a revisar) no entra en el MVP y queda fuera de esta estrategia.
- Archivos del logo vectorizado: `assets/logo/` (SVG + PNG 1024, versión clara y oscura, marca sola, avatar de Instagram 400 px con zona segura para el recorte circular).
- Colores del logo (muestreados): fondo oscuro `#252A31`, fondo claro `#F0EAE3`, tinta `#1A1F26`, crema `#F0EAE4`, arena `#A89484` / `#B09D8F`. **Se suma el verde forest `#1f7d5c`** (color del hero de toda la web), con su variante oscura `#0c3a2c`. Paleta final: gris azulado, crema, arena y verde forest.
- Regla de copy: "fee EstuRed (5%)", nunca "comisión".

## 2. Bio y perfil (cerrada)
- **Usuario:** `@estured.residencias` (`@estured` no está disponible y `.ar` limitaría la expansión). Verificar disponibilidad y reservar la misma variante en TikTok y YouTube.
- **Nombre del perfil:** EstuRed | Residencias estudiantiles en Buenos Aires (51 caracteres; el campo es buscable).
- **Bio final (135 caracteres):**
```
Reservá tu residencia en Buenos Aires con todo a la vista.
Visitadas en persona. Proceso registrado.
Sumate gratis y enterate primero ↓
```
- **Riesgo aceptado por el dueño (2026-11-11):** "reservá" en el lema, para que la gente no vea las residencias "seguras" y reserve por fuera. Choca con "solicitud sujeta a confirmación" (guía de voz §4). Mitigación: en el resto del contenido y en los anuncios nunca decir "reserva garantizada", "asegurada" ni "inmediata"; aclarar "solicitud sujeta a confirmación" en piezas de proceso, y llevar la validación legal de "reservá" a la lista del asesor.
- **CTA:** "Sumate gratis y enterate primero ↓".
- **Link:** `estured.com/?utm_source=instagram&utm_medium=bio` (en producción lleva a `/preregistro`).
- **Cuenta:** profesional (empresa), categoría de servicios de alojamiento o educación; necesaria para pautar en Meta.

## 3. Historias destacadas (cerrada)
Seis destacadas, nombres de hasta 11 caracteres. Portadas: círculo oscuro `#252A31` con ícono lineal crema y detalle arena; "Verificadas" en verde forest `#1f7d5c` como acento de confianza. Las destacadas se arman con historias ya publicadas: subirlas primero. Lanzar con las seis cargadas (3 a 5 historias cada una).

| # | Nombre | Ícono | Objetivo | Contenido sugerido |
|---|---|---|---|---|
| 1 | Cómo funciona | Escalera de pasos | Entender el proceso en 30 s | Pasos del flujo con capturas de la app (nombres y precios difuminados): perfil, solicitud, contacto, pago, comprobante |
| 2 | Costos | Signo $ | Sacar la duda de la plata | "Solicitar es gratis"; qué se paga a la residencia; fee EstuRed (5%, sin contar el depósito); a quién y cuándo |
| 3 | Guías | Libro abierto | Atraer por utilidad | Una historia por guía del Centro de Guías, con enlace |
| 4 | Familias | Casa con dos figuras | Hablarle a quien acompaña | Qué ve y qué hace el familiar; privacidad; "la decisión es de tu estudiante" |
| 5 | Verificadas | Casa con tilde (verde) | Confianza | Cómo se verifica una residencia en persona, sin nombrar ninguna |
| 6 | Fundadoras | Casa con estrella | Atraer dueños | Previsibilidad, anticipación y mejor comunicación; cupo real de fundadoras; cómo sumarse |

Notas: "Fundadoras" reemplaza a "Residencias" para no sugerir un listado de residencias para mirar. Mantener coherencia con la regla de `docs/23` §6 (cupo real, sin escasez fabricada). Si el programa de fundadoras termina, renombrar.

## 4. Plan de los primeros posts (cerrada)
Sin fechas: solo **orden de publicación y contenido**. Ritmo: 4 posts por semana (2 reels + 2 carruseles) más historias diarias. Meta Ads arranca **después**, con la cuenta ya con contenido (mínimo los 10 posts de la tanda base). Regla: ningún post nombra residencias ni muestra precios; capturas con datos demo y nombres difuminados.

### Tanda base (10 posts, en este orden)
| # | Formato | Pilar | Tema | Objetivo | Idea central | CTA |
|---|---|---|---|---|---|---|
| 1 | Reel (fijado) | 4 | Presentación: buscar residencia desde otra provincia | Que se entienda qué es EstuRed | Problema (buscar a distancia, grupos, dudas) → solución (residencias visitadas en persona, proceso registrado). Versión de 30–40 s del video de lanzamiento | Sumate gratis (link en bio) |
| 2 | Carrusel | 1 | Cómo elegir una residencia: qué revisar | Guardados | Ubicación y movilidad, habitaciones y convivencia, reglamento y costos, checklist final. Guía 01 | Guardalo y mandáselo a quien se muda |
| 3 | Reel | 3 | Errores comunes al mudarte solo a Buenos Aires (3 de los 6 de la guía) | Compartidos y guardados | Tono serio, de adulto a adulto: llegar sin margen, confundir independencia con aislamiento, dejar pasar problemas de convivencia. Guía 03 | Mandáselo a quien se va a mudar |
| 4 | Carrusel | 4 | Cómo funciona EstuRed en 5 pasos | Entender el proceso | Capturas de la app: perfil, solicitud, contacto, pago, comprobante. Aclarar "solicitud sujeta a confirmación" | Sumate gratis |
| 5 | Reel | 1 | Costos: qué se paga y a quién | Sacar la duda de la plata | "Solicitar es gratis"; qué se paga a la residencia; fee EstuRed (5%, sin contar el depósito). Sin montos | Guardalo / Sumate gratis |
| 6 | Carrusel | 4 | Para familias: acompañar sin reemplazar decisiones | Confianza de quien acompaña | Qué ve el familiar en EstuRed, privacidad, "acuerdos, no vigilancia", la decisión es del estudiante. Guía 05. Tono tranquilo | Compartilo con tu familia |
| 7 | Reel | 4 | Visitadas en persona: qué revisamos y qué no | Confianza | Revisamos identidad del responsable, dirección, que la residencia exista y opere ahí, y que coincida con las fotos; visita presencial antes de publicar y renovación anual. Aclarar que **no** es garantía legal ni de calidad ni de convivencia (`docs/03` §5.4, `docs/19` §6.6). Texto oficial: "identidad, ubicación y fotos revisadas por EstuRed mediante control presencial" | Sumate gratis |
| 8 | Carrusel | 5 | Para residencias: previsibilidad, anticipación y mejor comunicación | Atraer dueños | Qué cambia con solicitudes ordenadas y todo registrado. Sin nombres | Sumá tu residencia como fundadora |
| 9 | Carrusel | 2 | Checklist para mudarte a Buenos Aires | Guardados y utilidad | Documentación, alojamiento, movilidad, presupuesto del primer mes y primeros días. Guía 02 | Guardalo / más guías en la bio |
| 10 | Reel | 5 | Residencias fundadoras: cupo real | Atraer dueños | Cupo real de 10 residencias fundadoras, sin escasez fabricada (`docs/23` §6) | Escribinos / link en bio |

Balance: pilares 1=2, 2=1, 3=1, 4=4, 5=2. Cerca del 60/40 (estudiantes y familias vs. EstuRed y residencias).

### Orden de lanzamiento
1. Publicar los posts 1 a 4 de una vez, para que el perfil no se vea vacío.
2. Historias diarias desde el primer día: cada una alimenta su destacada (ver §3).
3. Posts 5 a 10 a ritmo de 4 por semana.
4. Arrancar Meta Ads con los 10 publicados.

### Banco de ideas para la semana 3 en adelante (por desarrollar)
- Alertas al visitar una residencia (carrusel, pilar 1).
- Barrios para estudiar (pilar 2).
- Checklist de llegada (pilar 2).
- Miniacuerdo de convivencia en una residencia (pilar 3, guía 04).
- Un día usando la app (pilar 4).
- Qué esperan las residencias de las solicitudes (pilar 5).

## 5. Éxito desde el día 1 (puntos 3, 4 y 5 se definen más adelante)
Decisión del dueño: métricas (5.3), plan de lanzamiento (5.4) y automatización (5.5) quedan como borrador hasta después de armar los guiones y de elegir la herramienta de producción. Los guiones están en `GUIONES_Y_POSTS.md`.

### 5.1 Hashtags y búsqueda
- Instagram funciona como buscador: pesa más la **palabra clave en el texto, el nombre del perfil y el texto en pantalla** que el hashtag. Usar pocos hashtags (3 a 5) por post, en el final del texto.
- Combinar: 1 de marca (`#EstuRed`), 2 de nicho (`#ResidenciaEstudiantil`, `#EstudiarEnBuenosAires`), 1 a 2 del tema del post (`#MudarseABuenosAires`, `#VidaUniversitaria`, etc.).
- Volúmenes y variantes se **verifican dentro de Instagram** antes de fijarlos; no se inventan cifras.
- Palabras clave a repetir en textos y voz en off: residencia estudiantil, estudiar en Buenos Aires, mudarse a Buenos Aires, estudiante del interior, familias.

### 5.2 Rutina de interacción (20 a 30 min por día)
1. Primera hora tras publicar: responder todos los comentarios (con una pregunta cuando se pueda).
2. Responder mensajes directos del día; guardar las preguntas repetidas como ideas de posts.
3. Comentar con valor en 5 a 10 cuentas del nicho: los 4 referentes, universidades, centros de estudiantes, cuentas de mudanza y vida universitaria.
4. Seguir de forma activa a cuentas de estudiantes del interior y de Latinoamérica; no seguir en masa ni comprar seguidores.
5. Historias: una encuesta o caja de preguntas por semana.

### 5.3 Métricas (Insights nativos; la cuenta es profesional)
Se juzgan por señales de calidad, no por seguidores:
| Métrica | Para qué |
|---|---|
| Envíos (compartidos por mensaje) por alcance | La señal que más mueve el alcance a no seguidores |
| Guardados | Utilidad del contenido (carruseles) |
| Retención y tiempo de reproducción en reels | Si el gancho funciona |
| Visitas al perfil y toques en el link | Intención |
| Preregistros por UTM (`utm_source=instagram`, un `utm_content` por post) | Resultado real |
- No inventar referencias: **las bases se miden en las primeras 4 semanas** y recién ahí se fijan metas.
- Revisión semanal de 20 min: los 2 mejores y los 2 peores posts, qué se repite, qué se corta.

### 5.4 Plan de lanzamiento
| Fase | Qué se hace |
|---|---|
| Preparación | Reservar usuario en Instagram, TikTok y YouTube; crear la cuenta profesional; cargar avatar, bio y link; producir los 10 posts y las historias de las 6 destacadas; capturas de la app en dev con datos demo |
| Apertura | Publicar posts 1 a 4 juntos; historias diarias; armar las 6 destacadas con esas historias |
| Semanas 1 a 2 | Posts 5 a 10 a 4 por semana; rutina de interacción diaria |
| Después de los 10 posts | Arrancar Meta Ads: tráfico al preregistro, público de estudiantes que buscan alojamiento en Buenos Aires; probar 2 a 3 piezas ya publicadas |
- **Pendiente (2026-11-11):** el repo **no tiene** píxel de Meta ni API de conversiones, y tampoco captura UTM en el preregistro. Resolver antes de pautar.
- Pautas y anuncios: nunca "reserva garantizada/asegurada/inmediata" (riesgo de "reservá" ya registrado en §2).

### 5.5 Automatización (el dueño hace todo solo)
| Tarea | Cómo automatizarla |
|---|---|
| Escribir guiones, textos y variantes | Claude Code a partir de este documento, las guías del repo y la guía de voz |
| Videos con motion graphics | HyperFrames o Remotion (ya hay un video de lanzamiento en `video/`); plantillas reutilizables por formato |
| Carruseles | Plantilla HTML con marca renderizada a imágenes 4:5; Claude llena el contenido |
| Capturas de la app | Script de capturas en dev con datos demo y nombres/precios difuminados |
| Programar publicaciones | Meta Business Suite (gratis), por lotes: un día fijo de producción por semana |
| Informe semanal | Exportar Insights y que Claude arme el resumen; tarea programada si se quiere |
| Respuestas frecuentes | Banco de respuestas guardadas en Instagram (respuestas rápidas) |
| Opcionales para más adelante | Publicación por la API de Instagram y respuestas automáticas por palabra clave en mensajes: sirven, pero requieren configuración y revisión de Meta; solo si el volumen lo justifica |
- Tiempo realista: un bloque semanal de producción por lotes (guiones, render, programación) más 20 a 30 min diarios de interacción.
- Lo que no se automatiza: comentar y responder con criterio, decidir qué sigue según métricas, y revisar legal/voz antes de publicar.
