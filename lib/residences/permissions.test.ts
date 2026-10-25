import { describe, expect, it } from "vitest";
import {
  ALWAYS_AVAILABLE_TO_STAFF,
  can,
  defaultPermissions,
  diffPermissions,
  isResidencePermission,
  NO_PERMISSION_NOTE,
  noPermissions,
  normalizeResidenceRole,
  ownerPermissions,
  parseStrictPermissions,
  OWNER_ONLY_ACTIONS,
  OWNER_ONLY_MESSAGE,
  PERMISSION_DENIED_MESSAGE,
  PERMISSION_PRESETS,
  permissionLabel,
  permissionsFromChecked,
  permissionsVersion,
  presetPermissions,
  RESIDENCE_PERMISSION_KEYS,
  residenceActorRole,
  resolveStaffPermissions,
  STAFF_PERMISSION_GROUPS,
  STAFF_PERMISSIONS,
  type ResidencePermission,
} from "@/lib/residences/permissions";

/** Las 10 claves aprobadas por el dueño del producto (DR11), con su valor inicial. */
const EXPECTED: Record<ResidencePermission, boolean> = {
  "applications.review_contact": true,
  "applications.reject": true,
  "payments.residence": true,
  "applications.send_adjustment": false,
  "operations.rooms_availability": true,
  "residents.manage": true,
  "renewals.manage": true,
  "waitlist.manage": true,
  "faq.manage": true,
  "profile.edit": false,
};

describe("lista de permisos (DR11)", () => {
  it("son exactamente las 10 claves aprobadas, en orden, con su valor inicial", () => {
    expect(STAFF_PERMISSIONS.map((p) => p.key)).toEqual(Object.keys(EXPECTED));
    expect(defaultPermissions()).toEqual(EXPECTED);
  });

  it("cada permiso tiene etiqueta y descripción en español, un grupo conocido y claves únicas", () => {
    const groups = new Set<string>(STAFF_PERMISSION_GROUPS.map((g) => g.id));
    for (const p of STAFF_PERMISSIONS) {
      expect(p.label.length, p.key).toBeGreaterThan(3);
      expect(p.description.length, p.key).toBeGreaterThan(10);
      expect(groups.has(p.group), p.key).toBe(true);
    }
    expect(new Set(RESIDENCE_PERMISSION_KEYS).size).toBe(STAFF_PERMISSIONS.length);
    expect(permissionLabel("faq.manage")).toBe("Preguntas de la ficha");
    expect(permissionLabel("clave.inventada")).toBe("clave.inventada");
  });

  it("proponer ajustes y editar el perfil nacen apagados; todo lo demás, encendido", () => {
    const off = STAFF_PERMISSIONS.filter((p) => !p.defaultEnabled).map((p) => p.key);
    expect(off).toEqual(["applications.send_adjustment", "profile.edit"]);
  });

  it("lo no delegable y lo siempre disponible están documentados", () => {
    expect([...OWNER_ONLY_ACTIONS]).toEqual(["team.manage", "residence.add", "profile.submit_verification", "reports.portfolio_pdf"]);
    expect([...ALWAYS_AVAILABLE_TO_STAFF]).toEqual(["view_panel_read_only", "support.open", "notifications.read"]);
  });

  it("mensajes acordados", () => {
    expect(PERMISSION_DENIED_MESSAGE).toBe("No tenés permiso para esta acción. Pedíselo al dueño de la residencia.");
    expect(OWNER_ONLY_MESSAGE).toBe("Esta acción la puede hacer solo el dueño de la residencia.");
    expect(NO_PERMISSION_NOTE).toBe("Pedile este permiso al dueño.");
  });
});

describe("resolveStaffPermissions: valores guardados → mapa completo", () => {
  it("solo un objeto VACÍO {} (staff anteriores a DR11, sin permisos guardados) usa los valores iniciales", () => {
    expect(resolveStaffPermissions({})).toEqual(EXPECTED);
  });

  it("falla cerrado: un jsonb que NO es un objeto (nulo, ausente, lista, texto, número, booleano) deja todo apagado, nunca los valores iniciales", () => {
    for (const raw of [null, undefined, [], ["faq.manage"], "todo", "{}", 5, true, false]) {
      expect(resolveStaffPermissions(raw), String(JSON.stringify(raw))).toEqual(noPermissions());
      expect(Object.values(resolveStaffPermissions(raw)).every((v) => v === false)).toBe(true);
    }
  });

  it("respeta true y false guardados, clave por clave; las ausentes toman el valor inicial", () => {
    const map = resolveStaffPermissions({ "faq.manage": false, "profile.edit": true });
    expect(map["faq.manage"]).toBe(false);
    expect(map["profile.edit"]).toBe(true);
    expect(map["applications.reject"]).toBe(true); // ausente → inicial (encendido)
    expect(map["applications.send_adjustment"]).toBe(false); // ausente → inicial (apagado)
  });

  it("falla cerrado: un valor que no es booleano (texto, número, objeto, null) queda apagado", () => {
    const map = resolveStaffPermissions({
      "faq.manage": "true",
      "waitlist.manage": 1,
      "renewals.manage": {},
      "residents.manage": null,
      "applications.reject": "yes",
    });
    for (const key of ["faq.manage", "waitlist.manage", "renewals.manage", "residents.manage", "applications.reject"] as const) {
      expect(map[key], key).toBe(false);
    }
  });

  it("ignora claves desconocidas y no las propaga", () => {
    const map = resolveStaffPermissions({ "team.manage": true, "admin.todo": true, "__proto__": { "faq.manage": false } });
    expect(Object.keys(map).sort()).toEqual([...RESIDENCE_PERMISSION_KEYS].sort());
    expect((map as Record<string, boolean>)["team.manage"]).toBeUndefined();
    expect(map["faq.manage"]).toBe(true);
  });
});

describe("parseStrictPermissions: lo que escribe el dueño (clave ausente = false)", () => {
  it("una clave ausente es false (el mapa viene completo de los casilleros): nunca el valor inicial", () => {
    const map = parseStrictPermissions({ "faq.manage": true });
    expect(map["faq.manage"]).toBe(true);
    for (const key of RESIDENCE_PERMISSION_KEYS.filter((k) => k !== "faq.manage")) expect(map[key], key).toBe(false);
  });

  it("solo `true` literal enciende un permiso; texto, número, objeto y null apagan", () => {
    const map = parseStrictPermissions({ "faq.manage": "true", "waitlist.manage": 1, "renewals.manage": {}, "residents.manage": null, "profile.edit": true });
    expect(STAFF_PERMISSIONS.filter((p) => map[p.key]).map((p) => p.key)).toEqual(["profile.edit"]);
  });

  it("un valor que no es un objeto apaga todo; las claves desconocidas no se propagan", () => {
    for (const raw of [null, undefined, [], "x", 5]) expect(parseStrictPermissions(raw)).toEqual(noPermissions());
    const map = parseStrictPermissions({ "team.manage": true, "faq.manage": true });
    expect(Object.keys(map).sort()).toEqual([...RESIDENCE_PERMISSION_KEYS].sort());
  });

  it("permissionsVersion: un dígito por clave, cambia si cambia cualquier permiso efectivo", () => {
    const base = defaultPermissions();
    expect(permissionsVersion(base)).toBe("1110111110");
    expect(permissionsVersion({ ...base, "faq.manage": false })).not.toBe(permissionsVersion(base));
    expect(permissionsVersion(noPermissions())).toBe("0000000000");
    expect(permissionsVersion(ownerPermissions())).toBe("1111111111");
  });
});

describe("can(): quién puede qué", () => {
  it("el dueño siempre puede todo, tenga o no un mapa", () => {
    for (const key of RESIDENCE_PERMISSION_KEYS) {
      expect(can({ role: "owner", permissions: {} }, key), key).toBe(true);
      expect(can({ role: "owner" }, key), key).toBe(true);
      expect(can({ role: "owner", permissions: ownerPermissions() }, key), key).toBe(true);
    }
  });

  it("el staff solo puede lo que tiene en true (cada clave, con y sin permiso)", () => {
    for (const key of RESIDENCE_PERMISSION_KEYS) {
      const on = { ...defaultPermissions(), [key]: true };
      const off = { ...ownerPermissions(), [key]: false };
      expect(can({ role: "staff", permissions: on }, key), `${key} on`).toBe(true);
      expect(can({ role: "staff", permissions: off }, key), `${key} off`).toBe(false);
    }
  });

  it("un permiso encendido no habilita los demás", () => {
    const soloFaq = permissionsFromChecked(["faq.manage"]);
    expect(can({ role: "staff", permissions: soloFaq }, "faq.manage")).toBe(true);
    for (const key of RESIDENCE_PERMISSION_KEYS.filter((k) => k !== "faq.manage")) {
      expect(can({ role: "staff", permissions: soloFaq }, key), key).toBe(false);
    }
  });

  it("falla cerrado: sin membresía, sin mapa, con un rol raro o con una clave desconocida", () => {
    for (const key of RESIDENCE_PERMISSION_KEYS) {
      expect(can(null, key)).toBe(false);
      expect(can(undefined, key)).toBe(false);
      expect(can({ role: "staff" }, key)).toBe(false);
      expect(can({ role: "staff", permissions: {} }, key)).toBe(false);
      expect(can({ role: "superuser" as never, permissions: ownerPermissions() }, key)).toBe(false);
    }
    expect(can({ role: "owner" }, "team.manage" as never)).toBe(false);
    expect(can({ role: "staff", permissions: { "team.manage": true } }, "team.manage" as never)).toBe(false);
    expect(isResidencePermission("faq.manage")).toBe(true);
    expect(isResidencePermission("team.manage")).toBe(false);
    expect(isResidencePermission(5)).toBe(false);
  });
});

describe("atajos y formulario", () => {
  it("«Solo lectura»: todo apagado", () => {
    expect(Object.values(presetPermissions("read_only")).every((v) => v === false)).toBe(true);
  });

  it("«Atención de solicitudes»: encendidos 1, 2, 3, 8 y 9", () => {
    const on = Object.entries(presetPermissions("applications")).filter(([, v]) => v).map(([k]) => k);
    expect(on.sort()).toEqual(["applications.reject", "applications.review_contact", "faq.manage", "payments.residence", "waitlist.manage"].sort());
  });

  it("«Operación completa»: todo encendido salvo proponer ajustes y editar el perfil", () => {
    const map = presetPermissions("full_operation");
    expect(map["applications.send_adjustment"]).toBe(false);
    expect(map["profile.edit"]).toBe(false);
    expect(STAFF_PERMISSIONS.filter((p) => !map[p.key]).map((p) => p.key)).toEqual(["applications.send_adjustment", "profile.edit"]);
    expect(map).toEqual(defaultPermissions()); // hoy coincide con los valores iniciales
  });

  it("hay tres atajos con etiqueta y descripción", () => {
    expect(PERMISSION_PRESETS.map((p) => p.label)).toEqual(["Solo lectura", "Atención de solicitudes", "Operación completa"]);
  });

  it("permissionsFromChecked: tildado y conocido → true; lo demás (desconocido, repetido, basura) → false; siempre el mapa completo", () => {
    const map = permissionsFromChecked(["faq.manage", "faq.manage", "team.manage", 5, null, "profile.edit"]);
    expect(map["faq.manage"]).toBe(true);
    expect(map["profile.edit"]).toBe(true);
    expect(map["applications.reject"]).toBe(false);
    expect(Object.keys(map)).toHaveLength(STAFF_PERMISSIONS.length);
    expect(Object.values(permissionsFromChecked([])).every((v) => v === false)).toBe(true);
  });

  it("diffPermissions devuelve solo lo que cambió", () => {
    const before = defaultPermissions();
    const after = { ...before, "faq.manage": false, "profile.edit": true };
    expect(diffPermissions(before, after)).toEqual([
      { key: "faq.manage", from: true, to: false },
      { key: "profile.edit", from: false, to: true },
    ]);
    expect(diffPermissions(before, before)).toEqual([]);
  });
});

describe("rol", () => {
  it("normalizeResidenceRole: solo 'owner' es owner; cualquier otra cosa es staff (mínimo privilegio)", () => {
    expect(normalizeResidenceRole("owner")).toBe("owner");
    expect(normalizeResidenceRole("staff")).toBe("staff");
    expect(normalizeResidenceRole("admin")).toBe("staff");
    expect(normalizeResidenceRole(null)).toBe("staff");
    expect(normalizeResidenceRole(undefined)).toBe("staff");
  });

  it("residenceActorRole: dueño → residence_owner, staff → residence_staff, sin vínculo → null (falla cerrado)", () => {
    expect(residenceActorRole({ role: "owner" })).toBe("residence_owner");
    expect(residenceActorRole({ role: "staff" })).toBe("residence_staff");
    expect(residenceActorRole(null)).toBeNull();
    expect(residenceActorRole(undefined)).toBeNull();
  });
});
