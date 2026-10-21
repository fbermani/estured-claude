# Plan de acción — Auditoría 2026-10-20

Fuente: [`AUDITORIA_2026-10-20.md`](AUDITORIA_2026-10-20.md) (32 hallazgos, H01–H32). Este plan reparte los hallazgos entre los agentes de `.claude/agents/`, los ordena en fases y marca qué espera una decisión del dueño.

Verificados por el orquestador contra el código antes de armar el plan: H04 (`app/students/profile/actions.ts:106` fuerza `is_individual_profile_visible: true`; `ResidentsBrowser.tsx:605` dice que el residente controla su visibilidad) y H05 (`app/students/residency/page.tsx` calcula el fin de contrato con `start_date + initial_duration_months`, ignorando `resident_stays.expected_end_date`). El resto se toma del informe.

## Flujo por ciclo

Cada ítem de trabajo es un ciclo chico: **agente ejecutor → `revisor` → `seguridad` (solo si toca server actions, RLS o PII) → `tester` (si hay lógica nueva) → commit**. El `documentador` corre una vez por fase, no por ciclo. El `auditor` vuelve a correr al cerrar la Fase 3.

Regla de paralelismo: dos agentes que escriben nunca tocan los mismos archivos a la vez. `constructor` e `interfaz` comparten pantallas del estudiante y del inbox de residencias, así que van en secuencia sobre esas rutas.

## Decisiones del dueño (resueltas 2026-10-20)

| # | Hallazgo | Decisión | Efecto en el plan |
|---|---|---|---|
| D1 | H26 | **Segundo proyecto Supabase** para dev/tests/demos; el actual queda solo para producción. | Fase 0. El dueño crea el proyecto y pasa las env vars; `base-datos` y `tester` adaptan scripts y tests. |
| D2 | H02 | **Transferencia con datos en pantalla**: CBU/alias/titular configurables por el admin, monto exacto en ARS, n.º de reserva como referencia, cuenta regresiva y botón "Tengo un problema con el pago". | Fase 2. Requiere una config de cobro editable en admin (el dueño carga los datos reales). |
| D3 | H03 | **Manda el tipo de habitación** (`profile_availability`). El mapa de camas solo informa ocupación y no ofrece "Elegir" si el tipo no está disponible. | Fase 2. Supuesto: con D8 (todo gratis) la elección de cama exacta puede seguir existiendo, pero solo dentro de tipos disponibles. |
| D4 | H04 | **Control del estudiante**: vista previa + 3–4 interruptores, consentimiento en el registro, menores ocultos por defecto. | Fase 2. Revierte los Ciclos 37/39; hay que actualizar docs/00 §18 si cambia algo. `seguridad` revisa. |
| D5 | H05 | **La tarifa puede diferir, con transparencia**: el estudiante ve la vigente; la residencia ve la diferencia contra el snapshot. | Fase 1 (H05) incluye mostrar la diferencia a la residencia. |
| D6 | H06 | **Pago solo tras "contacto establecido" + vencimiento** automático con plazo visible en el inbox. | Fase 2. Cambia el job de expiración (ya existe pg_cron) y el botón actual. |
| D7 | H08 | **Campo "pago inicial para reservar"** en el perfil de la residencia (por defecto: primer mes), mostrado igual en ficha, solicitud, WhatsApp y fee. | Fase 2. Migración nueva + `docs/06` (campo nuevo: supuesto reversible documentado). |
| D8 | H09 | **Todo gratis en el MVP.** ⚠️ Difiere de la recomendación y de `docs/00` §6.2 (Gestión Operativa = plan pago otorgado por admin). | Fase 2: sidebar, "Tu plan" y `/for-residences` dejan de vender un plan pago y de decir "Sin acceso". **Docs primero** (`docs/13` §5): `documentador` propone el cambio de `docs/00` §6.2 y `docs/08` §3.3 antes de que `interfaz` toque nada. No se borra el modelo de `operating_mode` (queda para cuando se monetice). |
| D9 | H12 | **FAQ simple sí** (pregunta libre → la residencia responde); métricas, facturas y settings diferidos. | Fase 2 (FAQ) y Fase 3: `documentador` actualiza `docs/02` §20 y `docs/08` §3. |
| D10 | H13, H19 | **Solo reset de contraseña y `/terms`** (borrador desde docs/21, enlazado en registro y footer). Sin canal directo con la residencia: sigue todo por Soporte. | H19 se cierra sin cambios de producto; solo se aclara el copy para que no prometa contacto directo. Revisar legalmente `/terms` antes de operar. |
| D11 | H18 | **Alertar, nunca cerrar sola**: aviso a 30 días y al vencer, con acciones "Renovar" / "Registrar salida". | Fase 2. |

## Fases

### Fase 0 — Base confiable (antes de verificar nada en vivo)

| Ítem | Hallazgos | Agente | Depende de | Esfuerzo |
|---|---|---|---|---|
| ✅ Separar la base de tests/dev de producción; guards en tests y seeds (Ciclo 44) | H26 | `base-datos` + `tester` | D1 | M |
| Auditar el impacto: qué escribieron los tests en producción y qué limpiar | H26 | `seguridad` (solo lectura) | D1 | S |
| Dataset demo coherente con fechas relativas; quitar fotos con marca de agua de terceros | H27 | `base-datos` | Ítem 1 | M |

### Fase 1 — Críticos y altos sin bloqueo

| Ítem | Hallazgos | Agente | Esfuerzo |
|---|---|---|---|
| ✅ Helper único de estado visible (solicitud + reserva) en los 3 roles; ocultar la subida de comprobante cuando ya hay reserva (Ciclo 45) | H01 | `constructor` | M |
| ✅ Fin de contrato y tarifa del estudiante desde `resident_stays` (completa el fix del Ciclo 43) (Ciclo 45) | H05 | `constructor` | S |
| ✅ Detalle de solicitud y comprobante desde el snapshot + línea de tiempo; quitar texto de desarrollo de Factura C (Ciclo 47) | H07 | `constructor` | M |
| ✅ El n.º de comprobante impreso verifica en `/verify` (Ciclo 47) | H14 | `constructor` + `tester` | S |
| ✅ "Sumar otra residencia": implementar o quitar el CTA (Ciclo 47: implementado en `/residence/settings/new`, oculto para staff) | H22 | `constructor` | S |
| Familiar: arreglar el 404 de "Mi perfil" | H16 (parte) | `depurador` | S |
| ✅ Notificaciones con enlace y estado "leída" (Ciclo 47) | H20 | `constructor` | S |
| ✅ Copy sin promesas ni datos no respaldados (Ciclo 46) | H11 | `interfaz` | S |
| ✅ Navbar pública consciente de la sesión (Ciclo 46) | H15 | `interfaz` | S |
| ✅ Menor: instrucciones y bloqueo coherentes (Ciclo 46) | H17 | `interfaz` | S |
| Inbox: acciones válidas por estado y rótulos correctos | H24 | `interfaz` (después de H01) | S |
| ✅ Accesibilidad y mobile (Ciclo 46) | H31 | `interfaz` | S |
| Pulido: nacionalidades, alertas de disponibilidad vencida, tipo de cambio, fechas, 404 | H21, H23, H28, H29, H30 | `interfaz` | S c/u |
| Admin: estados legibles, histórico de cobros, detalle | H25 | `interfaz` | M |
| ✅ Tests de regresión del helper de H01 y de H05 (Ciclo 45: `visibleStatus.test.ts` + `contractEnd.test.ts`, puros) | H01, H05 | `tester` | S |

### Fase 2 — Lo que destraban las decisiones

| Ítem | Hallazgos | Agente | Depende de | Esfuerzo |
|---|---|---|---|---|
| Pantalla de pago del fee con instrucciones, referencia y plazo; soporte con contexto | H02 | `constructor` | D2 | M |
| Fuente única de disponibilidad y copy unificado con `StatusTag` | H03 | `constructor` (+ `base-datos` si cambia el modelo) | D3, D8 | L |
| Control de visibilidad de comunidad + consentimiento + menores | H04 | `constructor` → `seguridad` | D4 | M |
| `contact_established` con vencimiento | H06 | `base-datos` + `depurador` | D6 | M |
| Pago inicial a la residencia | H08 | `base-datos` → `constructor` | D7 | M |
| Frontera freemium en sidebar, "Tu plan" y landing | H09 | `interfaz` | D8 | M |
| Ficha pública con tarifas y condiciones | H10 | `interfaz` | D7 | M |
| FAQ asistida mínima | H12 | `constructor` | D9 | L |
| Recuperación de contraseña + `/terms` + contacto | H13 | `constructor` | D10 | M |
| Familiar: experiencia completa | H16 | `constructor` + `interfaz` | — | L |
| Estadías vencidas | H18 | `constructor` | D11 | M |
| Contacto con la residencia | H19 | `interfaz` | D10 | S |

### Fase 3 — Cierre

| Ítem | Hallazgos | Agente |
|---|---|---|
| Sincronizar docs técnicos con el routing y alcance reales; `CLAUDE.md` todavía dice que no hay script `test` | H32 (+ H12, H30) | `documentador` |
| Propuestas de actualización de `docs/00`–`22` (H04, Ciclo 43 `end_date`, H12) para que el dueño apruebe | varios | `documentador` |
| Auditoría completa de seguridad pre-release | — | `seguridad` |
| Re-auditoría de producto, incluyendo lo que no se pudo recorrer (negociación, pago a residencia, fee, propuestas del familiar, admin restante) | — | `auditor` |

## Plan por agente

- **`constructor`:** H01, H05, H07, H14, H20, H22 (Fase 1); H02, H03, H04, H12, H13, H16, H18 (Fase 2).
- **`interfaz`:** H11, H15, H17, H21, H23, H24, H25, H28, H29, H30, H31 (Fase 1); H09, H10, H19 y parte visual de H16 (Fase 2).
- **`base-datos`:** H26, H27 (Fase 0); H06, H08 y cambios de modelo de H03 (Fase 2).
- **`tester`:** aislamiento de tests H26 (Fase 0); regresión de H01, H05, H14 (Fase 1); cobertura de cada ítem de Fase 2 con lógica nueva.
- **`depurador`:** 404 del familiar (Fase 1); H06 (Fase 2).
- **`seguridad`:** impacto de H26 (Fase 0); revisión de H04 y de cada server action nueva (Fase 2); auditoría pre-release (Fase 3).
- **`revisor`:** cada ciclo, antes del commit.
- **`documentador`:** cierre de cada fase y Fase 3.
- **`auditor`:** re-auditoría al cierre de la Fase 3.
