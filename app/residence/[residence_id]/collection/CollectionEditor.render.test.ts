import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }), usePathname: () => "/" }));
vi.mock("@/app/residence/[residence_id]/collection/actions", () => ({ saveReservationCollectionAction: async () => ({ status: "success", pendingChanges: 0 }) }));

import { CollectionEditor, type CollectionEditorAccount } from "@/app/residence/[residence_id]/collection/CollectionEditor";
import { ProfileCollectionCard } from "@/app/residence/[residence_id]/profile/ProfileCollectionCard";

const SECRET = "CBU 0170099220000067797370 alias casa.norte";

function renderEditor(props: { modes?: ("enabled_methods" | "whatsapp_direct")[]; methods?: ("cash" | "transfer_ars" | "other")[]; accounts?: CollectionEditorAccount[] }) {
  return renderToStaticMarkup(
    createElement(CollectionEditor, {
      residenceId: "res-1",
      initialModes: props.modes ?? [],
      initialMethods: props.methods ?? [],
      accounts: props.accounts ?? [],
    }),
  );
}

describe("pantalla «Cobro de la reserva» del dueño (render del servidor)", () => {
  it("sin configurar: dos opciones sin tildar, sin lista de medios y con «Guardar y volver»", () => {
    const html = renderEditor({});
    expect(html).toContain("Cobro con medios habilitados");
    expect(html).toContain("Contacto directo por WhatsApp");
    expect(html).toContain("Con medios habilitados, EstuRed te evita ese chat hasta la confirmación final.");
    expect(html).toContain("Con contacto directo, la coordinación del pago queda en tu equipo. Es el trabajo que EstuRed busca ahorrarte.");
    expect(html).not.toContain("Medios que aceptás");
    expect(html).toContain("Guardar y volver");
    expect(html).toContain("No tenés cambios sin guardar.");
  });

  it("con medios habilitados muestra los 12 medios y, por cada elegido, su campo de datos", () => {
    const html = renderEditor({ modes: ["enabled_methods"], methods: ["cash"] });
    expect(html).toContain("Medios que aceptás");
    for (const label of ["Efectivo", "MercadoPago", "Transferencia en pesos", "Transferencia en dólares", "Belo", "Prex", "Ualá", "Brubank", "PayPal", "Airtm", "Western Union", "Otro"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("Datos de cobro");
    expect(html).toContain("Sin datos");
    expect(html).not.toContain("Nombre del medio");
  });

  it("«Otro» pide nombre", () => {
    expect(renderEditor({ modes: ["enabled_methods"], methods: ["other"] })).toContain("Nombre del medio");
  });

  it("los datos ya cargados salen enmascarados: el texto completo no está en el HTML", () => {
    const html = renderEditor({
      modes: ["enabled_methods"],
      methods: ["transfer_ars"],
      accounts: [{ methodKey: "transfer_ars", state: "pending", hasApproved: false, rejectedReason: null, details: SECRET, label: "" }],
    });
    expect(html).toContain("Pendiente de aprobación");
    expect(html).toContain("Mostrar y editar");
    expect(html).toContain("•••• ");
    expect(html).not.toContain("0170099220000067797370");
    expect(html).not.toContain("casa.norte");
  });

  it("un medio rechazado muestra el estado y el motivo del admin (solo el dueño ve esta pantalla)", () => {
    const html = renderEditor({
      modes: ["enabled_methods"],
      methods: ["transfer_ars"],
      accounts: [{ methodKey: "transfer_ars", state: "rejected", hasApproved: true, rejectedReason: "El alias no coincide con el titular.", details: SECRET, label: "" }],
    });
    expect(html).toContain("Rechazado");
    expect(html).toContain("Siguen rigiendo los datos anteriores.");
    expect(html).toContain("Motivo: El alias no coincide con el titular.");
    expect(html).not.toContain("0170099220000067797370");
  });

  it("con ambas opciones explica que se elige por solicitud", () => {
    expect(renderEditor({ modes: ["enabled_methods", "whatsapp_direct"], methods: ["cash"] })).toContain("elegís el camino en cada solicitud");
  });
});

describe("tarjeta «Cobro de la reserva» de la configuración", () => {
  const summary = { modes: ["enabled_methods"], acceptedMethods: ["transfer_ars", "cash"], states: { transfer_ars: "pending", cash: "approved" } as const };
  const render = (isOwner: boolean, s: Parameters<typeof ProfileCollectionCard>[0]["summary"] = { ...summary, states: { ...summary.states } }) =>
    renderToStaticMarkup(createElement(ProfileCollectionCard, { residenceId: "res-1", summary: s, isOwner }));

  it("el dueño ve las opciones, el estado de cada medio y el enlace a la pantalla", () => {
    const html = render(true);
    expect(html).toContain("Esto define solo el pago de la reserva. Los pagos siguientes los acordás con cada estudiante.");
    expect(html).toContain("Pendiente de aprobación");
    expect(html).toContain("Aprobado");
    expect(html).toContain('href="/residence/res-1/collection"');
  });

  it("el staff ve el aviso, sin estados de medios ni enlace", () => {
    const html = render(false);
    expect(html).toContain("Solo el dueño puede ver y editar los datos de cobro.");
    expect(html).not.toContain("Pendiente de aprobación");
    expect(html).not.toContain("/collection");
  });

  it("sin configurar lo dice, y sin la migración (null) muestra «no disponible»", () => {
    expect(render(true, { modes: null, acceptedMethods: null, states: {} })).toContain("Todavía no elegiste cómo cobrás la reserva.");
    expect(render(true, null)).toContain("todavía no está disponible");
  });
});
