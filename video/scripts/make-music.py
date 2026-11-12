"""Synthesize an original soundtrack. CLI: python3 scripts/make-music.py; JSON output."""
import array
import json
import math
import random
import wave
from pathlib import Path
RATE, SECONDS = 22050, 60
random.seed(7)
samples = array.array('f', [0]) * (RATE * SECONDS)
def tone(start, duration, freq, gain):
    for i in range(int(duration * RATE)):
        pos = int(start * RATE) + i
        if pos >= len(samples):
            break
        t = i / RATE
        env = min(1, t / .012) * math.exp(-t * 5)
        phase = 2 * math.pi * freq * t
        samples[pos] += (math.sin(phase)+.2*math.sin(2*phase)) * env * gain
chords = [(220,261.63,329.63),(174.61,220,261.63),(130.81,164.81,196),(196,246.94,293.66)]
for b in range(120):
    start = b * .5
    chord = chords[(b//8)%4]
    tone(start,.4,chord[0]/2,.14)
    if b >= 26:
        tone(start+.25,.6,chord[b%3]*2,.065)
    if b%4 == 0:
        for freq in chord:
            tone(start,1.8,freq,.035)
    for i in range(int(.18*RATE)):
        t = i/RATE
        samples[int(start*RATE)+i] += .26*math.sin(2*math.pi*(48*t+5*(1-math.exp(-t*35))))*math.exp(-t*24)
    for off in (0,.25):
        for i in range(int(.04*RATE)):
            samples[int((start+off)*RATE)+i] += random.uniform(-1,1)*.035*math.exp(-i/RATE*110)
    if b%2:
        for i in range(int(.12*RATE)):
            samples[int(start*RATE)+i] += random.uniform(-1,1)*.08*math.exp(-i/RATE*32)
for start in (7,13,19,29,38,45,51):
    tone(start,.7,880,.065)
    tone(start+.12,.7,1318.51,.05)
peak = max(abs(s) for s in samples)
output = array.array('h',(int(value/peak*.8*min(1,i/RATE/.5,(SECONDS-i/RATE)/1.5)*32767) for i,value in enumerate(samples)))
path = Path(__file__).resolve().parents[1]/'public/music/estured-original.wav'
with wave.open(str(path),'wb') as audio:
    audio.setnchannels(1)
    audio.setsampwidth(2)
    audio.setframerate(RATE)
    audio.writeframes(output.tobytes())
print(json.dumps({'path':str(path),'seconds':SECONDS,'bpm':120,'original':True}))
