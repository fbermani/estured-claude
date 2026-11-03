import { describe, expect, it } from "vitest";
import {
  MIN_PUBLISH_PHOTOS,
  getGalleryLayout,
  hasEnoughPhotosToPublish,
  photoDeleteBlockedMessage,
  photosMissingForPublish,
  publishPhotosError,
} from "./photos";

describe("regla de las 3 fotos para publicar", () => {
  it("el mínimo es 3", () => {
    expect(MIN_PUBLISH_PHOTOS).toBe(3);
  });

  it("0, 1 y 2 fotos no alcanzan", () => {
    expect(hasEnoughPhotosToPublish(0)).toBe(false);
    expect(hasEnoughPhotosToPublish(1)).toBe(false);
    expect(hasEnoughPhotosToPublish(2)).toBe(false);
  });

  it("3 o más fotos alcanzan", () => {
    expect(hasEnoughPhotosToPublish(3)).toBe(true);
    expect(hasEnoughPhotosToPublish(12)).toBe(true);
  });

  it("cuenta cuántas faltan, sin negativos ni NaN", () => {
    expect(photosMissingForPublish(0)).toBe(3);
    expect(photosMissingForPublish(2)).toBe(1);
    expect(photosMissingForPublish(3)).toBe(0);
    expect(photosMissingForPublish(7)).toBe(0);
    expect(photosMissingForPublish(-4)).toBe(3);
    expect(photosMissingForPublish(Number.NaN)).toBe(3);
  });

  it("el error al admin es claro y desaparece al llegar al mínimo", () => {
    expect(publishPhotosError(0)).toContain("0 fotos propias");
    expect(publishPhotosError(0)).toContain("las 3 que faltan");
    expect(publishPhotosError(1)).toContain("1 foto propia");
    expect(publishPhotosError(2)).toContain("la que falta");
    expect(publishPhotosError(3)).toBeNull();
    expect(publishPhotosError(9)).toBeNull();
  });
});

describe("getGalleryLayout (cantidad de fotos → variante del hero)", () => {
  it("0 → placeholder grande", () => {
    expect(getGalleryLayout(0)).toBe("empty");
    expect(getGalleryLayout(-1)).toBe("empty");
    expect(getGalleryLayout(Number.NaN)).toBe("empty");
  });
  it("1 → imagen única", () => {
    expect(getGalleryLayout(1)).toBe("single");
  });
  it("2 a 4 → mosaico", () => {
    expect(getGalleryLayout(2)).toBe("mosaic");
    expect(getGalleryLayout(3)).toBe("mosaic");
    expect(getGalleryLayout(4)).toBe("mosaic");
  });
  it("5 o más → mosaico con 'Ver todas'", () => {
    expect(getGalleryLayout(5)).toBe("mosaic-more");
    expect(getGalleryLayout(30)).toBe("mosaic-more");
  });
});

describe("photoDeleteBlockedMessage (borrar fotos propias, piso de 3 aprobadas)", () => {
  it("una foto pendiente se borra siempre, aunque la residencia esté publicada", () => {
    expect(photoDeleteBlockedMessage({ published: true, photoStatus: "pending_review", approvedCount: 3 })).toBeNull();
  });
  it("sin publicar no hay piso", () => {
    expect(photoDeleteBlockedMessage({ published: false, photoStatus: "approved", approvedCount: 1 })).toBeNull();
  });
  it("publicada: una aprobada se borra si después quedan 3 o más", () => {
    expect(photoDeleteBlockedMessage({ published: true, photoStatus: "approved", approvedCount: 4 })).toBeNull();
    expect(photoDeleteBlockedMessage({ published: true, photoStatus: "approved", approvedCount: 10 })).toBeNull();
  });
  it("publicada: no se puede borrar si quedarían menos de 3 aprobadas", () => {
    const msg = photoDeleteBlockedMessage({ published: true, photoStatus: "approved", approvedCount: 3 });
    expect(msg).toContain("al menos 3 fotos aprobadas");
    expect(photoDeleteBlockedMessage({ published: true, photoStatus: "approved", approvedCount: 1 })).not.toBeNull();
  });
});
