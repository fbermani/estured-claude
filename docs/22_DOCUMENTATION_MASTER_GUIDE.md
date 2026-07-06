# 22_DOCUMENTATION_MASTER_GUIDE.md

# Guía Madre de Documentación EstuRed

**Versión:** 1.1 (reducida)
**Estado:** Recortado para eliminar duplicación con `14_PROJECT_INDEX.md` y `13_CLAUDE_PROJECT_INSTRUCTIONS.md`
**Última actualización:** 2026-06-27

---

## 1. Qué es este documento y por qué es distinto de `14_PROJECT_INDEX.md`

Este archivo y `14_PROJECT_INDEX.md` cumplían originalmente la misma función: mapa de navegación del paquete documental, orden de lectura, jerarquía y descripciones archivo por archivo. Esa duplicación se eliminó en esta revisión.

**Diferencia que se conserva:**

- `14_PROJECT_INDEX.md` es la referencia de navegación interna del proyecto — a qué archivo ir para cada tema, qué contiene cada uno, workflows por módulo.
- Este archivo (`22`) es específicamente el **paquete de entrega** cuando el proyecto se transfiere a otra IA, a un desarrollador nuevo o a un equipo externo que no participó de la construcción del paquete documental. Su valor está en los prompts reutilizables y en el resumen de cierre, no en repetir el índice.

**Para todo lo demás —orden de lectura, jerarquía documental, descripción de cada archivo, qué cargar según tarea, antipatrones, checklist de entrega de tareas, protocolo de cambios futuros— la referencia es:**

- Orden de lectura y descripción de archivos → `14_PROJECT_INDEX.md` secciones 4 y 6.
- Jerarquía documental → `13_CLAUDE_PROJECT_INSTRUCTIONS.md` sección 2.
- Qué cargar según el tipo de tarea → `14_PROJECT_INDEX.md` sección 7.
- Antipatrones prohibidos → `11_TECH_ARCHITECTURE.md` sección 39 y `12_BUILD_PLAN.md` secciones 25-26.
- Definition of Done / checklist de entrega → `13_CLAUDE_PROJECT_INSTRUCTIONS.md` sección 6.
- Protocolo de cambios futuros en la documentación → `13_CLAUDE_PROJECT_INSTRUCTIONS.md` sección 5.

No repetir esos contenidos acá evita que una actualización futura (por ejemplo, un cambio de proveedor de pago) quede corregida en un archivo y desactualizada en otro.

---

## 2. Resumen ejecutivo del proyecto (una línea, sin detalle)

EstuRed es una webapp SaaS/marketplace de residencias estudiantiles en CABA. El loop central completo —con su instancia opcional de negociación de condiciones y su emisión automática de factura fiscal— está definido en `00_DECISION_LOG.md` sección 4. No se repite acá.

---

## 3. Reglas fundamentales de uso del paquete (resumen mínimo)

1. Leer primero `00_DECISION_LOG.md` y `14_PROJECT_INDEX.md`.
2. No inventar reglas de negocio no documentadas.
3. No fusionar propuesta del familiar, solicitud, negociación, pago a residencia, reserva, fee, factura fiscal y comprobante.
4. Ante contradicción entre documentos, no improvisar: detenerse y pedir aclaración.

El detalle completo de reglas críticas vive en `13_CLAUDE_PROJECT_INSTRUCTIONS.md` y en cada documento fuente. Esto es solo el recordatorio de entrada.

---

## 4. Prompts reutilizables para transferir el proyecto a otra IA

Estos son los únicos prompts pensados para el escenario de **handoff externo** (otra IA, otro desarrollador, otro equipo que arranca de cero con este paquete). Para prompts de trabajo día a día dentro de una sesión de Claude Code ya en marcha, usar los de `13_CLAUDE_PROJECT_INSTRUCTIONS.md` sección 7.

### 4.1. Prompt de onboarding inicial

```text
Vas a trabajar en el proyecto EstuRed. Antes de proponer o implementar
cualquier cosa, leé los documentos adjuntos en el orden indicado por
14_PROJECT_INDEX.md sección 4.

Reglas críticas:
- No inventes reglas de negocio.
- No mezcles propuesta del familiar, solicitud, negociación de
  condiciones, pago a residencia, reserva, fee EstuRed, factura fiscal
  y comprobante.
- No emitas comprobante ni factura fiscal sin fee EstuRed pagado.
- No publiques residencias sin verificación.
- Respetá las rutas /students, /residence (con soporte
  multi-residencia) y /admin.
- Respetá roles, permisos, privacidad y auditoría.
- No integres la API de WhatsApp Business bajo ninguna circunstancia.
- Si hay contradicción entre documentos, aplicá la jerarquía de
  13_CLAUDE_PROJECT_INSTRUCTIONS.md sección 2, y si no se resuelve,
  preguntá antes de asumir.
- Si falta una decisión, preguntá antes de implementar.

Tu primera respuesta debe ser un resumen de lo que entendiste y un
plan de implementación por pasos para la tarea solicitada.
```

### 4.2. Prompt para una tarea específica

```text
Usá los documentos del proyecto EstuRed como fuente de verdad. Quiero
implementar: [DESCRIBIR TAREA].

Antes de escribir código:
1. Indicá qué documentos del paquete vas a usar.
2. Confirmá qué reglas de negocio aplican.
3. Listá entidades, estados y permisos involucrados.
4. Señalá riesgos o ambigüedades.
5. Proponé un plan de implementación pequeño y verificable.

No implementes funcionalidades fuera del alcance documentado en
02_MVP_SCOPE.md.
```

### 4.3. Prompt para revisión de consistencia

```text
Revisá si la solución propuesta respeta la documentación de EstuRed.

Verificá especialmente:
- reglas de negocio;
- estados y transiciones, incluyendo propuesta del familiar y
  negociación de condiciones;
- permisos, incluyendo aislamiento multi-residencia;
- privacidad;
- separación entre propuesta, solicitud, negociación, pago a
  residencia, reserva, fee, factura fiscal y comprobante;
- auditoría;
- rutas;
- alcance MVP;
- seguridad y RLS;
- QA requerido.

Si encontrás una contradicción, explicá dónde está y cómo corregirla
sin inventar nuevas reglas.
```

---

## 5. Estado actual del paquete documental

Los 23 documentos (`00` a `22`) fueron auditados y actualizados para reflejar las decisiones consolidadas del proyecto: MercadoPago + PayU como proveedores de pago; monedapi.ar (dólar blue, valor venta) como fuente de tipo de cambio; TusFacturas.app para facturación fiscal automática del fee (Factura C, monotributista); WhatsApp exclusivamente como botón manual pre-formateado, sin integración de API; propuesta de solicitud del familiar sujeta a aprobación del estudiante; negociación de condiciones limitada a una propuesta de ajuste por solicitud; multi-residencia (hasta 10 por owner); modelo freemium para Gestión Operativa vía feature flag; vencimientos unificados a 48 horas; terminología "Soporte y Resolución de Conflictos" en reemplazo de "Mediación".

El proyecto está listo para pasar a creación de repositorio, setup técnico y construcción por fases, sujeto a los pendientes explícitamente marcados como no resueltos en `00_DECISION_LOG.md` sección 29 y en las secciones de "pendientes legales" de `10`, `20` y `21`.

---

## 6. Próximo paso recomendado

1. Crear repositorio.
2. Copiar carpeta `/docs` con los 23 archivos `.md` finales.
3. Cargar `13_CLAUDE_PROJECT_INSTRUCTIONS.md` y `14_PROJECT_INDEX.md` en Claude Code como referencia permanente.
4. Pedir plan técnico inicial basado en `12_BUILD_PLAN.md` (Fase 0) y `15_ENVIRONMENT_AND_SETUP.md`.
5. Empezar por setup, auth, roles, RLS y audit log — no por pantallas visuales.

No seguir agregando documentación estratégica salvo que aparezca una decisión de producto nueva. En ese caso, seguir el protocolo de `13_CLAUDE_PROJECT_INSTRUCTIONS.md` sección 5 antes de tocar código.
