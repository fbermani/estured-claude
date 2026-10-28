/**
 * Mensaje modelo para invitar a los residentes a crear su cuenta en EstuRed (DR18 punto 20).
 * Envío MANUAL por la residencia: solo se arma un enlace wa.me (sin elegir destinatario, así
 * funciona para un grupo o un contacto). Nunca se usa la API de WhatsApp Business.
 */
export function buildResidentInviteMessage(params: { residenceName: string; registerUrl: string }): string {
  const name = params.residenceName.trim() || "tu residencia";
  return [
    `¡Hola! Te escribimos de ${name}.`,
    "Estamos ordenando las habitaciones y los contratos en EstuRed. Para eso necesitamos que crees tu cuenta con el mismo email que nos diste, así tu perfil queda vinculado a tu estadía.",
    `Registrate acá (te lleva un minuto): ${params.registerUrl}`,
    "Cualquier duda, escribinos por acá.",
  ].join("\n\n");
}

export function buildResidentInviteWhatsappUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
