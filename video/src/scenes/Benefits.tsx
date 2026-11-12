import type React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { body, C } from "../theme";
import { Icon, Rise, Shot, useEnter, useLayout } from "../ui";
import { BenefitFrame } from "./Benefit";

/* ---------- B1 · Residencia Verificada ---------- */
const CHECKS = ["Existe y está donde dice", "Sabemos quién la gestiona", "Lo publicado es real"];

export const B1Verified: React.FC = () => {
  const { v, u } = useLayout();
  const card = useEnter(6, 30);
  const cardH = v ? 900 * u : 820 * u;
  return (
    <BenefitFrame
      n="1"
      label="Verificación"
      title="Residencia Verificada"
      sub="Visitada en persona antes de publicarse."
      visual={
        <div style={{ display: "flex", alignItems: "center", gap: 50 * u }}>
          <div style={{ opacity: card, translate: `0px ${(1 - card) * 60 * u}px` }}>
            <Shot src="shots/search-card.png" width={cardH * (592 / 1094)} height={cardH} radius={30 * u} />
          </div>
          <div style={{ display: "grid", gap: 24 * u }}>
            {CHECKS.map((c, i) => (
              <Check key={c} text={c} delay={26 + i * 14} />
            ))}
          </div>
        </div>
      }
    />
  );
};

const Check: React.FC<{ text: string; delay: number }> = ({ text, delay }) => {
  const { v, u } = useLayout();
  const p = useEnter(delay, 22);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18 * u,
        background: C.paper,
        border: `2px solid ${C.line}`,
        borderRadius: 24 * u,
        padding: `${22 * u}px ${28 * u}px`,
        width: v ? 360 * u : 390 * u,
        opacity: p,
        translate: `${(1 - p) * 40 * u}px 0px`,
        fontFamily: body,
        fontWeight: 700,
        fontSize: v ? 32 * u : 30 * u,
        color: C.ink,
        lineHeight: 1.2,
      }}
    >
      <span
        style={{
          flex: "0 0 auto",
          width: 52 * u,
          height: 52 * u,
          borderRadius: 999,
          background: interpolate(p, [0.6, 1], [0, 1], { extrapolateLeft: "clamp" }) > 0.5 ? C.forest : C.forestTint,
          display: "grid",
          placeItems: "center",
        }}
      >
        <Icon name="check" size={36 * u} color="#fff" style={{ scale: `${p}` }} />
      </span>
      {text}
    </div>
  );
};

/* ---------- B2 · Solicitud y reserva a distancia ---------- */
export const B2Remote: React.FC = () => {
  const frame = useCurrentFrame();
  const { v, u } = useLayout();
  const a = useEnter(6, 30);
  const swap = interpolate(frame, [80, 104], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const W = v ? 900 * u : 880 * u;
  return (
    <BenefitFrame
      n="2"
      label="A distancia"
      title="Solicitá y reservá desde donde estés."
      sub="Pagás directo a la residencia."
      note="Solicitud gratis, sujeta a confirmación."
      visual={
        <div style={{ position: "relative", width: W, height: W * (v ? 0.92 : 0.8) }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              opacity: a * (1 - swap * 0.2),
              translate: `0px ${(1 - a) * 50 * u}px`,
              scale: interpolate(swap, [0, 1], [1, 0.95]),
              transformOrigin: "left top",
            }}
          >
            <Shot src="shots/solicitud-panel.png" width={W * 0.54} radius={26 * u} />
          </div>
          <div
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              opacity: swap,
              translate: `0px ${(1 - swap) * 60 * u}px`,
            }}
          >
            <Shot src="shots/pago-top.png" width={W * 0.84} radius={26 * u} />
          </div>
        </div>
      }
    />
  );
};

/* ---------- B3 · Comprobante con código verificable ---------- */
export const B3Receipt: React.FC = () => {
  const frame = useCurrentFrame();
  const { v, u } = useLayout();
  const a = useEnter(6, 30);
  const W = v ? 900 * u : 860 * u;
  const H = W * (960 / 1312);
  const zoom = interpolate(frame, [50, 100], [1, 1.32], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const halo = interpolate(frame, [80, 100], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const k = W / 1312;
  return (
    <BenefitFrame
      n="3"
      label="Cuando se confirma"
      title="Comprobante de Reserva Confirmada"
      sub="Con código verificable."
      note="Cualquiera puede verificarlo."
      noteIcon="qr_code_2"
      visual={
        <div
          style={{
            width: W,
            height: H,
            borderRadius: 26 * u,
            overflow: "hidden",
            opacity: a,
            translate: `0px ${(1 - a) * 50 * u}px`,
            boxShadow: "0 30px 80px -30px rgba(12,58,44,.35)",
            border: `2px solid ${C.line}`,
          }}
        >
          <div style={{ position: "relative", scale: `${zoom}`, transformOrigin: "0% 0%" }}>
            <Shot src="shots/proceso-5-comprobante.webp" width={W} radius={0} style={{ border: "none", boxShadow: "none" }} />
            {/* Halo sobre el N.º del comprobante */}
            <div
              style={{
                position: "absolute",
                left: 22 * k,
                top: 100 * k,
                width: 310 * k,
                height: 52 * k,
                borderRadius: 14 * k,
                border: `${4 * k}px solid ${C.gold}`,
                boxShadow: `0 0 0 ${10 * k}px rgba(233,184,75,.22)`,
                opacity: halo,
              }}
            />
          </div>
        </div>
      }
    />
  );
};

/* ---------- B4 · Comunidad ---------- */
const TRAITS = [
  { icon: "cake", text: "Edad" },
  { icon: "schedule", text: "Hábitos" },
  { icon: "favorite", text: "Preferencias" },
];

export const B4Community: React.FC = () => {
  const frame = useCurrentFrame();
  const { v, u } = useLayout();
  const a = useEnter(6, 30);
  const W = v ? 880 * u : 800 * u;
  const reveal = interpolate(frame, [6, 60], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <BenefitFrame
      n="4"
      label="Comunidad"
      title="Conocé a tus futuros compañeros."
      sub="Edad, hábitos y preferencias."
      note="EstuRed verifica residencias, no personas."
      noteIcon="info"
      visual={
        <div style={{ position: "relative" }}>
          <div
            style={{
              opacity: a,
              translate: `0px ${(1 - a) * 50 * u}px`,
              clipPath: `inset(0 0 ${100 - reveal}% 0 round ${26 * u}px)`,
            }}
          >
            <Shot src="shots/ficha-comunidad-in.png" width={W} radius={26 * u} style={{ padding: 24 * u, background: C.cream }} />
          </div>
          <div
            style={{
              position: "absolute",
              right: -30 * u,
              bottom: v ? -60 * u : -40 * u,
              display: "flex",
              gap: 16 * u,
            }}
          >
            {TRAITS.map((t, i) => (
              <Rise key={t.text} delay={50 + i * 8}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10 * u,
                    background: C.forest,
                    color: "#fff",
                    fontFamily: body,
                    fontWeight: 700,
                    fontSize: 30 * u,
                    padding: `${14 * u}px ${24 * u}px`,
                    borderRadius: 999,
                    boxShadow: "0 14px 30px -12px rgba(12,58,44,.5)",
                  }}
                >
                  <Icon name={t.icon} size={34 * u} color="#fff" />
                  {t.text}
                </span>
              </Rise>
            ))}
          </div>
        </div>
      }
    />
  );
};

/* ---------- B5 · Reglamento, servicios y costos ---------- */
export const B5Rules: React.FC = () => {
  const { v, u } = useLayout();
  const W = v ? 900 * u : 700 * u;
  return (
    <BenefitFrame
      n="5"
      label="En cada ficha"
      title="Reglamento, servicios y costos."
      sub="Antes de decidir, todo a la vista."
      note="Y el fee EstuRed (5%), por separado."
      noteIcon="receipt_long"
      visual={
        <div style={{ display: "grid", gap: 22 * u, width: W }}>
          <Panel src="shots/ficha-convivencia.png" ratio={530 / 1408} width={W} delay={6} tag="Reglamento" icon="gavel" />
          <Panel src="shots/ficha-servicios.png" ratio={668 / 1408} width={W} delay={20} tag="Servicios" icon="wifi" crop={0.56} />
          <Panel src="shots/costos-cards.png" ratio={627 / 1408} width={W} delay={34} tag="Costos" icon="payments" />
        </div>
      }
    />
  );
};

const Panel: React.FC<{
  src: string;
  ratio: number;
  width: number;
  delay: number;
  tag: string;
  icon: string;
  crop?: number;
}> = ({ src, ratio, width, delay, tag, icon, crop = 1 }) => {
  const { u } = useLayout();
  const p = useEnter(delay, 28);
  const inner = width - 40 * u;
  return (
    <div style={{ opacity: p, translate: `${(1 - p) * 60 * u}px 0px`, position: "relative" }}>
      <Shot
        src={src}
        width={width}
        height={inner * ratio * crop + 40 * u}
        radius={24 * u}
        style={{ padding: 20 * u, background: C.cream }}
        imgStyle={{ height: "auto" }}
      />
      <span
        style={{
          position: "absolute",
          right: 20 * u,
          top: 20 * u,
          display: "inline-flex",
          alignItems: "center",
          gap: 8 * u,
          background: C.orange,
          color: "#fff",
          fontFamily: body,
          fontWeight: 700,
          fontSize: 26 * u,
          padding: `${8 * u}px ${18 * u}px`,
          borderRadius: 999,
        }}
      >
        <Icon name={icon} size={28 * u} color="#fff" />
        {tag}
      </span>
    </div>
  );
};

/* ---------- B6 · Todo queda registrado + Soporte ---------- */
const STEPS = [
  { icon: "send", text: "Solicitud enviada" },
  { icon: "payments", text: "Pago a la residencia" },
  { icon: "verified", text: "Comprobante" },
];

export const B6Support: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { v, u } = useLayout();
  const W = v ? 880 * u : 820 * u;
  const sup = useEnter(Math.round(2.2 * fps), 30);
  return (
    <BenefitFrame
      n="6"
      label="Todo por escrito"
      title="Todo queda registrado."
      sub="Si algo no coincide, lo vemos juntos."
      visual={
        <div style={{ position: "relative", width: W, display: "grid", gap: 40 * u }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {STEPS.map((s, i) => {
              const on = interpolate(frame, [8 + i * 16, 20 + i * 16], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div key={s.text} style={{ display: "contents" }}>
                  {i > 0 && (
                    <div style={{ flex: 1, height: 6 * u, margin: `0 ${12 * u}px`, borderRadius: 9, background: C.line, overflow: "hidden" }}>
                      <div style={{ width: `${on * 100}%`, height: "100%", background: C.forest }} />
                    </div>
                  )}
                  <div style={{ display: "grid", justifyItems: "center", gap: 12 * u, width: 200 * u }}>
                    <div
                      style={{
                        width: 92 * u,
                        height: 92 * u,
                        borderRadius: 999,
                        display: "grid",
                        placeItems: "center",
                        background: on > 0.5 ? C.forest : C.paper,
                        border: `3px solid ${on > 0.5 ? C.forest : C.line}`,
                        scale: `${interpolate(on, [0, 1], [0.9, 1])}`,
                      }}
                    >
                      <Icon name={s.icon} size={46 * u} color={on > 0.5 ? "#fff" : C.inkSoft} />
                    </div>
                    <span
                      style={{
                        fontFamily: body,
                        fontWeight: 700,
                        fontSize: 26 * u,
                        color: C.ink,
                        textAlign: "center",
                        opacity: interpolate(on, [0, 1], [0.5, 1]),
                      }}
                    >
                      {s.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ position: "relative", opacity: sup, translate: `0px ${(1 - sup) * 60 * u}px` }}>
            <Shot src="shots/soporte.png" width={W} height={W * 0.5} radius={26 * u} objectPosition="top left" />
            <span
              style={{
                position: "absolute",
                right: 24 * u,
                top: -26 * u,
                display: "inline-flex",
                alignItems: "center",
                gap: 10 * u,
                background: C.forestInk,
                color: "#fff",
                fontFamily: body,
                fontWeight: 700,
                fontSize: 30 * u,
                padding: `${14 * u}px ${24 * u}px`,
                borderRadius: 999,
                boxShadow: "0 14px 30px -12px rgba(12,58,44,.5)",
              }}
            >
              <Icon name="support_agent" size={36 * u} color={C.orangeLight} />
              Soporte EstuRed
            </span>
          </div>
        </div>
      }
    />
  );
};

/* ---------- F · Familias ---------- */
export const Family: React.FC = () => {
  const frame = useCurrentFrame();
  const { v, u } = useLayout();
  const a = useEnter(6, 30);
  const W = v ? 920 * u : 900 * u;
  return (
    <BenefitFrame
      n="+"
      label="Para familias"
      title="Tu familia acompaña sin viajar."
      sub="Propone opciones y te ayuda a decidir."
      note="Quien estudia decide."
      noteIcon="how_to_reg"
      visual={
        <div
          style={{
            opacity: a,
            translate: `0px ${(1 - a) * 50 * u}px`,
            scale: `${interpolate(frame, [0, 160], [1, 1.04])}`,
          }}
        >
          <Shot
            src="shots/familia-top.png"
            width={W}
            radius={26 * u}
            style={{ padding: 20 * u, background: C.cream }}
          />
        </div>
      }
    />
  );
};
