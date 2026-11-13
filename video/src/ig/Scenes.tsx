import type React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import {
  asset,
  BODY,
  DISPLAY,
  EV,
  FPS,
  Headline,
  K,
  lin,
  Px,
  sec,
  tween,
  tweenPop,
} from "./kit";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Zoom lento del conjunto (100% a `to`) durante la escena. */
function Zoom({
  dur,
  to = 1.06,
  origin = "50% 55%",
  children,
}: {
  dur: number;
  to?: number;
  origin?: string;
  children: React.ReactNode;
}) {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, dur], [1, to], clamp);
  return (
    <AbsoluteFill style={{ transform: `scale(${s})`, transformOrigin: origin }}>
      {children}
    </AbsoluteFill>
  );
}

/* ============================ Escena 1 ============================ */
export function Scene1({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const bob = Math.sin((f / FPS) * Math.PI) * 3; // 0 en el cuadro 0
  const e = EV.s1;
  return (
    <AbsoluteFill>
      <Zoom dur={dur} origin="50% 30%">
        <Px name="p1-e1-c0-fondo-mapa.png" x={0} y={0} w={1080} h={1920} />
        <Px name="p1-e1-c1-cama-valija.png" x={95} y={1009} w={837} h={372} />
        <Px name="p1-e1-c2-e1-cuerpo.png" x={374} y={582} w={378} h={779} />
        <div style={{ position: "absolute", inset: 0, transform: `translateY(${bob}px)` }}>
          <Px name="p1-e1-c3-celular.png" x={563} y={888} w={50} h={67} />
          <Px name="p1-e1-c4-e1-brazo-mano.png" x={420} y={774} w={200} h={210} />
        </div>
      </Zoom>
      <Headline
        text="¿Cómo elegís residencia en Buenos Aires sin poder ir a verla?"
        accent="verla"
        from={e.headlineIn}
        to={e.headlineOut}
        top={300}
        size={70}
        balance={false}
        width={900}
        letterSpacing="-0.02em"
      />
    </AbsoluteFill>
  );
}

/* ============================ Escena 2 ============================ */
const CHATS = [
  { n: 1, x: 262, y: 420, w: 420, h: 94 },
  { n: 2, x: 420, y: 560, w: 400, h: 64 },
  { n: 3, x: 262, y: 650, w: 460, h: 124 },
  { n: 4, x: 390, y: 830, w: 430, h: 94 },
  { n: 5, x: 262, y: 980, w: 360, h: 64 },
];
const FOTOS = [
  { n: 1, x: 272, y: 996, w: 403, h: 315 },
  { n: 2, x: 424, y: 1139, w: 397, h: 310 },
  { n: 3, x: 307, y: 1275, w: 392, h: 298 },
];
export function Scene2({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const e = EV.s2;
  const slide = tween(f, 0, 0.3, 1080, 0);
  const cenoS = tweenPop(f, e.ceno, e.ceno + 0.35, 0.6, 1);
  const cenoO = lin(f, e.ceno, e.ceno + 0.2);
  const D = 280;
  return (
    <AbsoluteFill style={{ transform: `translateX(${slide}px)` }}>
      <Zoom dur={dur}>
        <Px name="p1-e2-c0-fondo.png" x={0} y={0} w={1080} h={1920} />
        <Px name="p1-e2-c1-celular.png" x={200} y={300} w={680} h={1340} />
        {CHATS.map((c, i) => (
          <Px
            key={c.n}
            name={`p1-e2-c2-chat-${c.n}.png`}
            x={c.x}
            y={c.y}
            w={c.w}
            h={c.h}
            style={{
              opacity: tween(f, e.chats[i], e.chats[i] + 0.3),
              transform: `translateY(${tween(f, e.chats[i], e.chats[i] + 0.3, 20, 0)}px)`,
            }}
          />
        ))}
        {FOTOS.map((c, i) => (
          <Px
            key={c.n}
            name={`p1-e2-c3-foto-${c.n}.png`}
            x={c.x}
            y={c.y}
            w={c.w}
            h={c.h}
            style={{
              opacity: tween(f, e.fotos[i], e.fotos[i] + 0.25),
              transform: `scale(${tweenPop(f, e.fotos[i], e.fotos[i] + 0.35, 0.85, 1)})`,
            }}
          />
        ))}
        <Px name="p1-e2-c4-mano.png" x={0} y={1180} w={934} h={740} />
        {/* E1 con ceño, recorte circular del primer plano */}
        <div
          style={{
            position: "absolute",
            left: 595,
            top: 910,
            width: D,
            height: D,
            borderRadius: "50%",
            overflow: "hidden",
            border: `10px solid ${K.cream}`,
            boxSizing: "border-box",
            opacity: cenoO,
            transform: `scale(${cenoS})`,
            background: K.cream,
          }}
        >
          <Img
            src={asset("e1-expresion-ceno.png")}
            style={{
              position: "absolute",
              width: 1200 * 0.5,
              height: 1200 * 0.5,
              left: -330 * 0.5 + 0,
              top: -130 * 0.5,
              maxWidth: "none",
            }}
          />
        </div>
      </Zoom>
      <Headline
        text="¿Fotos y chats?"
        from={e.headlineIn}
        to={e.headlineOut}
        top={338}
        size={72}
        plate={false}
      />
    </AbsoluteFill>
  );
}

/* ============================ Escena 3 ============================ */
const P0 = [464.4, 520.4];
const P1 = [677.2, 623.0];
const P2 = [722.8, 816.8];
const bez = (t: number) => [
  (1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * P1[0] + t ** 2 * P2[0],
  (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * P1[1] + t ** 2 * P2[1],
];
const SHIFT3 = 260; // baja el mapa para liberar la franja del titular
export function Scene3({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const e = EV.s3;
  const p = tween(f, e.valija[0], e.valija[1]);
  const [bx, by] = bez(p);
  const [ex, ey] = bez(1);
  const rutaS = tween(f, e.ruta[0], e.ruta[1], 0.15, 1);
  const rutaO = lin(f, e.ruta[0], e.ruta[0] + 0.2);
  return (
    <AbsoluteFill style={{ background: "#f7f1e6" }}>
      <Zoom dur={dur}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 1080,
            height: SHIFT3,
            overflow: "hidden",
            background: "#f7f1e6",
          }}
        >
          <Px name="p1-textura-grano.png" x={0} y={0} w={1080} h={1920} style={{ opacity: 0.55 }} />
        </div>
        <div style={{ position: "absolute", inset: 0, transform: `translateY(${SHIFT3}px)` }}>
          <Px name="p1-e3-c0-fondo-mapa.png" x={0} y={0} w={1080} h={1920} />
          <Px
            name="p1-e3-c1-ruta.png"
            x={455}
            y={511}
            w={268}
            h={283}
            style={{
              opacity: rutaO,
              transformOrigin: "9.4px 9.4px",
              transform: `scale(${rutaS})`,
            }}
          />
          <Px
            name="p1-e3-c2-marcadores.png"
            x={444}
            y={500}
            w={304}
            h={342}
            style={{
              opacity: lin(f, e.marcadores, e.marcadores + 0.2),
              transform: `scale(${tweenPop(f, e.marcadores, e.marcadores + 0.4, 0.85, 1)})`,
            }}
          />
          <Px
            name="p1-e3-c3-reloj.png"
            x={564}
            y={388}
            w={140}
            h={162}
            style={{
              opacity: lin(f, e.reloj, e.reloj + 0.2),
              transform: `scale(${tweenPop(f, e.reloj, e.reloj + 0.4, 0.6, 1)})`,
            }}
          />
          <Px
            name="p1-e3-c4-valija.png"
            x={795 + (bx - ex)}
            y={672 + (by - ey)}
            w={96}
            h={209}
            style={{ opacity: lin(f, e.valija[0], e.valija[0] + 0.2) }}
          />
        </div>
      </Zoom>
      <Headline
        text="Viajar antes no siempre se puede"
        from={e.headlineIn}
        to={e.headlineOut}
        top={300}
        size={84}
        plate={false}
      />
    </AbsoluteFill>
  );
}

/* ============================ Escena 4 ============================ */
export function Scene4({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const e = EV.s4;
  const walk = tween(f, e.camina[0], e.camina[1], 0, -212);
  const step = Math.abs(Math.sin((f / FPS) * Math.PI * 3)) * -4;
  const visible = f < sec(e.corte);
  const op = lin(f, 0, 0.3) * (visible ? 1 : 0);
  const selloO = lin(f, e.sello, e.sello + 0.2);
  const selloS = tweenPop(f, e.sello, e.sello + 0.45, 0.55, 1);
  return (
    <AbsoluteFill>
      <Zoom dur={dur}>
        <Px name="p1-e4-c0-fondo-fachada.png" x={0} y={0} w={1080} h={1920} />
        <Px name="p1-e4-c5-puerta-entreabierta.png" x={440} y={1200} w={200} h={360} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: op,
            transform: `translate(${walk}px, ${step}px)`,
          }}
        >
          <Px name="p1-e4-c2-equipo-cuerpo.png" x={705} y={1247} w={95} h={353} />
          <Px name="p1-e4-c3-carpeta.png" x={780} y={1358} w={35} h={84} />
          <Px name="p1-e4-c4-equipo-brazo.png" x={777} y={1321} w={29} h={108} />
        </div>
        <Px
          name="p1-e4-c1-sello.png"
          x={444}
          y={914}
          w={196}
          h={192}
          style={{ opacity: selloO, transform: `scale(${selloS})` }}
        />
      </Zoom>
      <Headline
        text="Visitadas en persona"
        accent="en persona"
        from={e.headlineIn}
        to={e.headlineOut}
        top={300}
        size={92}
      />
    </AbsoluteFill>
  );
}

/* ======== Pantalla con capturas (escena 5 y 6): dentro del celular ======== */
const CAP_R = 2532 / 1170;
type Slot = { img: string; start: number; end: number; rings?: { x: number; y: number; at: number }[] };

/** Pila de capturas con mascara de pantalla; w,h = pantalla en px sin escalar. */
function CaptureStack({ w, h, slots, ringR }: { w: number; h: number; slots: Slot[]; ringR: number }) {
  const f = useCurrentFrame();
  const ih = w * CAP_R;
  const off = (ih - h) / 2;
  return (
    <>
      {slots.map((s, i) => {
        const next = slots[i + 1];
        if (f < sec(s.start) || (next && f >= sec(next.start) + 10)) return null;
        const enter = i === 0 ? 0 : tween(f, s.start, s.start + 0.3, w, 0);
        const exit = next ? tween(f, next.start, next.start + 0.3, 0, -w) : 0;
        const z = lin(f, s.start, s.end, 1, 1.1);
        return (
          <div
            key={s.img}
            style={{
              position: "absolute",
              inset: 0,
              transform: `translateX(${enter + exit}px)`,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                transformOrigin: "50% 50%",
                transform: `scale(${z})`,
              }}
            >
              <Img
                src={asset(s.img)}
                style={{ position: "absolute", left: 0, top: -off, width: w, height: ih, maxWidth: "none" }}
              />
              {(s.rings ?? []).map((r, k) => {
                const p = lin(f, r.at, r.at + 0.45);
                if (p <= 0 || p >= 1) return null;
                return (
                  <div
                    key={k}
                    style={{
                      position: "absolute",
                      left: r.x - ringR,
                      top: r.y - ringR,
                      width: ringR * 2,
                      height: ringR * 2,
                      borderRadius: "50%",
                      border: `${Math.max(2, ringR / 10)}px solid ${K.ink}`,
                      background: "rgba(29, 39, 34, 0.18)",
                      boxSizing: "border-box",
                      opacity: 1 - p,
                      transform: `scale(${0.6 + 0.9 * p})`,
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ============================ Escena 5 ============================ */
export function Scene5({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const e = EV.s5;
  const f1x = tween(f, e.f1, e.f1 + 0.5, 140, 0);
  const f1o = lin(f, e.f1, e.f1 + 0.3);
  const stackO = lin(f, e.celular, e.celular + 0.25);
  const stackS = tweenPop(f, e.celular, e.celular + 0.4, 0.92, 1);
  const W = 178.2;
  const H = 356.4;
  return (
    <AbsoluteFill>
      <Zoom dur={dur} origin="55% 70%">
        <Px name="p1-e5-c0-fondo-casa.png" x={0} y={0} w={1080} h={1920} />
        <Px
          name="p1-e5-c1-f1.png"
          x={589}
          y={1225}
          w={408}
          h={695}
          style={{ opacity: f1o, transform: `translateX(${f1x}px)` }}
        />
        <Px name="p1-e5-c2-e1.png" x={163} y={1084} w={433} h={836} />
        <Px name="p1-e5-c3-celular.png" x={537} y={934} w={231} h={406} />
        <div
          style={{
            position: "absolute",
            left: 652.5 - W / 2,
            top: 1137 - H / 2,
            width: W,
            height: H,
            borderRadius: 19.8,
            overflow: "hidden",
            transform: `rotate(-4deg) scale(${stackS})`,
            opacity: stackO,
          }}
        >
          <CaptureStack
            w={W}
            h={H}
            ringR={14}
            slots={[
              { img: "c1-busqueda.png", start: e.c1[0], end: e.c1[1] },
              { img: "c2-ficha.png", start: e.c2[0], end: e.c2[1] },
            ]}
          />
        </div>
        <Px name="p1-e5-c4-e1-brazo-mano.png" x={511} y={1277} w={172} h={249} />
      </Zoom>
      <Headline text="Compará desde donde estés" accent="estés" from={e.headline1[0]} to={e.headline1[1]} top={300} size={84} />
      <Headline text="La decisión es tuya" from={e.headline2[0]} to={e.headline2[1]} top={300} size={92} />
    </AbsoluteFill>
  );
}

/* ============================ Escena 6 ============================ */
// Pasos tildados de C3 y "Valido" de C5 en coordenadas de pantalla (620x1260).
const SW = 620;
const SH = 1260;
const c3y = [244.9, 308.6, 403.9, 467.6, 531.3].map((v) => v - (SW * CAP_R - SH) / 2);
export function Scene6({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const e = EV.s6;
  const S = 0.6;
  const L = 525 - 340; // el escalado es desde el centro del celular
  const T = 962 - 670;
  const po = lin(f, e.celular, e.celular + 0.3);
  const ps = tweenPop(f, e.celular, e.celular + 0.45, 0.9, 1);
  const aviso = lin(f, e.aviso, e.aviso + 0.3);
  const avisoY = tween(f, e.aviso, e.aviso + 0.3, 20, 0);
  void dur;
  return (
    <AbsoluteFill>
      <Px name="p1-e2-c0-fondo.png" x={0} y={0} w={1080} h={1920} />
      <div
        style={{
          position: "absolute",
          left: L,
          top: T,
          width: 680,
          height: 1340,
          transformOrigin: "50% 50%",
          transform: `scale(${S * ps})`,
          opacity: po,
        }}
      >
        <Px name="p1-e2-c1-celular.png" x={0} y={0} w={680} h={1340} />
        <div
          style={{
            position: "absolute",
            left: 30,
            top: 40,
            width: SW,
            height: SH,
            borderRadius: 48,
            overflow: "hidden",
          }}
        >
          <CaptureStack
            w={SW}
            h={SH}
            ringR={34}
            slots={[
              {
                img: "c3-seguimiento.png",
                start: e.c3[0],
                end: e.c3[1],
                rings: c3y.map((y, i) => ({ x: 87, y, at: e.pasos[i] })),
              },
              {
                img: "c5-comprobante.png",
                start: e.c5[0],
                end: e.c5[1],
                rings: [{ x: 552, y: 0.17 * SW * CAP_R - (SW * CAP_R - SH) / 2, at: e.valido }],
              },
            ]}
          />
        </div>
      </div>
      <Headline text="Solicitar es gratis" accent="gratis" from={e.headline1[0]} to={e.headline1[1]} top={300} size={92} />
      <Headline text="Cada paso queda registrado" from={e.headline2[0]} to={e.headline2[1]} top={300} size={80} />
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 1540,
          width: 870,
          textAlign: "center",
          fontFamily: BODY,
          fontWeight: 400,
          fontSize: 34,
          lineHeight: 1.25,
          color: K.ink,
          opacity: aviso,
          transform: `translateY(${avisoY}px)`,
        }}
      >
        Solicitud sujeta a confirmación de la residencia
      </div>
    </AbsoluteFill>
  );
}

/* ============================ Escena 7 ============================ */
export function Scene7() {
  const f = useCurrentFrame();
  const e = EV.s7;
  const logoO = lin(f, 0, 0.3);
  const logoS = tweenPop(f, 0, 0.45, 0.9, 1);
  const out = 1 - lin(f, e.headline2[1], e.headline2[1] + 0.2);
  const btnO = lin(f, e.boton, e.boton + 0.3) * out;
  const btnS =
    tweenPop(f, e.boton, e.boton + 0.45, 0.9, 1) *
    (1 - 0.04 * Math.max(0, 1 - Math.abs(f - sec(e.toque)) / 4));
  return (
    <AbsoluteFill style={{ background: K.forestInk }}>
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 300,
          width: 870,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: logoO * out,
          transform: `scale(${logoS})`,
        }}
      >
        <Img src={asset("estured-marca-sola-crema.svg")} style={{ width: 220, height: 220 }} />
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 96, color: K.cream, lineHeight: 1.1 }}>
          EstuRed
        </div>
      </div>
      <Headline text="Sumate gratis" from={e.headline1[0]} to={e.headline1[1]} top={690} size={80} plate={false} color={K.cream} />
      <Headline text="Link en la bio" from={e.headline2[0]} to={e.headline2[1]} top={690} size={80} plate={false} color={K.cream} />
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 880,
          width: 870,
          display: "flex",
          justifyContent: "center",
          opacity: btnO,
          transform: `scale(${btnS})`,
        }}
      >
        <div
          style={{
            width: 560,
            height: 120,
            borderRadius: K.radius,
            background: K.cream,
            color: K.ink,
            fontFamily: BODY,
            fontWeight: 700,
            fontSize: 46,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          Sumate gratis
        </div>
      </div>
    </AbsoluteFill>
  );
}
