"""Arma index.html (16:9 o 9:16) y compositions/captions[-v].html desde timeline.json y assets/voice/voice.json.

CLI: python3 build-root.py [--vertical]   → escribe los archivos y un JSON con los grupos de subtítulos.
Las escenas viven en compositions/<id>.html (16:9) y compositions/v/<id>.html (9:16).
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERTICAL = "--vertical" in sys.argv
W, H = (1080, 1920) if VERTICAL else (1920, 1080)
TL = json.loads((ROOT / "timeline.json").read_text())
VOICE = {v["id"]: v for v in json.loads((ROOT / "assets/voice/voice.json").read_text())}
SC = {s["id"]: s for s in TL["scenes"]}
DUR = TL["duration"]

# Efectos: (escena, segundo local, archivo, volumen). Cada uno tiene su causa en pantalla.
SFX = [
    ("s01-hook", 0.10, "notification", 0.28), ("s01-hook", 1.05, "pop", 0.30), ("s01-hook", 2.05, "pop", 0.26),
    ("s02-tension", 0.30, "whoosh-short", 0.30), ("s02-tension", 1.0, "pop", 0.26), ("s02-tension", 3.0, "pop", 0.24),
    ("s02-tension", 5.0, "pop", 0.26), ("s02-tension", 6.5, "whoosh", 0.30),
    ("s03-reveal", 0.0, "impact-bass-2", 0.50), ("s03-reveal", 2.95, "whoosh", 0.28),
    ("s04-verified", 1.2, "click-soft", 0.30), ("s04-verified", 1.55, "click-soft", 0.28), ("s04-verified", 1.9, "click-soft", 0.30),
    ("s04-verified", 2.25, "click-soft", 0.28), ("s04-verified", 2.6, "sparkle", 0.20), ("s04-verified", 3.95, "whoosh-short", 0.24),
    ("s04-verified", 4.75, "whoosh-short", 0.22), ("s04-verified", 5.75, "pop", 0.22), ("s04-verified", 6.7, "whoosh-short", 0.22),
    ("s04-verified", 7.5, "click-soft", 0.30), ("s04-verified", 8.4, "whoosh-short", 0.26), ("s04-verified", 9.4, "click", 0.34),
    ("s04-verified", 10.55, "whoosh", 0.28),
    ("s05-family", 1.15, "click", 0.34), ("s05-family", 1.3, "whoosh-short", 0.24), ("s05-family", 4.25, "click", 0.34),
    ("s05-family", 4.35, "pop", 0.24),
    ("s06-request", 1.45, "click", 0.34), ("s06-request", 2.35, "click", 0.30), ("s06-request", 3.65, "click", 0.34),
    ("s06-request", 3.9, "pop", 0.26), ("s06-request", 7.55, "whoosh-short", 0.30),
    ("s07-residence", 0.05, "pop", 0.22), ("s07-residence", 0.95, "whoosh-short", 0.26), ("s07-residence", 1.5, "pop", 0.30),
    ("s07-residence", 5.6, "click-soft", 0.30),
    ("s08-steps", 0.75, "click-soft", 0.30), ("s08-steps", 3.6, "click-soft", 0.30), ("s08-steps", 4.6, "click-soft", 0.30),
    ("s08-steps", 5.75, "click-soft", 0.32),
    ("s09-receipt", 0.1, "whoosh-short", 0.26), ("s09-receipt", 2.3, "impact-bass-2", 0.40), ("s09-receipt", 3.6, "whoosh-short", 0.24),
    ("s09-receipt", 4.75, "key-press", 0.30), ("s09-receipt", 5.0, "sparkle", 0.24),
    ("s10-outside", 0.0, "whoosh", 0.26), ("s10-outside", 1.0, "pop", 0.20), ("s10-outside", 1.3, "pop", 0.18), ("s10-outside", 1.6, "pop", 0.20),
    ("s10-outside", 3.8, "click-soft", 0.30), ("s10-outside", 5.95, "click-soft", 0.30), ("s10-outside", 6.8, "click-soft", 0.30),
    ("s10-outside", 7.25, "whoosh", 0.26),
    ("s11-community", 2.75, "whoosh-short", 0.22), ("s11-community", 3.75, "whoosh-short", 0.22), ("s11-community", 5.25, "pop", 0.26),
    ("s12-end", 0.35, "impact-bass-2", 0.34), ("s12-end", 3.2, "pop", 0.24),
]


def caption_groups():
    groups = []
    for sc in TL["scenes"]:
        v = VOICE[sc["line"]]
        tokens = v["text"].split()
        words = v["words"]
        real = [t for t in tokens if re.search(r"\w", t)]
        if len(real) != len(words):
            raise SystemExit(f"{v['id']}: {len(real)} palabras en el texto y {len(words)} con tiempo")
        timed, wi = [], 0
        for t in tokens:
            if re.search(r"\w", t):
                w = words[wi]
                wi += 1
                timed.append([t, sc["voice"] + w["start"], sc["voice"] + w["end"]])
            elif timed:
                timed[-1][0] += " " + t
        cur = []
        for i, (t, a, b) in enumerate(timed):
            cur.append((t, a, b))
            end_punct = re.search(r"[.,:;?!…]$", t)
            nxt_pause = i + 1 < len(timed) and timed[i + 1][1] - b > 0.18
            if end_punct or nxt_pause or len(cur) >= 6 or i == len(timed) - 1:
                if len(cur) <= 2 and groups and groups[-1]["line"] == v["id"] and not re.search(r"[.?!…]$", groups[-1]["text"]) and len(groups[-1]["text"].split()) + len(cur) <= 8:
                    g = groups[-1]
                    g["text"] += " " + " ".join(x[0] for x in cur)
                    g["end"] = cur[-1][2]
                else:
                    groups.append({"line": v["id"], "text": " ".join(x[0] for x in cur), "start": cur[0][1], "end": cur[-1][2]})
                cur = []
    for i, g in enumerate(groups):
        g["start"] = round(max(0.1, g["start"] - 0.05), 3)
        nxt = groups[i + 1]["start"] if i + 1 < len(groups) else DUR
        g["end"] = round(min(nxt - 0.02, g["end"] + 0.45), 3)
    return groups


FONTS = """@font-face { font-family: 'Hanken Grotesk'; src: url('assets/fonts/HankenGrotesk.woff2') format('woff2'); font-weight: 100 900; }"""


def write_captions(groups):
    fs = 44 if VERTICAL else 38
    maxw = 900 if VERTICAL else 1500
    bottom = 600 if VERTICAL else 64
    items = []
    for i, g in enumerate(groups):
        items.append(
            f'    <div id="cap-{i:02d}" class="cap clip" data-start="{g["start"]}" data-duration="{round(g["end"] - g["start"], 3)}">'
            f'<span class="cap-text">{g["text"]}</span></div>'
        )
    cid = "captions-v" if VERTICAL else "captions"
    html = f"""<template>
  <style>
    {FONTS}
    #root {{ position: absolute; inset: 0; pointer-events: none; }}
    .cap {{ position: absolute; left: 0; right: 0; bottom: {bottom}px; display: flex; justify-content: center; }}
    .cap-text {{
      display: inline-block; max-width: {maxw}px; padding: 12px 26px 14px; border-radius: 14px;
      background: rgba(12, 58, 44, 0.9); color: #fffdf8; text-align: center;
      font-family: 'Hanken Grotesk', sans-serif; font-weight: 600; font-size: {fs}px; line-height: 1.28; letter-spacing: -0.005em;
    }}
  </style>
  <div id="root" data-composition-id="{cid}" data-width="{W}" data-height="{H}">
{chr(10).join(items)}
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
    const caps = {json.dumps([[f"#cap-{i:02d}", g["start"], g["end"]] for i, g in enumerate(groups)])};
    for (const [sel, a, b] of caps) {{
      tl.fromTo(sel + " .cap-text", {{ opacity: 0, filter: "blur(6px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.14, ease: "power3.out" }}, a);
      tl.to(sel + " .cap-text", {{ opacity: 0, duration: 0.1, ease: "power2.in" }}, b - 0.1);
    }}
    window.__timelines["{cid}"] = tl;
  </script>
</template>
"""
    (ROOT / "compositions" / f"{cid}.html").write_text(html)


def write_index(groups):
    sub = "v/" if VERTICAL else ""
    hosts, audio = [], []
    for k, sc in enumerate(TL["scenes"]):
        hosts.append(
            f'      <div id="{sc["id"]}" data-composition-id="{sc["id"]}" data-composition-src="compositions/{sub}{sc["id"]}.html" '
            f'data-start="{sc["start"]}" data-duration="{sc["duration"]}" data-track-index="1" data-track-kind="graphics" '
            f'data-width="{W}" data-height="{H}" style="z-index: {k + 1}"></div>'
        )
    for sc in TL["scenes"]:
        v = VOICE[sc["line"]]
        audio.append(
            f'      <audio id="vo-{sc["id"][:3]}" src="{v["src"]}" data-start="{sc["voice"]}" data-duration="{round(v["words"][-1]["end"] + 0.4, 3)}" data-track-index="3" data-volume="1"></audio>'
        )
    SFX_DUR = {"click": 0.37, "click-soft": 0.37, "pop": 0.72, "whoosh-short": 0.57, "whoosh": 0.57, "impact-bass-2": 2.59, "notification": 2.46, "key-press": 0.4, "sparkle": 1.8}
    for i, (sid, t, f, vol) in enumerate(SFX):
        at = round(SC[sid]["start"] + t, 3)
        audio.append(f'      <audio id="sfx-{i:02d}" src="assets/sfx/{f}.mp3" data-start="{at}" data-duration="{SFX_DUR[f]}" data-track-index="{5 + i % 3}" data-volume="{vol}"></audio>')
    cid = "captions-v" if VERTICAL else "captions"
    html = f"""<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <title>EstuRed — Lanzamiento ({'9:16' if VERTICAL else '16:9'})</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: {W}px; height: {H}px; overflow: hidden; background: #0c3a2c; }}
      #root {{ position: relative; width: {W}px; height: {H}px; overflow: hidden; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="{W}" data-height="{H}" data-motion-blur="on">
{chr(10).join(hosts)}
      <div id="{cid}" data-composition-id="{cid}" data-composition-src="compositions/{cid}.html" data-start="0" data-duration="{DUR}" data-track-index="2" data-track-kind="captions" data-width="{W}" data-height="{H}" style="z-index: 50"></div>
      <audio id="music" src="assets/music/estured-launch.wav" data-start="0" data-duration="{DUR}" data-track-index="4" data-volume="0.55"></audio>
{chr(10).join(audio)}
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
"""
    name = "vertical/index.html" if VERTICAL else "index.html"
    (ROOT / name).write_text(html)


groups = caption_groups()
write_captions(groups)
write_index(groups)
print(json.dumps([[g["start"], g["end"], g["text"]] for g in groups], ensure_ascii=False))
