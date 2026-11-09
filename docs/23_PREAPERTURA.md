# 23_PREAPERTURA.md
# EstuRed — Preapertura: captación previa al lanzamiento

Última actualización: 2026-11-08. Estado: **implementado en dev (Fases 1–3, sin commit); prod pendiente** (checklist en `docs/NEXT_STEPS.md`). Protocolo `docs/13` §5: doc primero.
Decisiones: `docs/00_DECISION_LOG.md` DR42–DR47 (mandan ante cualquier contradicción). Referencia visual aprobada (v4): `design-proposals/preapertura-2026-11/` (9 HTML + `SPEC.md` + `CAMBIOS_SUGERIDOS.md`).

## 1. Objetivo y principios

- Captar estudiantes (y familiares) antes de abrir, y que esos registros atraigan a residencias **fundadoras** sin prospección en frío.
- **Urgencia real** («llegar primero»), **mínimo de texto**, **gratis** muy claro. Beneficio principal: enterarse primero cuáles son las residencias verificadas.
- Sin fecha de apertura; sin promesas de disponibilidad, reserva ni match; «Soporte», no «mediación»; todos los contadores reales.

## 2. Arquitectura (DR42)

- Flag `PREAPERTURA=on` (env de Vercel prod). Páginas en `app/(preapertura)/` con header/footer propios. Rutas: `/preregistro`, `/preregistro/familiar`, `/mi-lugar`.
- **Desarrollo vs. producción (2026-11-09, decisión del dueño):** con `PREAPERTURA=on` en **desarrollo** solo cambia que `/` muestra el popup y que existen sus pantallas (`/preregistro`, `/fundadoras`, `/mi-lugar`…); el resto del sitio funciona como siempre (Navbar y Footer reales, `/search`, `/for-students` real, `/students/*`) y «Crear cuenta» del header lleva a `/register` (selector de rol; distinto del «Sumarme gratis» del popup, que va a `/preregistro`). En **producción** (preapertura «cerrada», `isPreaperturaLocked()`) el popup no se cierra y no hay navegación al sitio abierto: rige lo de abajo. El pill «Acceso anticipado» ya no está en el header. En desarrollo el popup cerrado («Cerrar (solo dev)») queda cerrado al cambiar de pantalla hasta apretar «Volver al popup (solo dev)».
- `next.config` (solo en producción, salvo `/` y `/register/residence`, que rigen también en desarrollo): reescribe `/` y `/for-students` a la versión de preapertura; redirige `/search`, `/register`, `/waitlist` a `/preregistro`; `/students/*` redirige a «Mi lugar». `/for-residences` no se reescribe (solo cambia el header, sin «Crear cuenta»). «Sumar mi residencia» va directo a `/register/residence`.
- Fase 3: `/fundadoras` (popup de fundadoras; su CTA lleva a `/register/residence`, que con flag se reescribe a `/fundadoras/datos`), `/consentimientos` (legales; la misma sección «preapertura» vive en `/terms` y `/privacy` con flag) y `FOUNDERS_CLOSE_AT` (env opcional, ISO 8601: sin ella no hay cuenta regresiva).
- `/guias`: no se enlaza y **no se redirige** (SEO). Landings, Navbar y Footer actuales no se tocan; al abrir se apaga el flag.
- Tablas nuevas (preinscriptos, interesados); no se reutiliza `waitlist_signups`.
- Patrón visual: la landing REAL de fondo, completa y con su Navbar y Footer reales (`HomeBackdrop` = `HomeLanding` de la home; `ResidencesBackdrop` = `ResidencesLanding` de `/for-residences`, planes incluidos; ambas extraídas de las rutas para renderizar idéntico), en flujo normal con scroll del documento, `inert` + `aria-hidden`, con blur y velo en una capa fija (nunca maquetas) + `PreaperturaDialog` (`role=dialog`, no cerrable, foco atrapado; bottom-sheet en <640 px). Componentes nuevos: `PreaperturaDialog`, `BlurredPreview`, `EarlyAccessPill`, `FreeBadge`, `LiveCount`, `MiniCommunityRail`, `ProfileMeter`, `FounderMeter`, `Countdown`. Detalle en `SPEC.md`.

## 3. Flujo del estudiante (DR43)

1. **Entrada `/`:** H1 A «Encontrá tu residencia en Buenos Aires sin ir a ciegas.», «Sumarte es gratis», CTA «Sumarme gratis», contador (desde 25; antes «Sé de los primeros»), carrusel, enlaces «Soy familiar» e «Ingresá».
2. **Paso 1:** email, contraseña, rol, fecha de nacimiento (18+, validada en servidor), casillero obligatorio de términos (incluye la opción C, §5). Urgencia «#N tu lugar si terminás ahora» (registrados + 1; sin prioridad ni reserva). Estados: enviando, error de campos, email ya registrado, sin conexión.
3. **Menor de 18:** no se crea cuenta; se lo deriva a pedirle a un familiar mayor que se registre e invite («Ir al registro familiar» / «Copiar link» de la página de registro familiar, no de una invitación). Entra solo por la invitación; no puede activar la comunidad.
4. **Paso 2 (opcional, «Lo completo después»):** campos y tarjetas en vivo según DR43.3. Sin presupuesto, sin zona.
5. **Familiar:** una pantalla (su cuenta + email del estudiante), reutiliza `/register/family` + `family_links`; una invitación, sin recordatorios; no da consentimientos por el estudiante.
6. **«Mi lugar»:** celebración, #N, 5 pasos, carrusel; variantes perfil incompleto y familiar; «Editar mi perfil» y «Salir».

## 4. Carrusel público de comunidad (DR44)

- Muestra solo lo que consintió el estudiante 18+ (casillero de una línea, sin tildar): nombre sin apellido, edad, país, carrera, hábitos e intereses; avatar con inicial + bandera; nunca la residencia actual. Se retira desde «Editar mi perfil».
- **Ejemplos rotulados** («Ejemplo») hasta tener reales; se retiran de a uno por cada real y se apagan al llegar a ~12 (a confirmar). Contadores siempre reales.

## 5. Opción C y consentimiento mínimo (DR45)

- Casillero obligatorio del paso 1: «Acepto los Términos y la Privacidad, incluido mostrar mi búsqueda sin nombre ni contacto a residencias verificadas». Detalle en Términos §7 (texto propuesto en `consentimientos.html`).
- El contacto se entrega solo con un clic aparte del estudiante; nunca se ofrece a una residencia quien ya vive ahí ni se revela de qué otra residencia viene.
- «1–2 opciones verificadas»: solo residencias externas; Sin Fronteras queda fuera; se activa tras el primer acuerdo externo.
- Sin Fronteras **no se menciona por escrito**; la divulgación es oral y en persona (DR45.3).
- **Riesgo asumido por el dueño:** textos sin validación legal frente a la Ley 25.326.

## 6. Residencias fundadoras (DR46)

- Entrada: CTA destacado en la landing («Quiero ser fundadora») → pantalla de fundadoras (popup sobre la `/for-residences` real; el dueño aceptó que se vean los planes como escenografía inerte) → «Quiero que me contacten».
- Cupo **real de 10** (solicitudes + en verificación; el lugar se libera si no avanza). **Prohibido** bajar el cupo sin altas reales. Cuenta regresiva a fecha real (pendiente). Frase «ya hay residencias registrándose» solo con la primera externa; contador de residencias desde 3 reales.
- Beneficios: insignia «Residencia fundadora» + jerarquía al abrir (con etiqueta explícita) y Plan Premium bonificado el primer año en una línea, sin planes ni precios. Sin descuento en comisión.
- Formulario (`/register/residence`, tabla `residence_signup_requests`, sin cuenta): 5 campos obligatorios (residencia, **dirección**, responsable, teléfono/WhatsApp, email). Pantalla de éxito + email; el equipo contacta, coordina charla y visita, y recién ahí entrega la cuenta. Sin «Mi lugar» para dueños.

## 7. Copy guía

Titulares recomendados: estudiantes A (§3.1); fundadoras «Menos mensajes, más residencia. Y gratis.». Voseo rioplatense. No usar: «reserva garantizada», «mediación», escasez fabricada, Sin Fronteras. Tarjeta de búsqueda con placeholders grises mientras esté vacía.

## 8. Tareas futuras de datos (NO escritas, requieren migración y aprobación)

- Columna de dirección en `residence_signup_requests` (reemplaza barrio; hoy guarda barrio).
- Tabla de estudiantes preinscriptos (año de ingreso, flags de comunidad/C, país/provincia, hábitos e intereses, invitación familiar con vencimiento) y tabla de interesados; RLS solo service role para PII.
- Persistir año de ingreso (meses Ene–Abr sin año en UI) y fecha de nacimiento / validación 18+.
- Datos de los ejemplos del carrusel (con marca explícita de ficticio) y contadores derivados de la base.

## 9. Pendientes abiertos

- Fecha de cierre de fundadoras (se define al lanzar).
- Instagram: comunicación y si va en el formulario (hoy se pide en la charla).
- Datos del responsable legal de la política de privacidad.
- Vencimiento y reenvío de la invitación familiar (hoy: una, sin recordatorios).
- Plazo de contacto a residencias tras la solicitud.
- Duración de la insignia «Residencia fundadora» y de la jerarquía.
- Existencia de Google OAuth (DR26: no existe hoy).
- Validación de la edad del familiar (hoy declaración en Términos).
- Cantidad exacta de ejemplos a retirar (~12) y tope/presupuesto de campaña.
- Validación legal de consentimientos y política (Ley 25.326): **no realizada, riesgo asumido por el dueño**.

### Riesgos aceptados por el dueño (2026-11-08, revisión de seguridad)
- **Paso 1 sin verificación de mail** (`email_confirm: true`): decisión de fricción mínima; permite registrarse con un mail ajeno.
- **«Ya hay una cuenta con ese email»** se mantiene tal cual (enumeración de cuentas): se cubre con el WAF de Vercel sobre `/preregistro`, `/preregistro/familiar`, `/register/residence` y `/fundadoras/datos`. Los frenos de la app (IP y email) son en memoria y por instancia.
- **Invitación familiar:** el token sale solo por mail al email del invitado (fijo al canjear); sin mail no se emite (solo en desarrollo se muestra el link); el familiar declara ser mayor de 18. Un menor invitado no da la opción C ni la comunidad.
- **`/register/residence` con `address`** aplica también con el flag apagado (DR46.4). La 0080 debe aplicarse en prod ANTES de desplegar: el fallback pre-0080 guarda la dirección en `neighborhood`.
- Con el flag encendido `/register/student` y `/register/family` quedan cerrados (redirect + corte en servidor); las invitaciones de residencias (DR19) no operan durante la preapertura.
