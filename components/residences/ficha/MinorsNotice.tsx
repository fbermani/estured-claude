/**
 * Aviso «Para menores de 18» del capítulo «La comunidad». La edad de los residentes (rango que admite la residencia y promedio de la
 * comunidad) vive ahora como subtítulo del capítulo (`buildAgeFacts().subtitle`), así que acá queda solo el aviso, y solo si la
 * residencia admite menores.
 */
export function MinorsNotice() {
  return (
    <div id="edad" className="scroll-mt-36 rounded-card border-[1.5px] border-line bg-paper p-5">
      <h3 className="text-base font-bold text-ink">Para menores de 18</h3>
      <p className="mt-2 text-[15px] text-ink-soft">
        Esta residencia admite residentes menores de 18. Consultá con la residencia las condiciones que aplican y, al enviar tu solicitud de reserva, tu guardián
        deberá confirmar la solicitud. La solicitud queda sujeta a confirmación de la residencia.
      </p>
    </div>
  );
}
