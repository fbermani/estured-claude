# Preapertura 2026-11 · Especificación para `interfaz` (v3)

Mockups: `index.html` y una página por pantalla. La barra oscura de arriba es solo del mockup. Lo que está a validar figura en `CAMBIOS_SUGERIDOS.md`.

## Patrón común: landing blureada + pop-up
- **Fondo:** la landing de preapertura completa (hero, residencias, beneficios, carrusel de comunidad, paso a paso) renderizada con `filter: blur(6px)`, un velo `forest-ink` al 20–40 %, `aria-hidden` + `inert` y scroll propio. Etiqueta fija «Así se va a ver EstuRed», con candado.
  - En Mi lugar, el fondo es el panel del estudiante blureado («Tu panel · se activa cuando abramos»).
  - En residencias, es `/for-residences` blureado, sin los planes.
- **Pop-up (`PreaperturaDialog`):** `role=dialog` + `aria-modal`, no se puede cerrar, recibe el foco al entrar y lo mantiene adentro.
  - Desktop: centrado, de 540 px (entrada), 680 px (residencias) o 900–980 px (pasos con panel lateral).
  - El pop-up flota siempre: margen de al menos 48 px en desktop (el fondo blureado se ve por todos lados), sombra profunda y radio de 30 px. Los pasos con panel lateral lo llevan como tarjeta interna redondeada (padding de 10 px).
  - Menos de 640 px: bottom-sheet flotante (margen de 10 px, todas las esquinas redondeadas, alto máximo = pantalla − 92 px), con manija y scroll interno.
- **Tokens FRESH** (sin tokens nuevos):
  - Píldora «Acceso anticipado» en gradiente `orange` con punto pulsante (`prefers-reduced-motion` la deja quieta).
  - Insignia «Gratis» en `forest-tint`.
  - Fundadoras en `gold` (uso puntual).
  - Ejemplos en `butter`.
- **Componentes:** se reusan `Button`, `Input`/`Select`, `Badge`, `Icon`, `BrandMark` y el avatar con bandera de `CommunityBrowser`. Nuevos: `PreaperturaDialog`, `BlurredPreview`, `EarlyAccessPill`, `FreeBadge`, `LiveCount`, `MiniCommunityRail`, `ProfileMeter`, `FounderMeter` y `Countdown`.

## Pantallas
1. **Entrada `/`.**
   - Contenido: píldora, H1 (A recomendado: «Encontrá tu residencia en Buenos Aires sin ir a ciegas.»), bajada, «Sumarte es gratis», 2 ticks, CTA «Sumarme gratis» y contador real.
   - Carrusel «Se están sumando» con movimiento (ejemplos rotulados hasta tener reales).
   - Enlaces: «Soy familiar de un estudiante» y «¿Ya te sumaste? Ingresá».
   - CTA de residencias destacado («Quiero ser fundadora», fondo `forest-ink` con botón `gold`): «Quedan N de 10 lugares de Residencia fundadora. Gratis.» con dato real. Con 1–2 residencias: «Ya hay residencias registrándose». Con 0: sin esa frase. En desktop ancho flota fuera del pop-up, abajo a la derecha; en móvil va al final del pop-up.
2. **Paso 1.**
   - Panel izquierdo (desktop): urgencia con «#N tu lugar si terminás ahora», 3 ticks y un mini carrusel con ejemplos rotulados. En móvil queda una franja con píldora y #N.
   - Formulario: Google (si existe), email, contraseña, fecha de nacimiento (18+, obligatoria; con Google se pide aparte antes de crear la cuenta) y un casillero obligatorio sin tildar.
   - Estados: enviando, error de campos, email ya registrado y sin conexión.
   - Menor de 18 (validado en el servidor): no se crea la cuenta. Aparece «Sumate con tu familia: pedile a tu mamá, papá o a un familiar que se registre y te invite. Así sus cuentas quedan conectadas.» con [Ir al registro familiar] y [Copiar link para mi familia]. Un menor solo entra con el link de invitación de un familiar, que saltea el bloqueo por edad.
3. **Paso 2.**
   - «Armá tu perfil» con medidor de % y tarjeta en vivo (a la derecha en desktop, dentro del flujo en móvil).
   - Campos: nombre, país → provincia si elige Argentina, universidad, carrera, mes (enero a abril y «Todavía no sé»), tipo de habitación, hábitos (2), intereses (2) y «¿Ya estás en una residencia?» con «¿Cuál?».
   - Una línea de comunidad: «Mostrar mi perfil (nombre, edad, país, carrera, hábitos e intereses) en la comunidad de la web».
   - Estado «Menor invitado»: el casillero de comunidad queda deshabilitado («Disponible desde los 18 años»).
   - Columna derecha sticky (desktop): «Así te van a ver» (tarjeta de perfil) y debajo la tarjeta de búsqueda «Busca residencia en Buenos Aires»: viene de…, tipo de habitación, «Cerca de [universidad]» y desde qué mes. Se completa en vivo; mientras está vacía muestra placeholders en gris («Cerca de tu universidad», «Desde enero, febrero, marzo…»).
   - Móvil: resumen sticky arriba del formulario (avatar + nombre · tipo · universidad · mes) que se despliega para ver las dos tarjetas.
   - Acciones: «Terminar» y «Lo completo después».
4. **Familiar.** El familiar mayor se registra primero e invita (obligatorio si el estudiante es menor de 18). Una pantalla: beneficios de acompañar (a la izquierda), su email y contraseña, el email del hijo/a y el casillero. CTA «Crear cuenta e invitar». Errores: email inválido o el mismo email propio.
5. **Mi lugar (final).**
   - Celebración: «¡Listo! Ya estás adentro», #N y «te vas a enterar primero…».
   - «Cuando se active tu cuenta, acá vas a ver tu panel».
   - 5 pasos (copy de `/for-students`, resumido) y carrusel «Se siguen sumando».
   - Variantes: perfil incompleto (invita a completar) y familiar (invitación esperando o vinculados).
   - Pie: «Editar mi perfil» y «Salir».
6. **Fundadoras.**
   - Vistazo: «Menos mensajes, más residencia. Y gratis.», medidor de cupo real (de 10) con la frase condicional, cuenta regresiva (fecha a definir), «Gratis para tu residencia», 4 beneficios en lista tipográfica (una línea cada uno, guion dorado, sin tarjetas ni íconos), contador de estudiantes (dato real), la insignia y «Y tienen el Plan Premium bonificado» (sin planes, precios ni comisión; igual en el mail).
   - CTA «Quiero que me contacten» → formulario de 5 campos, todos obligatorios: nombre de la residencia, dirección, tu nombre, teléfono/WhatsApp y email. Validación en el cliente y en el servidor. Estados: campos vacíos (alerta «Completá los 5 datos para que te contactemos.» + error por campo con `aria-invalid`), enviando y error de servidor.
   - Estados: 0, 1–2, 4, 10 y cerrado.
7. **Solicitud de residencia enviada.** Confirmación con el lugar de fundadora (según el cupo), línea de tiempo de 4 pasos y el email de confirmación (vista «Email»).
8. **Legales.** `consentimientos.html`, también como pop-up sobre la landing blureada, con pestañas fijas arriba: las dos líneas del flujo, la opción C y la comunidad en Términos §7, y la política de privacidad.

## Accesibilidad
- Foco visible de 3 px. Botones y campos de 44 px o más (CTA de 54–56 px). Chips compactos de 34 px con 6 px de separación, a pedido del dueño: cumplen WCAG 2.5.8 AA (24 px) pero no la regla interna de 44 px. Errores con `role=alert` y `aria-invalid`.
- Los carruseles se pausan con hover y foco, y con `reduced-motion` pasan a scroll manual.
- Los estados nunca dependen solo del color.
- El fondo blureado queda fuera del árbol de accesibilidad.

## Reglas respetadas
- Sin fecha de apertura y sin promesas de disponibilidad, reserva ni match.
- «Gratis» se usa solo para sumarse.
- Sin «mediación» y sin mención de Sin Fronteras.
- Ejemplos siempre rotulados. Contadores reales.
- Cuentas propias solo para mayores de 18. Los menores entran solo invitados por un familiar mayor y nunca aparecen en la comunidad pública. El familiar no da permisos por el estudiante.

## Revisión
Servir con `Cache-Control: no-store` (puerto 8790). Cada HTML lleva un sello «v3 · fecha hora» abajo a la izquierda (solo del mockup).
