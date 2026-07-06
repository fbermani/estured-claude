# 14_PROJECT_INDEX.md

# EstuRed — Índice Maestro del Proyecto

**Versión:** 0.3
**Estado:** Actualizado — auditoría completa de los 23 documentos cerrada
**Última actualización:** 2026-07-05

## 1. Propósito de este documento

Este archivo es el índice maestro del paquete documental de EstuRed. Es un **mapa de navegación**, no una fuente de reglas.

Sirve para: saber qué archivo leer para cada tarea; entender qué contiene cada documento sin abrirlo; seguir workflows recomendados por tipo de trabajo; saber cómo propagar un cambio de decisión a través del paquete.

**Este documento no repite decisiones, reglas de negocio, estados ni permisos.** Si necesitás una regla, andá al documento fuente (ver mapa en sección 6). Repetir contenido acá es lo que generaba las inconsistencias detectadas en la auditoría inicial del paquete (fee solo en ARS, 72h en vez de 48h, "mediación" en vez de "soporte", etc.) — por eso se recortó.

EstuRed no debe construirse a partir de prompts aislados. Debe construirse leyendo y respetando el paquete documental completo.

---

## 2. Resumen del proyecto (una línea por concepto, sin detalle)

EstuRed es una webapp responsive para estudiantes, familias y residencias estudiantiles verificadas, con mercado inicial en CABA.

El loop central del MVP —con su instancia opcional de negociación de condiciones— está definido en `00_DECISION_LOG.md` sección 4 y no se repite acá.

---

## 3. Dónde están las decisiones

Las decisiones de producto consolidadas viven en `00_DECISION_LOG.md`. No se listan acá para evitar una segunda fuente de verdad.

Temas cubiertos en `00`: definición del MVP; mercado inicial; usuarios; loop central; modelo freemium; verificación; disponibilidad; solicitudes; pago a residencia; fee EstuRed; moneda y tipo de cambio (monedapi.ar); pasarela de pagos (MercadoPago + PayU); facturación fiscal (TusFacturas.app); comprobante; familiar vinculado; visibilidad; comunidad visible; FAQ; admin; métricas; mediación/soporte; antidiscriminación; multi-residencia; contacto por WhatsApp; arquitectura técnica; decisiones delegadas a Claude Code; pendientes.

**Regla:** cualquier duda sobre "¿esto ya está decidido?" se resuelve en `00`, no acá.

---

## 4. Orden obligatorio de lectura

1. `00_DECISION_LOG.md`
2. `01_PRODUCT_BRIEF.md`
3. `02_MVP_SCOPE.md`
4. `03_BUSINESS_RULES.md`
5. `04_STATE_MACHINES.md`
6. `05_ROLES_AND_PERMISSIONS.md`
7. `06_DATA_MODEL.md`
8. `07_API_SPEC.md`
9. `08_UI_SCREENS_AND_FLOWS.md`
10. `09_ADMIN_PANEL_SPEC.md`
11. `10_PRIVACY_AND_LEGAL_RULES.md`
12. `11_TECH_ARCHITECTURE.md`
13. `12_BUILD_PLAN.md`
14. `13_CLAUDE_PROJECT_INSTRUCTIONS.md`
15. `14_PROJECT_INDEX.md` (este documento — funciona como mapa de consulta permanente después de la lectura inicial)
16. `15_ENVIRONMENT_AND_SETUP.md`
17. `16_QA_AND_TESTING_PLAN.md`
18. `17_SEED_DATA_AND_DEMO_SCENARIOS.md`
19. `18_RELEASE_AND_BETA_CHECKLIST.md`
20. `19_ONBOARDING_AND_OPERATIONS_PLAYBOOK.md`
21. `20_RESIDENCE_AGREEMENT_TEMPLATE.md`
22. `21_STUDENT_AND_FAMILY_TERMS_TEMPLATE.md`
23. `22_DOCUMENTATION_MASTER_GUIDE.md`

---

## 5. Jerarquía documental

Ver `13_CLAUDE_PROJECT_INSTRUCTIONS.md` sección 2 — no se repite acá para evitar una tercera copia (ya vive en `00` implícitamente y en `13` explícitamente).

---

## 6. Mapa de documentos: qué contiene cada uno

Formato: función en una línea + temas nuevos o críticos a saber que tiene (no un resumen exhaustivo — para eso está el propio documento).

### `00_DECISION_LOG.md`
Registro maestro de decisiones consolidadas de producto y negocio. Fuente de verdad única. Incluye la tabla de decisiones delegadas a Claude Code (sección 28) — consultar ahí antes de asumir que algo "queda a criterio técnico".

### `01_PRODUCT_BRIEF.md`
Brief estratégico: qué es EstuRed, para quién, posicionamiento, modelo de negocio (freemium + fee), visión futura.

### `02_MVP_SCOPE.md`
Alcance exacto: Must/Should/Could Have, fases internas de construcción, criterios de aceptación del MVP completo.

### `03_BUSINESS_RULES.md`
Reglas duras de negocio. Incluye el flujo completo de **propuesta de solicitud del familiar** (sección 10bis) y **negociación de condiciones** (sección 10ter) — son las secciones más nuevas y las que más cambiaron el documento original.

### `04_STATE_MACHINES.md`
Estados y transiciones oficiales de cada entidad, incluyendo `family_application_proposal` y `application_negotiation_proposals` (entidades nuevas). Renovaciones separadas en `renewal_request`/`renewal_offer`.

### `05_ROLES_AND_PERMISSIONS.md`
Matriz de permisos por rol. Incluye reglas de acceso multi-residencia (un staff no ve residencias del mismo owner a las que no fue asignado).

### `06_DATA_MODEL.md`
Modelo de datos relacional completo. Tablas nuevas: `family_application_proposals`, `application_negotiation_proposals`, `residence_faq_predefined_questions`. Feature flags freemium en `residences`.

### `07_API_SPEC.md`
Especificación funcional de endpoints/server actions. Incluye los endpoints de propuesta del familiar, negociación, facturación fiscal y gestión freemium.

### `08_UI_SCREENS_AND_FLOWS.md`
Pantallas, rutas y flujos. Rutas multi-residencia (`/residence/[residence_id]/...`), pantalla de negociación con comparación lado a lado, verificación pública de comprobante (`/verify/[codigo]`).

### `09_ADMIN_PANEL_SPEC.md`
Especificación del panel admin. Incluye `/admin/family-proposals`, `/admin/negotiations`, `/admin/invoices` (facturación fiscal), gestión de feature flags freemium.

### `10_PRIVACY_AND_LEGAL_RULES.md`
Privacidad, consentimiento, responsabilidad, textos legales de aceptación (incluye los 2 nuevos: aprobación de propuesta del familiar, aceptación de propuesta de ajuste). Pendientes legales explícitos marcados en sección 31.

### `11_TECH_ARCHITECTURE.md`
Arquitectura técnica. Abstracciones confirmadas: `PaymentProvider` (MercadoPago + PayU), `ExchangeRateProvider` (monedapi.ar), `FiscalInvoiceProvider` (TusFacturas.app). WhatsApp explícitamente fuera de `NotificationProvider`.

### `12_BUILD_PLAN.md`
Plan de fases de construcción, con fases nuevas 5bis (propuestas del familiar) y 9bis (multi-residencia + freemium) que no existían en la versión original.

### `13_CLAUDE_PROJECT_INSTRUCTIONS.md`
Metainstrucciones de cómo trabajar (no qué construir): protocolo de fases pequeñas, clasificación de ambigüedades, Definition of Done, prompts base reutilizables.

### `14_PROJECT_INDEX.md`
Este documento. Mapa de navegación y workflows.

### `15_ENVIRONMENT_AND_SETUP.md`
Configuración de entorno local/staging/producción, variables, Supabase, Vercel. Auditado y actualizado (buckets alineados, pg_cron, proveedores confirmados).

### `16_QA_AND_TESTING_PLAN.md`
Plan de pruebas por módulo. Auditado y actualizado (incluye propuesta del familiar, negociación, freemium, facturación y revocación).

### `17_SEED_DATA_AND_DEMO_SCENARIOS.md`
Datos demo para desarrollo y beta. Auditado y actualizado.

### `18_RELEASE_AND_BETA_CHECKLIST.md`
Checklist previo a beta y lanzamiento. Auditado y actualizado.

### `19_ONBOARDING_AND_OPERATIONS_PLAYBOOK.md`
Playbook operativo para onboarding de residencias pioneras y operación diaria. Auditado y actualizado.

### `20_RESIDENCE_AGREEMENT_TEMPLATE.md`
Plantilla de acuerdo con residencias. Auditada y actualizada (freemium, negociación, facturación, revocación). Requiere revisión legal profesional antes de uso comercial.

### `21_STUDENT_AND_FAMILY_TERMS_TEMPLATE.md`
Plantilla de términos para estudiantes y familias. Auditada y alineada con los textos legales de `10_PRIVACY_AND_LEGAL_RULES.md` sección 17. Requiere revisión legal profesional antes de uso comercial.

### `22_DOCUMENTATION_MASTER_GUIDE.md`
Guía de entrega/handoff del paquete a otra IA o equipo externo. Auditada; la duplicación con este archivo (14) fue eliminada.

---

## 7. Workflows recomendados

### 7.1. Iniciar desarrollo con Claude Code

1. Crear repo y carpeta `/docs`.
2. Copiar los 23 archivos `.md` finales (post-auditoría) dentro de `/docs`.
3. Pedirle a Claude Code que lea en el orden de la sección 4.
4. Pedir un resumen de entendimiento antes de tocar código.
5. Validar que no haya malinterpretaciones, especialmente en: loop central con negociación opcional, separación de entidades, y qué está delegado técnicamente (`00` sección 28) vs. qué es decisión de producto.
6. Recién después, setup técnico.

Prompt sugerido: usar el de `13_CLAUDE_PROJECT_INSTRUCTIONS.md` sección 7.1.

### 7.2. Crear base técnica

Documentos: `11`, `12`, `13`.

Pasos: Next.js + TypeScript → estructura de carpetas (ver `11` sección 6) → Supabase → variables de entorno (incluyendo MercadoPago, PayU, monedapi.ar, TusFacturas.app) → layouts → rutas públicas/`/students`/`/residence`/`/admin` → auth → roles base → audit log mínimo → seed inicial.

Criterio de aceptación: ver `12_BUILD_PLAN.md` Fase 0 y Fase 1.

### 7.3. Base de datos

Documentos: `06`, `04`, `05`, `10`.

Pasos: migraciones → enums de estados (incluyendo `family_proposal_status`, estados de negociación) → tablas centrales → relaciones/constraints (incluyendo el `unique` de máximo 1 propuesta de ajuste por solicitud) → índices → RLS → policies por rol (incluyendo aislamiento multi-residencia) → storage buckets (ver `06` sección 26 / `10` sección 28.3, nombres alineados) → seed mínimo.

Criterio de aceptación: ver `12_BUILD_PLAN.md` Fase 1.

### 7.4. Flujo de solicitud, negociación y reserva

Documentos: `03`, `04`, `07`, `08`.

Pasos: propuesta del familiar (opcional) → aprobación del estudiante → crear solicitud → guardar `snapshot_original` → dashboard residencia → residencia establece contacto (botón WhatsApp pre-formateado) → pausar otras solicitudes del estudiante → [opcional: residencia envía propuesta de ajuste, máx. 1 vez → estudiante acepta/rechaza → `snapshot_final`] → habilitar pago a residencia externo → estudiante sube comprobante de referencia → residencia marca pago recibido → crear reserva pendiente de fee → cobrar fee EstuRed (MercadoPago/PayU, sobre `snapshot_final`) → emitir factura fiscal (TusFacturas.app) → confirmar reserva → emitir comprobante con `verification_code` → cerrar otras solicitudes → auditar todo.

Criterio de aceptación: ver `12_BUILD_PLAN.md` Fases 5bis, 6 y 7.

### 7.5. Dashboard residencia (incluyendo multi-residencia)

Documentos: `08`, `09`, `05`, `03`.

Pasos: dashboard single-residence (perfil, disponibilidad, solicitudes, detalle de solicitud con negociación, reservas, lista de espera, habitaciones/plazas, residentes, renovaciones, métricas, configuración/staff) → dashboard multi-residencia (scroll vertical + filtro, sin vista agregada) → feature flag freemium para Gestión Operativa.

Criterio de aceptación: ver `12_BUILD_PLAN.md` Fases 9 y 9bis.

### 7.6. Admin panel

Documentos: `09`, `05`, `10`, `04`.

Pasos: `/admin/dashboard` → residencias → verificación → ediciones de perfil → tarifas → solicitudes → **propuestas del familiar** → **negociaciones** → reservas → pagos → **facturas fiscales** → comprobantes → usuarios → soporte y resolución de conflictos → penalizaciones → audit log → tipo de cambio → **feature flags freemium**.

Criterio de aceptación: ver `12_BUILD_PLAN.md` Fase 11.

### 7.7. Privacidad y comunidad visible

Documentos: `10`, `05`, `06`, `08`.

Pasos: configuración de visibilidad en registro → datos nunca visibles → perfiles invitado/registrado → residentes pendientes de activar → plazas ocupadas sin datos → consentimientos (incluyendo el de propuesta del familiar y el de aceptación de ajuste) → auditoría de cambios de visibilidad → privacidad del contenido de propuestas del familiar antes de aprobación (nunca visible para la residencia).

Criterio de aceptación: ver `10_PRIVACY_AND_LEGAL_RULES.md` sección 30.

---

## 8. Estado de auditoría del paquete

**Los 23 documentos (`00` a `22`) fueron auditados y actualizados.** No quedan documentos pendientes de auditoría.

La ronda de correcciones de 2026-07-05 (Implementation Readiness Review) cerró además: vencimientos unificados a 48h en `00`; tabla canónica de plazos (`00` §9.1); regla de tipo de cambio del `snapshot_final` (hereda el original); estado `expired_fee_unpaid` en reservas; cola por tipo de habitación en Perfil Verificado; contacto con menores siempre al familiar; teléfono obligatorio para solicitar; flujo completo de revocación del fee (endpoint, pantalla, footer, QA, seeds); chargeback como alerta admin; pg_cron confirmado; 2FA admin confirmado; buckets alineados.

**Recordatorio permanente:** `20` y `21` son plantillas legales y requieren revisión profesional antes de operar con residencias/estudiantes reales.

---

## 9. Checklist antes de construir

Ver `13_CLAUDE_PROJECT_INSTRUCTIONS.md` sección 6 (Definition of Done) y `12_BUILD_PLAN.md` sección 27 (criterio de MVP terminado). No se repite acá.

---

## 10. Antipatrones prohibidos

Ver `11_TECH_ARCHITECTURE.md` sección 39 y `12_BUILD_PLAN.md` sección 25-26. No se repite acá.

---

## 11. Cómo propagar un cambio de decisión

Si cambia una decisión de producto durante la construcción, seguir el protocolo de `13_CLAUDE_PROJECT_INSTRUCTIONS.md` sección 5.

Guía rápida de qué archivos suelen verse afectados según el tipo de cambio:

| Si cambia... | Revisar impacto en |
|---|---|
| El fee (%, base de cálculo, moneda) | `00`, `03`, `04`, `06`, `07`, `08`, `10` |
| Un estado de cualquier entidad | `04`, `06`, `07`, UI relacionada en `08`, QA en `16` |
| Un permiso o rol | `05`, RLS, `07`, `08`, QA en `16` |
| Visibilidad de comunidad | `10`, `05`, `06`, `08` |
| El proveedor de pagos, tipo de cambio o facturación | `00`, `07`, `11`, variables de entorno en `15` |
| Reglas de propuesta del familiar o negociación | `03`, `04`, `05`, `06`, `07`, `08`, `10` |
| Acceso freemium a Gestión Operativa | `00`, `03`, `06`, `09`, `11` |
| Términos legales o textos de aceptación | `10`, `20`, `21` |

---

## 12. Estado actual del paquete documental

Auditados y actualizados: `00` a `22` (los 23 archivos).

**El paquete está listo para handoff a Claude Code y para iniciar la Fase 0 de `12_BUILD_PLAN.md`**, sujeto únicamente a los pendientes no bloqueantes registrados en `00_DECISION_LOG.md` §29 (revisión legal profesional, precio de Gestión Operativa, validación de PayU en USD, dominio, proveedor de email).

---

## 13. Regla final

EstuRed debe construirse como un sistema transaccional de confianza, no como un catálogo visual.

El MVP no está terminado cuando la búsqueda funciona. Está terminado cuando se completa el loop definido en `00_DECISION_LOG.md` sección 4, de punta a punta, de forma auditable y operable desde admin — incluyendo la instancia opcional de negociación y la emisión automática de factura fiscal.
