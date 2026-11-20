"""Genera la narración (es-AR-ElenaNeural, edge-tts) frase por frase con tiempos por palabra.

CLI: python make-voice.py  (necesita edge-tts >= 7.3 y ffprobe en PATH; conexión a internet)
Salida: assets/voice/line-NN.mp3 + assets/voice/voice.json (JSON por stdout).
"""
import asyncio
import json
import subprocess
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/voice"
VOICE = "es-AR-ElenaNeural"
RATE = "+3%"
LINES = [
    "Te vas a estudiar a Buenos Aires. Y tenés que elegir dónde vivir… desde lejos.",
    "Fotos que no sabés si son de hoy. Precios por chat. Una seña sin comprobante.",
    "Por eso existe EstuRed.",
    "Cada residencia está verificada en persona. Y tenés toda la información: servicios, reglamento, condiciones de admisión… y filtros para encontrar la tuya.",
    "Comparás desde tu casa y enviás tu solicitud. Queda registrada, y sujeta a la confirmación de la residencia.",
    "Tu familia puede proponerte opciones y acompañarte en cada paso. La decisión es tuya.",
    "Del otro lado, la residencia recibe solicitudes ordenadas y completas. Menos mensajes repetidos.",
    "Las condiciones quedan por escrito. Pagás a la residencia y el fee de EstuRed, por separado.",
    "Y al confirmar, recibís tu Comprobante de Reserva Confirmada, con un código que cualquiera puede verificar.",
    "Y antes de llegar, conocés tu comunidad: cuántos son, en qué habitaciones, y lo que cada uno elige mostrar.",
    "Porque la convivencia también se elige. Sumate a EstuRed.",
    "Por fuera, todo queda en chats sueltos. Con EstuRed, queda por escrito: con comprobante y con Soporte.",
]


def duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    )
    return round(float(out.stdout.strip()), 3)


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    result = []
    for i, text in enumerate(LINES, 1):
        path = OUT / f"line-{i:02d}.mp3"
        words = []
        talk = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary")
        with path.open("wb") as fh:
            async for chunk in talk.stream():
                if chunk["type"] == "audio":
                    fh.write(chunk["data"])
                elif chunk["type"] == "WordBoundary":
                    start = chunk["offset"] / 1e7
                    words.append({"text": chunk["text"], "start": round(start, 3), "end": round(start + chunk["duration"] / 1e7, 3)})
        result.append({"id": f"line-{i:02d}", "text": text, "src": f"assets/voice/{path.name}", "duration": duration(path), "words": words})
    (OUT / "voice.json").write_text(json.dumps(result, ensure_ascii=False, indent=1))
    print(json.dumps([{k: r[k] for k in ("id", "duration")} for r in result]))


asyncio.run(main())
