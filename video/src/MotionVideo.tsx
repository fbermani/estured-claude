import type React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { body, C, display } from "./theme";
import { BrandMark, Icon, Rise } from "./ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const paper: React.CSSProperties = {
  background: C.paper,
  borderRadius: 28,
  boxShadow: "0 28px 65px #001e2420",
  border: `2px solid ${C.line}`,
};

function Tile({
  icon,
  label,
  color = C.forest,
}: {
  icon: string;
  label: string;
  color?: string;
}) {
  return (
    <div
      style={{
        ...paper,
        padding: "24px 28px",
        display: "flex",
        alignItems: "center",
        gap: 18,
        fontSize: 28,
        fontWeight: 700,
        color: C.ink,
      }}
    >
      <Icon name={icon} size={38} color={color} />
      {label}
    </div>
  );
}
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        background: C.forestTint,
        color: C.forestInk,
        borderRadius: 30,
        padding: "12px 22px",
        fontSize: 24,
        fontWeight: 700,
      }}
    >
      <Icon name="verified" size={26} />
      {children}
    </span>
  );
}
function House({ color = C.orange }: { color?: string }) {
  return (
    <svg width="170" height="170" viewBox="0 0 170 170">
      <path d="M20 78L85 23l65 55v70H20Z" fill={color} />
      <rect x="68" y="98" width="34" height="50" rx="8" fill={C.cream} />
      <rect x="38" y="79" width="24" height="25" rx="5" fill={C.cream} />
      <rect x="110" y="79" width="24" height="25" rx="5" fill={C.cream} />
    </svg>
  );
}
function Cursor({
  label,
  color,
  x,
  y,
}: {
  label: string;
  color: string;
  x: number;
  y: number;
}) {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: x + Math.sin(f / 32) * 18,
        top: y + Math.cos(f / 38) * 14,
        color,
        display: "flex",
        alignItems: "center",
        gap: 8,
        zIndex: 5,
      }}
    >
      <svg width="36" height="42" viewBox="0 0 36 42">
        <path
          d="M2 2L32 24L17 27L10 40Z"
          fill={color}
          stroke="white"
          strokeWidth="3"
        />
      </svg>
      <span
        style={{
          background: color,
          color: "white",
          borderRadius: 16,
          padding: "8px 16px",
          fontSize: 21,
          fontWeight: 700,
        }}
      >
        {label}
      </span>
    </div>
  );
}
function Phone({
  children,
  tilt = 0,
}: {
  children: React.ReactNode;
  tilt?: number;
}) {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        width: 360,
        height: 640,
        borderRadius: 54,
        padding: 13,
        background: C.forestInk,
        boxShadow: "25px 40px 90px #001b2430",
        rotate: `${tilt + Math.sin(f / 60) * 1.5}deg`,
        position: "relative",
      }}
    >
      <div
        style={{
          background: C.cream,
          borderRadius: 42,
          height: "100%",
          overflow: "hidden",
          padding: 24,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: 108,
            height: 25,
            background: C.forestInk,
            borderRadius: 25,
            margin: "-12px auto 30px",
          }}
        />
        <div style={{ fontSize: 25, fontWeight: 800, marginBottom: 20 }}>
          EstuRed <span style={{ float: "right" }}>≡</span>
        </div>
        {children}
      </div>
    </div>
  );
}
function Card({ i = 0 }: { i?: number }) {
  return (
    <div style={{ ...paper, padding: 20, marginBottom: 16 }}>
      <div
        style={{
          height: 88,
          background: i ? C.orangeTint : C.forestTint,
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <div style={{ scale: 0.55, height: 170 }}>
          <House color={i ? C.orange : C.forest} />
        </div>
      </div>
      <div style={{ fontSize: 23, fontWeight: 800, margin: "12px 0" }}>
        Residencia verificada
      </div>
      <div style={{ display: "flex", gap: 8, fontSize: 16, color: C.inkSoft }}>
        <Icon name="wifi" size={22} />
        <Icon name="local_laundry_service" size={22} />
        <Icon name="school" size={22} />
        <span>Servicios · Comunidad</span>
      </div>
    </div>
  );
}

function Messages() {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "relative", width: 800, height: 650 }}>
      <div style={{ position: "absolute", left: 210, top: 5 }}>
        <Phone tilt={-8}>
          <div style={{ fontSize: 17, color: C.inkSoft, marginBottom: 18 }}>
            Instagram → WhatsApp
          </div>
          {[
            "¿Es como en las fotos?",
            "¿Dónde queda?",
            "¿A quién le estoy pagando?",
          ].map((t, i) => (
            <div
              key={t}
              style={{
                background: i % 2 ? C.forestTint : "white",
                padding: 18,
                borderRadius: 18,
                fontSize: 24,
                margin: "18px 0",
                translate: `${Math.sin(f / 25 + i) * 6}px 0px`,
                opacity: interpolate(
                  f,
                  [12 + i * 22, 24 + i * 22],
                  [0, 1],
                  clamp,
                ),
              }}
            >
              {t}
            </div>
          ))}
        </Phone>
      </div>
      <div
        style={{ position: "absolute", left: 0, top: 125, rotate: "-12deg" }}
      >
        <Rise delay={25}>
          <Tile
            icon="photo_camera"
            label="Fotos lindas. ¿Y después?"
            color={C.orange}
          />
        </Rise>
      </div>
      <div
        style={{ position: "absolute", right: 0, bottom: 65, rotate: "8deg" }}
      >
        <Rise delay={65}>
          <Tile
            icon="question_mark"
            label="Un mensaje no verifica un lugar."
            color={C.orange}
          />
        </Rise>
      </div>
    </div>
  );
}
function Travel() {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "relative", width: 800, height: 640 }}>
      <svg width="800" height="640" viewBox="0 0 800 640">
        <path
          d="M90 470C280 490 200 140 420 180S680 540 700 145"
          fill="none"
          stroke={C.orange}
          strokeWidth="8"
          strokeDasharray="14 16"
          strokeDashoffset={-f * 1.6}
        />
        <circle cx="90" cy="470" r="65" fill={C.forestTint} />
        <circle cx="700" cy="145" r="95" fill={C.orangeTint} />
      </svg>
      <div style={{ position: "absolute", left: 42, top: 421 }}>
        <Icon name="home" size={95} color={C.forest} />
      </div>
      <div style={{ position: "absolute", right: 42, top: 54 }}>
        <House />
      </div>
      <div
        style={{ position: "absolute", left: 270, top: 210, rotate: "-8deg" }}
      >
        <Tile icon="flight" label="Pasajes" />
      </div>
      <div
        style={{ position: "absolute", left: 355, top: 335, rotate: "6deg" }}
      >
        <Tile icon="calendar_month" label="Tiempo" />
      </div>
      <div
        style={{
          position: "absolute",
          left: 10,
          bottom: 0,
          fontSize: 28,
          fontWeight: 700,
        }}
      >
        Tu casa
      </div>
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          fontSize: 28,
          fontWeight: 700,
        }}
      >
        Buenos Aires
      </div>
    </div>
  );
}
function Verified() {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "relative", width: 800, height: 650 }}>
      <div
        style={{
          position: "absolute",
          inset: "50px 65px",
          border: `3px dashed ${C.forestTint}`,
          borderRadius: "50%",
          rotate: `${f * 0.12}deg`,
        }}
      />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: [65, 455, 245][i],
            top: [65, 95, 340][i],
            scale: spring({
              fps: 30,
              frame: f - i * 14,
              config: { damping: 18 },
            }),
          }}
        >
          <div style={{ ...paper, padding: 24, background: C.cream }}>
            <House color={i === 1 ? C.orange : C.forest} />
            <div
              style={{
                position: "absolute",
                right: 8,
                top: 8,
                background: C.gold,
                borderRadius: "50%",
                padding: 10,
              }}
            >
              <Icon name="check" size={38} color={C.forestInk} />
            </div>
          </div>
        </div>
      ))}
      <div style={{ position: "absolute", bottom: 5, left: 120 }}>
        <Tag>Verificadas presencialmente</Tag>
      </div>
    </div>
  );
}
function Search() {
  const f = useCurrentFrame();
  return (
    <div style={{ width: 800, height: 650, position: "relative" }}>
      <div style={{ position: "absolute", left: 60, top: 0 }}>
        <Phone tilt={-5}>
          <div
            style={{
              background: "white",
              padding: 14,
              borderRadius: 15,
              fontSize: 19,
              marginBottom: 14,
            }}
          >
            ⌕ Buscar en Buenos Aires
          </div>
          <Card />
          <Card i={1} />
        </Phone>
      </div>
      <div
        style={{
          position: "absolute",
          left: 440,
          top: 100,
          width: 320,
          rotate: "5deg",
          translate: `0px ${Math.sin(f / 35) * 10}px`,
        }}
      >
        <div style={{ ...paper, padding: 28, fontSize: 28, fontWeight: 800 }}>
          Elegí a tu manera
          <div style={{ marginTop: 24, display: "grid", gap: 16 }}>
            <Tile icon="location_on" label="Ubicación" />
            <Tile icon="payments" label="Precios" />
            <Tile icon="groups" label="Comunidad" />
          </div>
        </div>
      </div>
      <Cursor label="Vos" color={C.orange} x={220} y={385} />
      <Cursor label="Tu familia" color={C.forest} x={520} y={530} />
    </div>
  );
}
function Booking() {
  const f = useCurrentFrame();
  const steps = [
    "Solicitud",
    "Pago a residencia",
    "Fee EstuRed",
    "Reserva confirmada",
  ];
  return (
    <div style={{ width: 800, height: 650, position: "relative" }}>
      <div
        style={{
          ...paper,
          position: "absolute",
          left: 0,
          top: 45,
          width: 760,
          padding: 32,
          boxSizing: "border-box",
          rotate: "-3deg",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 24,
            fontWeight: 800,
          }}
        >
          <span>EstuRed / Mi reserva</span>
          <Icon name="account_circle" size={32} />
        </div>
        <div style={{ display: "flex", marginTop: 35, gap: 22 }}>
          <div
            style={{
              width: 110,
              background: C.forestTint,
              borderRadius: 18,
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="home" size={65} color={C.forest} />
          </div>
          <div style={{ flex: 1 }}>
            {steps.map((s, i) => (
              <div
                key={s}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 0",
                  fontSize: 25,
                  color: f > i * 35 + 15 ? C.forest : C.inkSoft,
                }}
              >
                <Icon
                  name={
                    f > i * 35 + 15 ? "check_circle" : "radio_button_unchecked"
                  }
                  size={30}
                />
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>
      <Rise
        delay={130}
        style={{ position: "absolute", right: 0, bottom: 15, rotate: "7deg" }}
      >
        <div
          style={{
            ...paper,
            padding: 30,
            width: 380,
            background: C.forestInk,
            color: "white",
          }}
        >
          <Icon name="verified" size={50} color={C.gold} />
          <div style={{ fontSize: 32, fontWeight: 800, margin: "15px 0" }}>
            Comprobante de reserva
          </div>
          <div style={{ fontSize: 22 }}>Confirmada · Verificable</div>
          <div style={{ height: 4, background: C.gold, marginTop: 22 }} />
        </div>
      </Rise>
      <div
        style={{
          position: "absolute",
          left: 10,
          bottom: 25,
          fontSize: 18,
          color: C.inkSoft,
          width: 330,
        }}
      >
        La solicitud está sujeta a confirmación. Vista ilustrativa del proceso.
      </div>
    </div>
  );
}
function Community() {
  const f = useCurrentFrame();
  return (
    <div style={{ width: 800, height: 650, position: "relative" }}>
      <svg width="800" height="650">
        <g stroke={C.forestTint} strokeWidth="5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line
              key={i}
              x1="400"
              y1="325"
              x2={400 + 260 * Math.cos((i * Math.PI) / 3)}
              y2={325 + 240 * Math.sin((i * Math.PI) / 3)}
            />
          ))}
        </g>
      </svg>
      {[
        "school",
        "music_note",
        "sports_basketball",
        "menu_book",
        "public",
        "brush",
      ].map((icon, i) => (
        <div
          key={icon}
          style={{
            position: "absolute",
            left: 330 + 260 * Math.cos((i * Math.PI) / 3),
            top: 255 + 240 * Math.sin((i * Math.PI) / 3),
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: i % 2 ? C.orangeTint : C.forestTint,
            display: "grid",
            placeItems: "center",
            scale: spring({
              fps: 30,
              frame: f - i * 7,
              config: { damping: 17 },
            }),
          }}
        >
          <Icon name={icon} size={65} color={i % 2 ? C.orange : C.forest} />
        </div>
      ))}
      <div
        style={{
          ...paper,
          position: "absolute",
          left: 230,
          top: 240,
          padding: 35,
          width: 270,
          textAlign: "center",
          fontSize: 30,
          fontWeight: 800,
        }}
      >
        Tu próxima comunidad
        <small
          style={{
            display: "block",
            fontSize: 18,
            fontWeight: 500,
            marginTop: 12,
          }}
        >
          Cada residente decide qué mostrar.
        </small>
      </div>
    </div>
  );
}
function Support() {
  return (
    <div style={{ width: 800, height: 650, position: "relative" }}>
      <div style={{ position: "absolute", left: 160, top: 0 }}>
        <Phone tilt={5}>
          <div style={{ fontSize: 34, fontWeight: 800, marginTop: 30 }}>
            ¿Necesitás ayuda?
          </div>
          <div style={{ margin: "30px 0", fontSize: 23, color: C.inkSoft }}>
            Encontrá Soporte desde tu panel.
          </div>
          <div
            style={{
              background: C.forest,
              color: "white",
              padding: 23,
              borderRadius: 20,
              fontSize: 26,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Icon name="support_agent" size={35} />
            Soporte
          </div>
          <div style={{ marginTop: 35, display: "grid", gap: 20 }}>
            <Tile icon="description" label="Tu reserva" />
            <Tile icon="checklist" label="Tu llegada" />
          </div>
        </Phone>
      </div>
      <div
        style={{ position: "absolute", right: 0, top: 230, rotate: "-7deg" }}
      >
        <Tile icon="waving_hand" label="Estamos para ayudarte" />
      </div>
    </div>
  );
}
function Closing() {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        position: "relative",
        width: 800,
        height: 650,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 500,
          height: 500,
          borderRadius: "50%",
          border: `65px solid ${C.forest}`,
          rotate: `${f}deg`,
          position: "absolute",
        }}
      />
      <div
        style={{
          width: 350,
          height: 350,
          background: C.gold,
          borderRadius: 90,
          rotate: `${-12 + Math.sin(f / 30) * 4}deg`,
          position: "absolute",
        }}
      />
      <div
        style={{
          zIndex: 1,
          background: C.cream,
          padding: 45,
          borderRadius: 32,
        }}
      >
        <BrandMark size={100} />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 32,
          fontWeight: 700,
          color: C.cream,
        }}
      >
        estured.vercel.app
      </div>
    </div>
  );
}

function Stage({
  number,
  title,
  accent,
  sub,
  dark = false,
  children,
}: {
  number: string;
  title: string;
  accent: string;
  sub: string;
  dark?: boolean;
  children: React.ReactNode;
}) {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const v = height > width;
  const scale = v ? width / 1080 : height / 1080;
  return (
    <AbsoluteFill
      style={{
        background: dark ? C.forestInk : C.cream,
        overflow: "hidden",
        fontFamily: body,
        color: dark ? C.cream : C.ink,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          right: -300,
          bottom: -380,
          border: `70px solid ${dark ? C.forest : C.forestTint}`,
          borderRadius: "50%",
          translate: `${Math.sin(f / 50) * 20}px 0px`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: width / scale,
          height: height / scale,
          scale,
          transformOrigin: "top left",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 65,
            left: 70,
            right: 70,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <BrandMark size={50} dark={dark} />
          <span
            style={{
              fontSize: 20,
              letterSpacing: 4,
              color: dark ? C.gold : C.orange,
            }}
          >
            TU PRÓXIMA ETAPA / {number}
          </span>
        </div>
        <div
          style={{
            position: "absolute",
            left: 80,
            top: v ? 215 : 265,
            width: v ? 920 : 870,
          }}
        >
          <Rise>
            <div
              style={{
                fontFamily: display,
                fontSize: v ? 92 : 104,
                lineHeight: 1.02,
                fontWeight: 800,
                letterSpacing: -4,
              }}
            >
              {title}
              <div style={{ color: dark ? C.gold : C.orange }}>{accent}</div>
            </div>
          </Rise>
          <Rise delay={12}>
            <div
              style={{
                fontSize: 32,
                lineHeight: 1.35,
                marginTop: 32,
                maxWidth: 760,
                color: dark ? C.forestTint : C.inkSoft,
              }}
            >
              {sub}
            </div>
          </Rise>
        </div>
        <div
          style={{
            position: "absolute",
            left: v ? 140 : 1030,
            top: v ? 820 : 235,
            scale: v ? 1 : 0.97,
            transformOrigin: "top left",
          }}
        >
          <Rise delay={8} distance={80}>
            {children}
          </Rise>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: v ? 130 : 65,
            left: 80,
            right: 80,
            height: 4,
            background: dark ? "#ffffff20" : C.line,
          }}
        >
          <div
            style={{
              width: `${interpolate(f, [0, useVideoConfig().durationInFrames], [0, 100], clamp)}%`,
              height: 4,
              background: dark ? C.gold : C.orange,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function MotionVideo() {
  const { fps } = useVideoConfig();
  return (
    <>
      <Audio src={staticFile("music/estured-original.wav")} volume={0.55} />
      <Sequence
        name="01 · Mensajes no son verificación"
        durationInFrames={7 * fps}
      >
        <Stage
          number="01"
          title="¿Tu próxima casa"
          accent="por un mensaje?"
          sub="Instagram y WhatsApp no alcanzan para verificar una residencia."
        >
          <Messages />
        </Stage>
      </Sequence>
      <Sequence
        name="02 · La distancia"
        from={7 * fps}
        durationInFrames={6 * fps}
      >
        <Stage
          number="02"
          title="¿Viajar para"
          accent="conocerlas todas?"
          sub="No todos pueden ir a Buenos Aires antes de mudarse."
        >
          <Travel />
        </Stage>
      </Sequence>
      <Sequence
        name="03 · Verificación presencial"
        from={13 * fps}
        durationInFrames={6 * fps}
      >
        <Stage
          number="03"
          title="EstuRed ya fue"
          accent="por vos."
          sub="Residencias verificadas presencialmente en Buenos Aires."
          dark
        >
          <Verified />
        </Stage>
      </Sequence>
      <Sequence
        name="04 · Buscar y comparar"
        from={19 * fps}
        durationInFrames={10 * fps}
      >
        <Stage
          number="04"
          title="Buscá. Compará."
          accent="Elegí desde casa."
          sub="Con tu familia. Con información para decidir."
        >
          <Search />
        </Stage>
      </Sequence>
      <Sequence
        name="05 · Reserva y comprobante"
        from={29 * fps}
        durationInFrames={9 * fps}
      >
        <Stage
          number="05"
          title="Tu reserva,"
          accent="paso a paso."
          sub="Todo registrado. Con comprobante cuando tu reserva está confirmada."
        >
          <Booking />
        </Stage>
      </Sequence>
      <Sequence
        name="06 · Comunidad"
        from={38 * fps}
        durationInFrames={7 * fps}
      >
        <Stage
          number="06"
          title="Conocé la comunidad"
          accent="antes de llegar."
          sub="Descubrí quiénes forman parte de cada residencia."
        >
          <Community />
        </Stage>
      </Sequence>
      <Sequence name="07 · Soporte" from={45 * fps} durationInFrames={6 * fps}>
        <Stage
          number="07"
          title="Si necesitás ayuda,"
          accent="estamos."
          sub="Soporte para acompañarte en el proceso."
        >
          <Support />
        </Stage>
      </Sequence>
      <Sequence name="08 · Sumate" from={51 * fps} durationInFrames={9 * fps}>
        <Stage
          number="08"
          title="Tu próxima etapa"
          accent="empieza acá."
          sub="Sumate hoy. Completá tu perfil."
          dark
        >
          <Closing />
        </Stage>
      </Sequence>
    </>
  );
}
