import type React from "react";
import { AbsoluteFill } from "remotion";
import { BrandMark } from "../ui";
import {
  AppIcon,
  Backdrop,
  Bubble,
  C,
  Check,
  Cursor,
  Face,
  HouseArt,
  Icon,
  Label,
  Title,
  card,
  display,
  ease,
  pop,
  useScene,
} from "./design";

export function ChaosScene() {
  const { f, v, w, h, cx } = useScene();
  const cy = v ? 950 : 565;
  const orbit = 220 + ease(f, 25, 150, 0, v ? 90 : 200);
  const zoom = ease(f, 120, 260, 1, 1.13);
  const messages = [
    "¿Es como en las fotos?",
    "¿A quién le transfiero?",
    "¿Queda cerca de la facu?",
    "¿Y si llego y no está?",
  ];
  return (
    <Backdrop>
      <div
        style={{
          position: "absolute",
          inset: 0,
          scale: zoom,
          transformOrigin: `${cx}px ${cy}px`,
        }}
      >
        {[1, 1.6, 2.2].map((s, i) => (
          <div
            key={s}
            style={{
              position: "absolute",
              left: cx - orbit * s,
              top: cy - orbit * s,
              width: orbit * s * 2,
              height: orbit * s * 2,
              border: `${i === 1 ? 3 : 35}px ${i === 1 ? "dashed" : "solid"} ${i === 0 ? "#98cbb89a" : "#b9dfce60"}`,
              borderRadius: "50%",
              rotate: `${f * (i % 2 ? -0.16 : 0.12)}deg`,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: cx - 160,
            top: cy - 160,
            scale: pop(f, 3),
          }}
        >
          <div
            style={{
              padding: 15,
              borderRadius: "50%",
              background: C.orange,
              boxShadow: "0 25px 70px #0c3a2c25",
            }}
          >
            <Face size={290} />
          </div>
        </div>
        {messages.map((text, i) => {
          const a = (i * Math.PI) / 2 + f * 0.0015;
          const x = cx + Math.cos(a) * orbit * (v ? 0.85 : 1.4) - 140;
          const y = cy + Math.sin(a) * orbit * (v ? 1 : 0.55) - 50;
          return (
            <div
              key={text}
              style={{
                position: "absolute",
                left: x,
                top: y,
                scale: pop(f, 25 + i * 17),
                rotate: `${[-5, 4, -3, 5][i]}deg`,
                filter: i === 3 && f < 140 ? "blur(3px)" : "none",
              }}
            >
              <Bubble
                text={text}
                style={{ maxWidth: v ? 300 : 370, fontSize: v ? 25 : 30 }}
              />
            </div>
          );
        })}
        <div
          style={{
            position: "absolute",
            left: cx - (v ? 400 : 690),
            top: cy - 250,
            scale: pop(f, 15),
            rotate: "-10deg",
          }}
        >
          <AppIcon kind="instagram" size={v ? 105 : 130} />
        </div>
        <div
          style={{
            position: "absolute",
            left: cx + (v ? 270 : 600),
            top: cy + 160,
            scale: pop(f, 30),
            rotate: "12deg",
          }}
        >
          <AppIcon kind="whatsapp" size={v ? 110 : 140} />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          top: v ? 230 : 80,
          textAlign: "center",
          opacity: ease(f, 0, 18),
        }}
      >
        <Title size={v ? 108 : 106}>
          {f < 100 ? "Te vas a Buenos Aires." : "¿Y dónde vas a vivir?"}
        </Title>
        <div style={{ fontSize: 31, marginTop: 20, color: C.inkSoft }}>
          {f < 100
            ? "Una nueva ciudad. Tu próxima etapa."
            : "Fotos, mensajes… muchas preguntas."}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: v ? 300 : 130,
          textAlign: "center",
          opacity: ease(f, 155, 180),
        }}
      >
        <Label dark>
          <Icon name="question_mark" size={30} color={C.gold} />
          Un mensaje no verifica una residencia.
        </Label>
      </div>
      <div
        style={{ position: "absolute", bottom: 0, height: h * 0.05, width: w }}
      />
    </Backdrop>
  );
}

export function DistanceScene() {
  const { f, v, w, cx } = useScene();
  const p = ease(f, 25, 155);
  const y = v ? 1080 : 620;
  return (
    <Backdrop>
      <Title
        size={v ? 110 : 128}
        style={{
          position: "absolute",
          top: v ? 245 : 100,
          left: 80,
          right: 80,
          textAlign: "center",
        }}
      >
        ¿Viajar antes
        <br />
        <span style={{ color: C.orange }}>para verlas todas?</span>
      </Title>
      <svg
        width={w}
        height={v ? 1600 : 1000}
        style={{ position: "absolute", top: 0 }}
      >
        <path
          d={
            v
              ? "M150 1190C180 700 820 700 900 1190"
              : "M200 700C550 280 1330 280 1700 700"
          }
          pathLength={1}
          fill="none"
          stroke={C.orange}
          strokeWidth="9"
          strokeDasharray=".015 .016"
          strokeDashoffset={-f * 0.002}
        />
        <path
          d={
            v
              ? "M150 1190C180 700 820 700 900 1190"
              : "M200 700C550 280 1330 280 1700 700"
          }
          pathLength={1}
          fill="none"
          stroke={C.forest}
          opacity={0.15}
          strokeWidth="50"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: v ? 60 : 110,
          top: y,
          scale: pop(f),
        }}
      >
        <div style={{ ...card, padding: 35, borderRadius: 50 }}>
          <HouseArt size={v ? 145 : 180} />
        </div>
        <Title size={34} style={{ textAlign: "center", marginTop: 24 }}>
          Tu casa
        </Title>
      </div>
      <div
        style={{
          position: "absolute",
          right: v ? 40 : 85,
          top: y,
          scale: pop(f, 15),
        }}
      >
        <div style={{ display: "flex", alignItems: "end", gap: 10 }}>
          {[170, 240, 145].map((height, i) => (
            <div
              key={i}
              style={{
                width: v ? 65 : 95,
                height: height,
                background: i % 2 ? C.orange : C.forest,
                borderRadius: "15px 15px 0 0",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                padding: 16,
                boxSizing: "border-box",
              }}
            >
              {Array.from({ length: 6 }, (_, j) => (
                <div key={j} style={{ background: C.cream, borderRadius: 4 }} />
              ))}
            </div>
          ))}
        </div>
        <Title size={34} style={{ textAlign: "center", marginTop: 24 }}>
          Buenos Aires
        </Title>
      </div>
      <div
        style={{
          position: "absolute",
          left: cx - 130 + Math.sin(p * Math.PI) * 80,
          top: (v ? 850 : 500) - Math.sin(p * Math.PI) * 80,
          rotate: `${-20 + p * 30}deg`,
          scale: pop(f, 28),
        }}
      >
        <Label style={{ fontSize: 34, padding: 26 }}>
          <Icon name="flight" size={44} color={C.orange} />
          Pasajes
        </Label>
      </div>
      <div
        style={{
          position: "absolute",
          left: cx - (v ? 130 : 330),
          top: v ? 1370 : 810,
          scale: pop(f, 60),
        }}
      >
        <Label>
          <Icon name="calendar_month" size={32} color={C.orange} />
          Tiempo, distancia y presupuesto.
        </Label>
      </div>
    </Backdrop>
  );
}

export function VerifyScene() {
  const { f, v, cx, cy } = useScene();
  const close = ease(f, 90, 190);
  return (
    <Backdrop dark>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          opacity: 1 - ease(f, 35, 65),
          scale: ease(f, 0, 60, 0.75, 1.2),
        }}
      >
        <BrandMark size={v ? 150 : 210} dark />
      </div>
      <div
        style={{
          position: "absolute",
          left: cx - 600,
          top: cy - 600,
          width: 1200,
          height: 1200,
          borderRadius: "50%",
          border: "120px solid #1f7d5c65",
          scale: ease(f, 20, 200, 0.25, 1.3),
          rotate: `${f * 0.3}deg`,
        }}
      />
      <Title
        size={v ? 122 : 150}
        style={{
          position: "absolute",
          top: v ? 255 : 100,
          left: 60,
          right: 60,
          textAlign: "center",
          opacity: ease(f, 40, 65),
        }}
      >
        Ya fuimos
        <br />
        <span style={{ color: C.gold }}>por vos.</span>
      </Title>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: cx + (i - 1) * (v ? 270 : 390) - (v ? 115 : 150),
            top: (v ? 950 : 600) + (i === 1 ? -70 : 25),
            width: v ? 230 : 300,
            scale: pop(f, 60 + i * 12) * (1 + close * 0.03),
            rotate: `${(i - 1) * (12 - close * 10)}deg`,
          }}
        >
          <div
            style={{
              ...card,
              padding: 30,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
              background: C.cream,
              color: C.ink,
            }}
          >
            <HouseArt
              size={v ? 130 : 170}
              color={i % 2 ? C.orange : C.forest}
            />
            <div
              style={{
                position: "absolute",
                right: -18,
                top: -20,
                scale: pop(f, 110 + i * 10),
              }}
            >
              <Check size={75} />
            </div>
            <div
              style={{
                fontSize: v ? 23 : 28,
                fontWeight: 800,
                textAlign: "center",
              }}
            >
              Residencia
              <br />
              Verificada
            </div>
          </div>
        </div>
      ))}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: v ? 360 : 160,
          textAlign: "center",
          opacity: ease(f, 95, 115),
        }}
      >
        <Label dark style={{ border: "1px solid #ffffff35" }}>
          <Icon name="location_on" size={30} color={C.gold} />
          Verificación presencial en Buenos Aires
        </Label>
      </div>
    </Backdrop>
  );
}

function SearchCard({
  index = 0,
  selected = false,
}: {
  index?: number;
  selected?: boolean;
}) {
  return (
    <div
      style={{
        ...card,
        padding: 18,
        border: selected ? `4px solid ${C.forest}` : "4px solid transparent",
        boxShadow: "0 12px 28px #0c3a2c0b",
      }}
    >
      <div
        style={{
          height: 160,
          borderRadius: 20,
          background: index % 2 ? C.orangeTint : C.forestTint,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 180,
            height: 180,
            borderRadius: "50%",
            background: "#ffffff70",
            right: -30,
            bottom: -80,
          }}
        />
        <HouseArt size={130} color={index % 2 ? C.orange : C.forest} />
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            background: "white",
            borderRadius: 20,
            padding: "5px 10px",
            fontSize: 13,
            fontWeight: 700,
            display: "flex",
            gap: 4,
            alignItems: "center",
          }}
        >
          <Icon name="verified" size={16} color={C.forest} />
          Verificada
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 14 }}>
        Residencia estudiantil
      </div>
      <div style={{ color: C.inkSoft, fontSize: 17, marginTop: 7 }}>
        Buenos Aires · CABA
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 18, color: C.forest }}>
        <Icon name="wifi" size={24} />
        <Icon name="local_laundry_service" size={24} />
        <Icon name="groups" size={24} />
      </div>
      <div
        style={{
          borderTop: `1px solid ${C.line}`,
          marginTop: 15,
          paddingTop: 12,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 17,
        }}
      >
        <span>Ver tarifas</span>
        <span style={{ color: C.forest }}>Ver residencia →</span>
      </div>
    </div>
  );
}
function Browser({
  children,
  width = 1200,
}: {
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <div style={{ ...card, width, overflow: "hidden", borderRadius: 26 }}>
      <div
        style={{
          height: 60,
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: 10,
          background: "#eff4ef",
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        {[C.orange, C.gold, C.forest].map((color) => (
          <span
            key={color}
            style={{
              width: 11,
              height: 11,
              borderRadius: "50%",
              background: color,
              opacity: 0.7,
            }}
          />
        ))}
        <div
          style={{
            margin: "0 auto",
            background: "white",
            borderRadius: 10,
            padding: "8px 90px",
            fontSize: 15,
            color: C.inkSoft,
          }}
        >
          estured.vercel.app
        </div>
      </div>
      {children}
    </div>
  );
}

export function CompareScene() {
  const { f, v, cx } = useScene();
  const focus = ease(f, 110, 175);
  const enter = ease(f, 0, 30);
  const mobile = ease(f, 175, 215);
  return (
    <Backdrop>
      <Title
        size={v ? 105 : 100}
        style={{
          position: "absolute",
          top: v ? 210 : 65,
          left: 80,
          right: 80,
          textAlign: "center",
          opacity: enter,
        }}
      >
        {f < 145 ? "Buscá. Compará." : "Vos elegís."}
        <span style={{ color: C.orange }}>
          {" "}
          {f < 145 ? "Elegí." : "En familia."}
        </span>
      </Title>
      <div
        style={{
          position: "absolute",
          left: cx - 600,
          top: v ? 600 : 265,
          transform: `perspective(1800px) rotateX(${7 - enter * 7}deg) rotateY(${-9 + focus * 7}deg) scale(${v ? 0.73 - mobile * 0.08 : 0.93 + focus * 0.06 - mobile * 0.12})`,
          opacity: 1 - mobile * (v ? 0.85 : 0.15),
          transformOrigin: "center top",
          translate: `${(1 - focus) * (v ? 0 : 70)}px ${45 * (1 - enter)}px`,
        }}
      >
        <Browser>
          <div
            style={{
              padding: "22px 30px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <BrandMark size={38} />
            <div style={{ display: "flex", gap: 22, fontSize: 18 }}>
              <span>Buscar residencias</span>
              <span>Mi perfil</span>
            </div>
          </div>
          <div style={{ padding: "8px 30px 25px", background: C.cream }}>
            <Title size={40}>Encontrá tu residencia.</Title>
            <div
              style={{
                marginTop: 20,
                padding: 15,
                background: "white",
                borderRadius: 16,
                display: "flex",
                gap: 25,
                fontSize: 20,
                alignItems: "center",
              }}
            >
              <Icon name="search" size={28} />
              <span style={{ flex: 1 }}>Buenos Aires</span>
              <span>Servicios</span>
              <span>Habitación</span>
              <span
                style={{
                  background: C.forest,
                  color: "white",
                  padding: "10px 25px",
                  borderRadius: 12,
                }}
              >
                Buscar
              </span>
            </div>
          </div>
          <div
            style={{
              padding: 25,
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 20,
            }}
          >
            {[0, 1, 2].map((i) => (
              <SearchCard key={i} index={i} selected={i === 1 && f > 130} />
            ))}
          </div>
          <div
            style={{ fontSize: 13, padding: "0 30px 17px", color: C.inkSoft }}
          >
            Vista ilustrativa · Información y servicios según cada residencia.
          </div>
        </Browser>
        <Cursor
          label="Vos"
          x={ease(f, 35, 150, 880, 620)}
          y={ease(f, 35, 150, 500, 390)}
          click={f > 125 && f < 145}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: v ? cx - 180 : 1430,
          top: v ? 600 : 280,
          width: 360,
          height: 650,
          padding: 12,
          boxSizing: "border-box",
          background: C.forestInk,
          borderRadius: 48,
          boxShadow: "0 30px 80px #0c3a2c40",
          scale: (v ? 1.2 : 0.96) * pop(f, 175),
          rotate: `${8 - mobile * 5}deg`,
          transformOrigin: "center top",
          opacity: mobile,
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 37,
            background: C.cream,
            padding: 21,
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: 105,
              height: 21,
              borderRadius: 20,
              background: C.forestInk,
              margin: "-9px auto 22px",
            }}
          />
          <BrandMark size={30} />
          <div
            style={{
              background: "white",
              borderRadius: 15,
              padding: 13,
              margin: "20px 0 15px",
              fontSize: 20,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Icon name="search" size={24} />
            Buenos Aires
          </div>
          <SearchCard index={1} selected />
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              textAlign: "center",
              marginTop: 22,
              color: C.forest,
            }}
          >
            Elegí desde tu casa.
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: v ? 60 : 80,
          top: v ? 1480 : 750,
          scale: pop(f, 160),
          rotate: "-6deg",
        }}
      >
        <Label>
          <Face variant={1} size={65} />
          <span>
            Tu familia acompaña.
            <br />
            <span style={{ color: C.forest }}>Vos decidís.</span>
          </span>
        </Label>
      </div>
      <div
        style={{
          position: "absolute",
          right: v ? 60 : 100,
          top: v ? 1615 : 900,
          scale: pop(f, 200),
          rotate: "5deg",
        }}
      >
        <Label style={{ background: C.forestInk, color: "white" }}>
          <Icon name="tune" size={35} color={C.gold} />
          Ubicación · servicios · reglas · precios
        </Label>
      </div>
    </Backdrop>
  );
}

export function BookingScene() {
  const { f, v, cx } = useScene();
  const receipt = ease(f, 140, 190);
  const steps = [
    "Solicitud enviada",
    "Pago a residencia",
    "Fee EstuRed",
    "Reserva confirmada",
  ];
  return (
    <Backdrop>
      <Title
        size={v ? 105 : 105}
        style={{
          position: "absolute",
          top: v ? 220 : 65,
          left: 80,
          right: 80,
          textAlign: "center",
        }}
      >
        Cada paso,
        <br style={{ display: v ? "block" : "none" }} />
        <span style={{ color: C.orange }}> registrado.</span>
      </Title>
      <div
        style={{
          position: "absolute",
          left: cx - 565,
          top: v ? 610 : 290,
          scale: v ? 0.78 : 1,
          transformOrigin: "center top",
          rotate: `${-3 + receipt * 3}deg`,
          translate: `${-receipt * (v ? 30 : 170)}px 0px`,
        }}
      >
        <Browser width={1130}>
          <div style={{ display: "flex", minHeight: 490 }}>
            <div
              style={{
                width: 200,
                padding: 24,
                background: C.forestInk,
                color: "white",
                boxSizing: "border-box",
              }}
            >
              <BrandMark size={30} dark />
              {["Mi panel", "Mis solicitudes", "Mi reserva", "Soporte"].map(
                (t, i) => (
                  <div
                    key={t}
                    style={{
                      marginTop: 35,
                      fontSize: 19,
                      color: i === 2 ? C.gold : "white",
                    }}
                  >
                    {t}
                  </div>
                ),
              )}
            </div>
            <div style={{ padding: 35, flex: 1 }}>
              <Title size={43}>Mi reserva</Title>
              <div style={{ fontSize: 20, color: C.inkSoft, marginTop: 10 }}>
                Seguí el proceso desde tu panel.
              </div>
              {steps.map((s, i) => {
                const complete = f > 30 + i * 30;
                return (
                  <div
                    key={s}
                    style={{
                      display: "flex",
                      gap: 17,
                      alignItems: "center",
                      marginTop: 25,
                      fontSize: 24,
                      color: complete ? C.forest : C.inkSoft,
                      opacity: complete ? 1 : 0.45,
                    }}
                  >
                    <Icon
                      name={
                        complete ? "check_circle" : "radio_button_unchecked"
                      }
                      size={35}
                    />
                    {s}
                    {i === 3 && complete ? (
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: 17,
                          background: C.forestTint,
                          padding: 10,
                          borderRadius: 12,
                        }}
                      >
                        Confirmada
                      </span>
                    ) : null}
                  </div>
                );
              })}
              <div style={{ fontSize: 15, color: C.inkSoft, marginTop: 28 }}>
                Solicitud sujeta a confirmación de la residencia.
              </div>
            </div>
          </div>
        </Browser>
      </div>
      <div
        style={{
          position: "absolute",
          left: v ? cx - 260 : 1190,
          top: v ? 1040 : 365,
          width: 520,
          scale: pop(f, 145),
          rotate: `${8 - receipt * 3}deg`,
          ...card,
          padding: 38,
          boxSizing: "border-box",
          background: C.forestInk,
          color: "white",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <BrandMark size={35} dark />
          <Check size={65} />
        </div>
        <Title size={48} style={{ marginTop: 30 }}>
          Reserva
          <br />
          confirmada.
        </Title>
        <div style={{ fontSize: 23, color: C.forestTint, marginTop: 22 }}>
          Tu comprobante verificable.
        </div>
        <div style={{ height: 2, background: "#ffffff30", margin: "26px 0" }} />
        <div style={{ display: "flex", gap: 25, alignItems: "center" }}>
          <div style={{ background: C.cream, padding: 18, borderRadius: 20 }}>
            <Icon name="description" size={64} color={C.forest} />
          </div>
          <div style={{ fontSize: 23 }}>
            Ver comprobante
            <br />
            <span style={{ fontSize: 16, color: C.forestTint }}>
              Registro de tu reserva
            </span>
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: v ? 290 : 120,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: ease(f, 230, 250),
        }}
      >
        <Label>
          <Icon name="fact_check" size={30} color={C.forest} />
          Para consultar y compartir cuando lo necesites.
        </Label>
      </div>
    </Backdrop>
  );
}

export function CommunityScene() {
  const { f, v, cx } = useScene();
  const y = v ? 980 : 590;
  const spread = ease(f, 20, 110);
  const faces = [0, 1, 2, 3, 5, 6];
  return (
    <Backdrop>
      <Title
        size={v ? 111 : 118}
        style={{
          position: "absolute",
          left: 65,
          right: 65,
          top: v ? 210 : 70,
          textAlign: "center",
        }}
      >
        La convivencia
        <br />
        <span style={{ color: C.orange }}>también se elige.</span>
      </Title>
      <svg
        width={v ? 1080 : 1920}
        height={v ? 1750 : 1050}
        style={{ position: "absolute" }}
      >
        {faces.map((_, i) => {
          const a = (i * Math.PI) / 3 + 0.3;
          return (
            <path
              key={i}
              d={`M${cx} ${y} Q${cx + Math.cos(a) * 160} ${y - 140} ${cx + Math.cos(a) * (v ? 340 : 540) * spread} ${y + Math.sin(a) * (v ? 330 : 230) * spread}`}
              fill="none"
              stroke={i % 2 ? C.orange : C.forest}
              strokeWidth="3"
              opacity={0.35}
              strokeDasharray="7 8"
              strokeDashoffset={-f * 0.5}
            />
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          left: cx - 100,
          top: y - 100,
          scale: pop(f),
        }}
      >
        <div
          style={{
            background: "white",
            padding: 25,
            borderRadius: 45,
            boxShadow: card.boxShadow,
          }}
        >
          <HouseArt size={150} />
        </div>
      </div>
      {faces.map((variant, i) => {
        const a = (i * Math.PI) / 3 + 0.3;
        const x = cx + Math.cos(a) * (v ? 340 : 540) * spread;
        const yy = y + Math.sin(a) * (v ? 330 : 230) * spread;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - 85,
              top: yy - 85,
              scale: pop(f, 15 + i * 9),
              translate: `0px ${Math.sin(f / 35 + i) * 10}px`,
            }}
          >
            <div
              style={{
                padding: 7,
                background: "white",
                borderRadius: "50%",
                boxShadow: card.boxShadow,
              }}
            >
              <Face size={160} variant={variant} />
            </div>
            <div
              style={{
                position: "absolute",
                bottom: -10,
                right: -8,
                background: i % 2 ? C.orange : C.forest,
                borderRadius: 18,
                padding: 10,
              }}
            >
              <Icon
                name={
                  [
                    "school",
                    "music_note",
                    "public",
                    "sports_basketball",
                    "menu_book",
                    "brush",
                  ][i]
                }
                size={24}
                color="white"
              />
            </div>
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          bottom: v ? 300 : 125,
          textAlign: "center",
          opacity: ease(f, 110, 135),
        }}
      >
        <Label>
          <Icon name="groups" size={32} color={C.forest} />
          Descubrí la comunidad de cada residencia.
        </Label>
        <div style={{ fontSize: 19, color: C.inkSoft, marginTop: 20 }}>
          Perfiles e intereses ilustrativos. Cada residente decide qué mostrar.
        </div>
      </div>
    </Backdrop>
  );
}

export function SupportScene() {
  const { f, v, cx } = useScene();
  const q = ease(f, 0, 40);
  const sent = f > 110;
  return (
    <Backdrop dark>
      <Title
        size={v ? 120 : 140}
        style={{
          position: "absolute",
          left: 70,
          right: 70,
          top: v ? 220 : 80,
          textAlign: "center",
        }}
      >
        ¿Necesitás ayuda?
        <br />
        <span style={{ color: C.gold }}>Estamos.</span>
      </Title>
      <div
        style={{
          position: "absolute",
          left: cx - 440,
          top: v ? 760 : 430,
          width: 880,
          scale: v ? 0.95 : 1,
          translate: `0px ${(1 - q) * 100}px`,
          rotate: `${-4 + q * 4}deg`,
        }}
      >
        <div style={{ ...card, padding: 38, color: C.ink }}>
          <div
            style={{
              display: "flex",
              gap: 22,
              alignItems: "center",
              borderBottom: `1px solid ${C.line}`,
              paddingBottom: 26,
            }}
          >
            <div
              style={{
                padding: 20,
                background: C.forestTint,
                borderRadius: 25,
              }}
            >
              <Icon name="support_agent" size={65} color={C.forest} />
            </div>
            <div>
              <Title size={47}>Soporte EstuRed</Title>
              <div style={{ fontSize: 24, color: C.inkSoft, marginTop: 8 }}>
                Contanos en qué podemos ayudarte.
              </div>
            </div>
          </div>
          <div
            style={{
              border: `2px solid ${C.line}`,
              borderRadius: 20,
              padding: 25,
              marginTop: 25,
              fontSize: 26,
              minHeight: 55,
              display: "flex",
              alignItems: "center",
            }}
          >
            {sent
              ? "Consulta registrada"
              : "Tengo una consulta sobre mi reserva."}
          </div>
          <div
            style={{
              marginTop: 24,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 18, color: C.inkSoft }}>
              Desde tu panel
            </span>
            <div
              style={{
                background: sent ? C.forest : C.orange,
                color: "white",
                padding: "17px 30px",
                borderRadius: 16,
                fontSize: 24,
                fontWeight: 700,
                display: "flex",
                gap: 12,
              }}
            >
              <Icon name={sent ? "check_circle" : "send"} size={27} />
              {sent ? "Enviada" : "Enviar consulta"}
            </div>
          </div>
        </div>
        <Cursor
          label="Vos"
          x={ease(f, 40, 105, 800, 665)}
          y={ease(f, 40, 105, 500, 356)}
          click={f > 100 && f < 115}
        />
      </div>
    </Backdrop>
  );
}

export function FinaleScene() {
  const { f, v, cx } = useScene();
  const t = ease(f, 10, 70);
  return (
    <Backdrop dark>
      <div
        style={{
          position: "absolute",
          left: cx - 700,
          top: (v ? 900 : 550) - 700,
          width: 1400,
          height: 1400,
          border: "100px solid #1f7d5c70",
          borderRadius: "50%",
          scale: 0.5 + t * 0.5,
          rotate: `${f * 0.25}deg`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          top: v ? 210 : 75,
          textAlign: "center",
          translate: `0px ${(1 - t) * 100}px`,
          opacity: t,
        }}
      >
        <Title size={v ? 130 : 145}>
          Tu próxima etapa
          <br />
          <span style={{ color: C.gold }}>empieza acá.</span>
        </Title>
      </div>
      <div
        style={{
          position: "absolute",
          left: cx - (v ? 300 : 360),
          top: v ? 830 : 450,
          width: v ? 600 : 720,
          height: v ? 290 : 240,
          display: "grid",
          placeItems: "center",
          ...card,
          background: C.cream,
          rotate: `${-7 + ease(f, 30, 100) * 7}deg`,
          scale: pop(f, 20),
          boxShadow: "0 35px 100px #001b2460",
        }}
      >
        <BrandMark size={v ? 135 : 140} />
      </div>
      <div
        style={{
          position: "absolute",
          left: cx - 350,
          top: v ? 1220 : 760,
          width: 700,
          textAlign: "center",
          scale: pop(f, 65),
        }}
      >
        <div
          style={{
            background: C.orangeLight,
            color: C.forestInk,
            borderRadius: 24,
            padding: "24px 40px",
            fontSize: v ? 46 : 37,
            fontWeight: 800,
            boxShadow: "0 20px 50px #0002",
          }}
        >
          Sumate. Completá tu perfil.{" "}
          <span
            style={{
              display: "inline-block",
              translate: `${Math.sin(f / 12) * 5}px 0px`,
            }}
          >
            ↗
          </span>
        </div>
        <div
          style={{
            marginTop: 30,
            fontSize: 31,
            color: C.cream,
            fontFamily: display,
          }}
        >
          estured.vercel.app
        </div>
      </div>
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        {Array.from({ length: 16 }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: cx + Math.cos(i * 2.4) * (v ? 430 : 750),
              top: (v ? 990 : 580) + Math.sin(i * 2.4) * (v ? 400 : 350),
              width: 12 + (i % 3) * 5,
              height: 12 + (i % 3) * 5,
              borderRadius: i % 2 ? "50%" : 4,
              background: i % 3 ? C.gold : C.orangeLight,
              rotate: `${f + i * 20}deg`,
              opacity: ease(f, 35 + i * 2, 55 + i * 2) * 0.75,
              translate: `0px ${Math.sin(f / 22 + i) * 18}px`,
            }}
          />
        ))}
      </AbsoluteFill>
    </Backdrop>
  );
}
