# Plan de remediación UX consolidado — 2026-11-14

Consolida `AUDITORIA_UX_2026-11-14.md` (informe **A**, IDs `H1–H19`) y `AUDITORIA_UX_RECORRIDO_CODEX_2026-11-14.md` (informe **B**, IDs `UX01–UX12`). Los informes originales no se tocan. Ambos son diagnósticos: cada fila se contrasta con el código y las reglas vigentes antes de marcarse resuelta.

## Reglas de ejecución (decididas con el dueño)

- **Sin `localhost:3000`.** El dueño ve todo en https://estured.vercel.app (rama `staging`, base `estured-dev`, push hecho por él). Se verifica con typecheck, lint, vitest acotado y un `build` por lote; la verificación visual (1280/375 px) se hace en staging cuando el dueño pushea. Un hallazgo visual solo pasa a «resuelto» tras esa verificación; antes queda «implementado, falta verificar en staging».
- Sin push, sin producción, sin operaciones destructivas. Datos demo solo aditivos.
- No se inventan reglas de negocio, permisos, SLA, requisitos documentales ni compromisos de atención. Lo que necesite decisión queda como «requiere decisión» y se consulta de a una.
- Tests solo donde protegen lógica/cálculos/regresiones.

## Criterios para resolver contradicciones entre informes

- Dirección publicada (UX01): se mantiene el criterio vigente (la ficha la muestra); se corrige el texto «Privada». Ocultarla sería otra decisión de producto.
- Etapa del estudiante (UX06/H10): se separan requisitos reales de recomendaciones de perfil; el hito sale de la solicitud más avanzada viva. No se exigen documentos nuevos.
- Cifras de ocupación (H15) y «34 cargados vs 29 activos» (B, cond. 7): universos distintos; se rotulan, no se «igualan».
- Datos demo vencidos/test (B, cond. 1–8; A, H5/H9 y latencia dev): no son bugs de producto.

## Tabla consolidada

Prioridad: P1 confianza/tarea inaccesible · P2 fricción o información contradictoria · P3 pulido. Estados: pendiente · en curso · implementado (falta verificar en staging) · resuelto · ya corregido · no reproducible · descartado (dev/demo) · requiere decisión.

| ID | Orig. | Problema y causa | Prioridad | Solución y criterio de aceptación | Estado |
|---|---|---|---|---|---|
| CON-01 | UX01 | La ayuda de «Dirección completa» dice «Privada» pero la ficha pública la muestra (`ResidenceProfileForm.tsx:580`). Solo es texto. | P1 | Ayuda: «Se muestra en tu ficha pública. Para corregirla, escribinos a Soporte». Ningún texto la llama privada. | implementado (falta verificar en staging) |
| CON-02 | UX02 | Comunidad admin: `.limit(300)` ordenado por creación, sin búsqueda ni paginación; deja residentes fuera de la herramienta de moderación (`app/admin/community/page.tsx:32`). | P1 | Búsqueda en servidor (persona/residencia), filtro de estado, paginación con total y rango. Buscar un residente de Norte y otro de Río los devuelve; vacío/error; móvil. | implementado (falta verificar en staging) |
| CON-03 | UX03 | «4 activas de 15» cuenta estados persistidos; las filas muestran estado efectivo (`getVisibleStatus`). Criterios distintos. | P2 | Mismo universo para contador y filtro «activas», según estados oficiales. | implementado (falta verificar en staging); lógica con test |
| CON-04 | UX04 | «1 en ventana» abre Renovaciones vacío: el contador cuenta pedidos/ofertas, la pantalla parte de reservas confirmadas. | P2 | Unificar elegibilidad o renombrar la métrica por lo que mide; cada unidad lleva a un elemento. | implementado (falta verificar en staging); el tile «Renovaciones» del panel cuenta sin filtrar por reserva confirmada (mismo riesgo, no tocado) |
| CON-05 | UX05 | La pregunta sin responder queda tras el catálogo (~9.300 px en móvil). | P2 | «Sin responder · N» antes del catálogo o pestañas; el aviso lleva al pendiente. | implementado (falta verificar en staging) |
| CON-06 | UX06, H10 | El panel del estudiante muestra «Paso 1 de 6 · Completá tu perfil para pedir residencia» aunque el perfil no bloquea solicitar y Camila ya tiene 9 solicitudes; mezcla % de perfil con etapa del camino (`lib/students/journeyStage.ts:79–88`). | P2 | Separar requisitos reales de recomendaciones; etapa según la solicitud más avanzada viva; sin exigir documentos. | implementado (falta verificar en staging); lógica con tests |
| CON-07 | UX07 | El paso 2 de la solicitud no repite el desglose económico. | P2 | Resumen compacto (tipo/fechas, pago a residencia, fee, depósito estimados, sujeto a confirmación) con editar; reutiliza cálculos. | implementado (falta verificar en staging) |
| CON-08 | UX08 | La residencia no ve qué valor envió a aprobación («no los que enviaste»). | P2 | Mostrar publicado → enviado, fecha y estado, en lectura. | implementado (falta verificar en staging); resumen con test |
| CON-09 | UX09, H17(a, c) | Dashboard admin: «Requiere acción» sin enlace en ediciones de perfil; pendientes mezclados con métricas; feed de 8 líneas idénticas; revocación de 24 días sin marca. | P2 | Sección de pendientes con enlace directo; feed agrupado; antigüedad visible. El umbral de revocación sale de las reglas (docs), no se inventa. | implementado parcial (falta verificar en staging); umbral/SLA de revocación y métricas de embudo: requiere decisión (docs/00 DR6 son 10 días del estudiante, no SLA de resolución) |
| CON-10 | UX10, H8(a) | La espera dice «No hay lugares disponibles en este momento» sin acotarlo al tipo elegido; falta CTA de espera junto al formulario (`JoinWaitlistForm.tsx:48`, `ProposeForm.tsx`). | P2 | Mensaje por tipo («Doble: completa»); indicar otros tipos con disponibilidad; sin prometer plaza. | implementado (falta verificar en staging) |
| CON-11 | UX11 | «6 fees cobrados» incluye 1 reintegrado; el importe lo excluye (`PaidFeesView.tsx:45–59`). | P3 | «5 cobrados · 1 reintegrado» y qué representa el importe. | implementado (falta verificar en staging) |
| CON-12 | UX12, H13, H12(copy) | La vista del familiar usa «Tu estadía», «Ya renovaste», avisos duplicados y una frase confusa («en otra residencia … registra su salida»). | P3 | El estudiante elegido es el sujeto; una sola aclaración de solo lectura; frase reescrita. | implementado (falta verificar en staging) |
| CON-13 | H1, H18 | Popup de preapertura vs. landing inerte que dice «Reservá y pagá desde donde estés», «Ya podés buscar…», dos `<h1>`, meta. | P1 (A: alto) | Copy: «Solicitá y coordiná desde donde estés» (H18). Qué muestra el fondo/SEO en preapertura: decisión del dueño. | copy H18 implementado; fondo/SEO: decidido por el dueño «dejar como está» (2026-11-14), sin cambios |
| CON-14 | H2 | Contadores públicos de fundadoras alimentados por filas seed/prueba en staging. | — | Es condición de datos de dev (identificables `test-*`/seed); en prod no existen. Opcional: limpiar con el script de cleanup antes de mostrar staging. | descartado (dev) |
| CON-15 | H6 | «Residencia Sin Fronteras» figura como «Verificada» común, sin señal de relación con EstuRed. | P1 (A: alto) | Decidido por el dueño: fuera de «Recomendadas» (DR49), sin etiqueta. | implementado (falta verificar en staging) |
| CON-16 | H7 | `/search` muestra 42 (logueada) / 43 (deslogueada) / 43 (admin). | P2 | Investigar regla de ocultamiento (p. ej. residencia ya solicitada) o bug de conteo. | explicado (filtro de edad intencional, DR14); decidido rotular (DR51): implementado (falta verificar en staging); copy con test |
| CON-17 | H3 | «#15 Tu lugar en la lista» sugiere prioridad (el doc dice sin prioridad); `/mi-lugar` para cuenta activa repite el paso 1; fecha de nacimiento sin anticipar qué pasa si es menor. | P2 | Quitar el ordinal; variante para cuentas ya activas; aviso «si sos menor, tu familiar te invita». | implementado (falta verificar en staging); `LegalPreapertura.tsx:68` aún dice «Tu lugar en la lista indica el orden»: alinear (decisión) |
| CON-18 | H4 | `/fundadoras/datos` no dice qué sigue. | P2 | Éxito con próximos pasos sin plazo (un plazo es compromiso operativo → decisión). | éxito con próximos pasos ya existía; plazo «48 h»: requiere decisión |
| CON-19 | H5 | Widgets solo-dev ocupan 20 % en móvil. | P3 | No es interfaz pública. | descartado (dev) |
| CON-20 | H11 | `/students/applications` mezcla activas e historial; objetivo académico repetido. | P2 | Activas arriba, historial plegado; sin repetir. | implementado (falta verificar en staging) |
| CON-21 | H12 | Lucía: «Ya tenés tu lugar» + «Alojado» + «Ya renovaste» antes de mudarse; ingreso 15/02/2027 vs 20/07/2026 (Martín). | P2 | Investigar si es dato demo (dos estadías) o bug de derivación; unificar etiquetas por entidad. | dato demo, no bug; decidido por el dueño: dejar la demo como está (se conserva la tarjeta «Tu llegada»); el script `--coherencia-lucia` queda sin aplicar |
| CON-22 | H14 | El panel de la menor no dice que su tutor ve sus solicitudes; «Desvincular» sin consecuencias. | P2 | Línea de privacidad; contrastar «Desvincular» con docs/05. | implementado (falta verificar en staging); cambio de servidor: `revokeFamilyLink` rechaza a menores (docs/05 §4.4); canal de pedido a Soporte a confirmar |
| CON-23 | H15(a, b) | Panel de residencia: 29/35 vs «34 cargados» sin leyenda; solicitudes recientes idénticas. | P2 | Rotular universos; sumar fecha de ingreso y duración. | implementado (falta verificar en staging) |
| CON-24 | H15(c) | Vocabulario de «reserva vencida» distinto por rol. | P2 | Unificar etiqueta por entidad (docs/04); variar solo la descripción. | requiere decisión |
| CON-25 | H16 | Dueño multi-residencia: sin franja «qué requiere mi atención». | P3 | Recomendación de diseño. | pendiente (baja, no implementado) |
| CON-26 | H17(b) | Nombres confusos del menú admin. | P3 | Decisión de nomenclatura. | requiere decisión |
| CON-27 | H8(b–d), H9 | Siete tarjetas de condiciones con «No cobra»; skeleton/CLS/placeholder de fotos. | P3 | Condiciones: decisión de diseño. Skeleton/CLS: rendimiento dev. | requiere decisión / descartado (dev) |
| CON-28 | H19 | «Abrir WhatsApp» sin aclarar que abre la app y que el mensaje es borrador. | P3 | Copy breve. | implementado (falta verificar en staging) |
| CON-29 | B decisión | Valentina (17) puede abrir la solicitud de una ficha «De 18 a 26 años». | — | Decidido (DR50): aviso no bloqueante en el formulario según la edad a la fecha de ingreso. | implementado (falta verificar en staging); lógica con test |
| CON-30 | B cond. 3–4, A | Demo: «Lucia/Lucía», tutor con mail de otra estudiante, Martín↔Valentina vs Lucía, staff en selector. | P3 | Normalizar datos demo de forma aditiva. | implementado en dev: tildes normalizadas (script idempotente); mail del tutor de Valentina: requiere decisión |
| CON-31 | B lint | `npm run lint` falla en `docs/audits/evidence/2026-11-14/repro-actions.cjs` (evidencia de seguridad). | P3 | Ignorarlo en la config de ESLint (no es código de la app). Verificar si sigue fallando. | resuelto: ESLint 0 errores (`docs/audits/evidence/**` ignorado) |

## Lotes

1. **Residencia** (CON-01, 04, 05, 08, 23).
2. **Admin** (CON-02, 03, 09, 11).
3. **Estudiante y familiar** (CON-06, 12, 20, 22, 28).
4. **Ficha pública y captación** (CON-07, 10, 17, 18 parcial).
5. **Investigaciones** (CON-16, 21, 30, 31).
6. **Decisiones del dueño** (CON-13, 15, 18 plazo, 24, 26, 27, 29), de a una.

## Registro de avance

- **2026-11-14, lotes 1–5 implementados** por cinco agentes en paralelo y revisados contra reportes. Verificación: `tsc` sin errores; `eslint` 0 errores (50 warnings previos); vitest de `lib/students`, `lib/residences`, `lib/applications`, `lib/format`, `lib/family`: 720 pasan, 4 skipped. **`npm run build` NO corrido:** hay un `next-server` en el puerto 3000 que no es de esta sesión (corrompería `.next`); correrlo con ese servidor detenido. Verificación visual (1280/375 px) pendiente en estured.vercel.app tras el push del dueño.
- **CON-15 decidido (DR49):** al final del orden «Recomendado».
- **CON-13 decidido:** el fondo del popup y el SEO se dejan como están.
- **CON-21 decidido:** se deja la demo de Lucía como está.
- **CON-29 decidido (DR50):** aviso no bloqueante de rango de edad en el formulario.
- **CON-16 decidido (DR51):** rótulo del filtro de edad en `/search`.
- Pendientes de decisión del dueño (de a una): 18 (plazo), 24, 26, 27, mail del tutor (CON-30), umbral de revocación (CON-09).
