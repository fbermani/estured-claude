"""Música original de EstuRed Launch (HyperFrames), 120 BPM en Re mayor, calzada a timeline.json.

Síntesis propia (numpy): bombo, palmas, hi-hats, bajo, pad, piano eléctrico y arpegio pulsado (Karplus-Strong).
Estructura (de timeline.json): tensión contenida en Si menor hasta la marca → entrada (impacto + acorde) → groove →
payoff con melodía en el comprobante → respiro en «por fuera» → final con melodía y acorde largo en el CTA.
Ducking: −7 dB bajo cada frase de assets/voice/voice.json.

CLI: python make-music.py  → assets/music/estured-launch.wav (estéreo 44,1 kHz); imprime JSON con duración y pico.
"""
import json
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SR = 44100
TL = json.loads((ROOT / "timeline.json").read_text())
DUR = TL["duration"]
BEAT = 60 / TL["bpm"]
N = int(round(SR * DUR))
rng = np.random.default_rng(7)
L = np.zeros(N)
R = np.zeros(N)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def place(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    L[i : i + len(sig)] += sig * np.sqrt(0.5 * (1 - pan))
    R[i : i + len(sig)] += sig * np.sqrt(0.5 * (1 + pan))


def onepole_lp(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for k in range(len(x)):
        acc = (1 - a) * x[k] + a * acc
        y[k] = acc
    return y


def env(n, a=0.005, d=0.2, s=0.0, r=0.05):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-6), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-6)))
    rel = int(r * SR)
    if rel and rel < n:
        e[-rel:] *= np.linspace(1, 0, rel)
    return e


# ---------- instrumentos ----------
def kick():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 48 + 90 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5) + 0.15 * np.sin(2 * np.pi * 95 * t) * np.exp(-t * 40)


def clap():
    n = int(0.3 * SR)
    noise = rng.standard_normal(n)
    hp = noise - onepole_lp(noise, 900)
    e = np.zeros(n)
    for off in (0, 0.011, 0.022):
        i = int(off * SR)
        e[i:] += np.exp(-np.arange(n - i) / SR * 30)
    return hp * e * 0.5


def hat(open_=False):
    n = int((0.22 if open_ else 0.06) * SR)
    noise = rng.standard_normal(n)
    hp = noise - onepole_lp(noise, 7000)
    return hp * np.exp(-np.arange(n) / SR * (14 if open_ else 70)) * 0.35


def bass(m, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi(m)
    saw = 2 * ((t * f) % 1) - 1
    sig = 0.6 * np.sin(2 * np.pi * f * t) + 0.25 * onepole_lp(saw, 420)
    return sig * env(n, 0.004, 0.35, 0.55, 0.04)


def pad(notes, dur, cutoff=1400):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for m in notes:
        for det in (-0.09, 0.0, 0.08):
            f = midi(m) * 2 ** (det / 12)
            sig += 2 * ((t * f + rng.random()) % 1) - 1
    sig = onepole_lp(onepole_lp(sig / (3 * len(notes)), cutoff), cutoff)
    a = min(0.6, dur / 3)
    e = np.minimum(1, t / a) * np.minimum(1, (dur - t) / min(0.5, dur / 3))
    return sig * e


def epiano(m, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi(m)
    sig = np.sin(2 * np.pi * f * t + 0.6 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 4))
    sig += 0.25 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 6)
    return sig * env(n, 0.003, 0.9, 0.0, 0.08)


def pluck(m, dur=0.5):
    f = midi(m)
    period = int(SR / f)
    n = int(dur * SR)
    buf = rng.uniform(-1, 1, period)
    out = np.empty(n)
    for k in range(n):
        out[k] = buf[k % period]
        buf[k % period] = 0.497 * (buf[k % period] + buf[(k + 1) % period])
    return out * env(n, 0.001, 0.3, 0.0, 0.05)


def bell(m, dur=1.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi(m)
    sig = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 5)
    return sig * env(n, 0.002, 0.6, 0.0, 0.1)


def noise_riser(dur):
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    t = np.linspace(0, 1, n)
    hp = noise - onepole_lp(noise, 2500)
    return hp * t ** 2.2 * 0.25


# ---------- armonía: D – A – Bm – G (un acorde por compás de 2 s) ----------
CHORDS = {"D": [50, 57, 62, 66], "A": [45, 57, 61, 64], "Bm": [47, 54, 59, 62], "G": [43, 55, 59, 62], "Em": [40, 55, 59, 64]}
ROOT_NOTE = {"D": 38, "A": 33, "Bm": 35, "G": 31, "Em": 28}
PROG = ["D", "A", "Bm", "G"]
BAR = 4 * BEAT
KICK, CLAP, HAT, OHAT = kick(), clap(), hat(), hat(True)


def groove(t0, t1, full=True, arp=True, lead=False):
    t = t0
    bar_i = 0
    while t < t1 - 1e-6:
        ch = PROG[bar_i % 4]
        place(pad([n + 12 for n in CHORDS[ch][1:]], BAR + 0.3, 1800), t, 0.16, 0.0)
        for b in range(4):
            tb = t + b * BEAT
            if tb >= t1:
                break
            if full:
                place(KICK, tb, 0.55)
                if b in (1, 3):
                    place(CLAP, tb, 0.30, 0.1)
                place(OHAT if b == 3 else HAT, tb + BEAT / 2, 0.28, 0.25)
            for e in (0, 0.5):
                place(bass(ROOT_NOTE[ch] + 12, BEAT / 2 * 0.9), tb + e * BEAT, 0.30 if full else 0.2)
            if arp:
                notes = CHORDS[ch][1:] + [CHORDS[ch][1] + 12]
                for s in range(4):
                    m = notes[(b * 4 + s) % 4] + 12
                    place(pluck(m, 0.45), tb + s * BEAT / 4, 0.10, -0.35 if s % 2 else 0.35)
        if lead:
            mel = {"D": [74, 76, 78], "A": [76, 73, 69], "Bm": [74, 78, 81], "G": [79, 78, 74]}[ch]
            for k, m in enumerate(mel):
                place(bell(m, 1.0), t + k * BEAT * (4 / 3), 0.13, 0.15)
        t += BAR
        bar_i += 1


S = {sc["id"]: sc["start"] for sc in TL["scenes"]}
T_REVEAL = S["s03-reveal"]
# lo viejo (hasta la marca): pulso contenido en Si menor, sin bombo, pad filtrado que no resuelve
for k in range(int(T_REVEAL / BAR) + 1):
    t = k * BAR
    if t < T_REVEAL:
        place(pad([47, 50, 54, 61] if k % 2 == 0 else [47, 50, 55, 59], min(BAR + 0.4, T_REVEAL - t + 0.2), 650), t, 0.22)
for k in range(int(T_REVEAL / BEAT)):
    tb = k * BEAT
    place(bass(35, 0.18), tb, 0.12 if tb < S["s02-tension"] else 0.2)
    if tb >= S["s02-tension"]:
        place(HAT, tb + BEAT / 2, 0.16, 0.3)
place(noise_riser(3.5), T_REVEAL - 3.5, 1.0)

# entrada de la marca: acorde de Re pleno + impacto grave
place(pad([62, 66, 69, 74], 3.6, 2600), T_REVEAL, 0.22)
for m in (50, 57, 62, 66, 69):
    place(epiano(m, 3.4), T_REVEAL, 0.11)
place(KICK, T_REVEAL, 0.8)
place(bass(38, 1.6), T_REVEAL, 0.4)
for k in range(4):
    for s_ in range(4):
        place(pluck([62, 66, 69, 74][s_] + 12, 0.4), T_REVEAL + 2.0 + k * BEAT / 2 + s_ * BEAT / 8, 0.05, 0.3)

groove(S["s04-verified"], S["s09-receipt"] - 2.0, full=True)
groove(S["s09-receipt"] - 2.0, S["s09-receipt"], full=False)
place(noise_riser(2.0), S["s09-receipt"] - 2.0, 0.8)
groove(S["s09-receipt"], S["s10-outside"], full=True, lead=True)
# por fuera / con EstuRed: respiro (solo pad y piano), vuelve el pulso en «Con EstuRed»
for k, ch in enumerate(["Bm", "G", "D", "A"]):
    place(pad([n + 12 for n in CHORDS[ch][1:]], BAR + 0.3, 1200), S["s10-outside"] + k * BAR, 0.18)
    for m in CHORDS[ch][1:]:
        place(epiano(m + 12, BAR), S["s10-outside"] + k * BAR, 0.06)
groove(S["s11-community"], S["s12-end"] + 3.0, full=True, lead=True)
T_END = S["s12-end"] + 3.0
# acorde final largo cuando aterriza «Sumate a EstuRed»
place(pad([62, 66, 69, 74, 78], DUR - T_END, 2400), T_END, 0.22)
for m in (50, 57, 62, 66, 69, 74):
    place(epiano(m, DUR - T_END), T_END, 0.1)
place(KICK, T_END, 0.6)
place(bass(38, 2.5), T_END, 0.35)

# ---------- ducking bajo la voz ----------
voice = json.loads((ROOT / "assets/voice/voice.json").read_text())
duck = np.ones(N)
by_id = {v["id"]: v for v in voice}
for sc in TL["scenes"]:
    v = by_id[sc["line"]]
    a = sc["voice"] + v["words"][0]["start"] - 0.08
    b = sc["voice"] + v["words"][-1]["end"] + 0.25
    duck[int(a * SR) : int(b * SR)] = 10 ** (-7 / 20)
duck = onepole_lp(onepole_lp(duck, 6.0), 6.0)
L *= duck
R *= duck

# fade final y normalización a −1 dBFS de pico
fade = int(1.6 * SR)
L[-fade:] *= np.linspace(1, 0, fade) ** 1.5
R[-fade:] *= np.linspace(1, 0, fade) ** 1.5
peak = max(np.abs(L).max(), np.abs(R).max())
g = 10 ** (-1 / 20) / peak
st = np.stack([L * g, R * g], axis=1)
out = ROOT / "assets/music/estured-launch.wav"
out.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((st * 32767).astype("<i2").tobytes())
print(json.dumps({"out": str(out.relative_to(ROOT)), "duration": DUR, "peak_dbfs": -1.0}))
