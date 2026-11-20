"""Synthesize soft original UI sound effects (tap, tilde, whoosh, pop) as 44.1 kHz stereo WAV. CLI: python3 scripts/make-ig-sfx.py. Requires numpy; emits JSON."""
import json
import wave
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/ig/sfx'
SR=44100
PEAK=10**(-12/20)*0.97  # about -12.3 dBFS
rng=np.random.default_rng(7)

def tt(d):return np.arange(round(d*SR))/SR
def fade_end(x,ms=15):
    n=min(len(x),round(ms/1000*SR));x[-n:]*=np.linspace(1,0,n);return x
def tone(f,d,decay,attack=.003,harm=.12):
    t=tt(d)
    s=(np.sin(2*np.pi*f*t)+harm*np.sin(4*np.pi*f*t))*np.minimum(1,t/attack)*np.exp(-t*decay)
    return s
def lowpass(x,k):
    return np.convolve(x,np.ones(k)/k,mode='same')
def save(name,mono,pan_wide=None):
    mono=fade_end(mono.copy())
    if pan_wide is None:
        st=np.stack([mono,mono],1)
    else:
        st=pan_wide
        st[-round(.015*SR):]*=np.linspace(1,0,round(.015*SR))[:,None]
    st=st/np.max(np.abs(st))*PEAK
    with wave.open(str(OUT/name),'wb') as w:
        w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR)
        w.writeframes((st*32767).astype('<i2').tobytes())
    return {name:{'seconds':round(len(st)/SR,3),'peak_dbfs':round(20*np.log10(np.max(np.abs(st))),2)}}

info={}
# tap: short soft low thump with tiny click
t=tt(.12)
tap=np.sin(2*np.pi*(190+90*np.exp(-t*60))*t)*np.exp(-t*38)+.05*rng.normal(0,1,len(t))*np.exp(-t*220)
info.update(save('tap.wav',tap))
# tilde: two rising soft notes (E5 -> B5)
x=np.zeros(round(.35*SR))
a=tone(659.26,.25,11);b=tone(987.77,.25,11)
x[:len(a)]+=a*.8;o=round(.1*SR);x[o:o+len(b)]+=b
info.update(save('tilde.wav',x))
# whoosh: filtered noise sweeping left to right
n=round(.3*SR);t=np.arange(n)/SR
noise=rng.normal(0,1,n)
soft=lowpass(noise,14)-lowpass(noise,90)*.9
env=np.sin(np.pi*np.clip(t/.3,0,1))**2
sig=soft*env
pan=np.linspace(-.8,.8,n)
st=np.stack([sig*np.sqrt((1-pan)/2),sig*np.sqrt((1+pan)/2)],1)
info.update(save('whoosh.wav',sig,st))
# pop: quick rising sine blip
t=tt(.1)
pop=np.sin(2*np.pi*(380+520*(1-np.exp(-t*45)))*t)*np.minimum(1,t/.004)*np.exp(-t*34)
info.update(save('pop.wav',pop))
print(json.dumps(info))
