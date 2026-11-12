"""Synthesize an original stereo electro-pop score and scene transitions. CLI: python3 scripts/make-launch-music.py. Requires numpy; emits JSON."""
import json
import wave
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
story=json.loads((ROOT/'src/launch/story.json').read_text())
SR=44100
DURATION=story['durationInFrames']/30
N=round(DURATION*SR)
mix=np.zeros((N,2),dtype=np.float64)
rng=np.random.default_rng(42)
beat=60/128

def add(signal,start,pan=0,level=1):
    offset=round(start*SR)
    if offset>=N:return
    signal=signal[:N-offset]*level
    mix[offset:offset+len(signal),0]+=signal*np.sqrt((1-pan)/2)
    mix[offset:offset+len(signal),1]+=signal*np.sqrt((1+pan)/2)

def synth(freq,duration,kind='pluck'):
    t=np.arange(round(duration*SR))/SR
    attack=np.minimum(1,t/.01)
    if kind=='bass':
        signal=(np.sin(2*np.pi*freq*t)+.2*np.sin(4*np.pi*freq*t)) *attack*np.exp(-t*5)
    elif kind=='pad':
        signal=(np.sin(2*np.pi*freq*t)+.25*np.sin(2*np.pi*freq*1.002*t)) *np.minimum(1,t/.25)*np.minimum(1,(duration-t)/.35)
    else:
        signal=(np.sin(2*np.pi*freq*t)+.16*np.sin(4*np.pi*freq*t)+.07*np.sin(6*np.pi*freq*t))*attack*np.exp(-t*7)
    return signal

# A minor / F / C / G. No samples or third-party recordings.
chords=[(220,261.626,329.628),(174.614,220,261.626),(130.813,164.814,196),(196,246.942,293.665)]
for b in range(int(DURATION/beat)+1):
    start=b*beat
    chord=chords[(b//8)%4]
    energy=.62 if start<story['scenes'][2]['from']/30 else 1
    t=np.arange(round(.25*SR))/SR
    phase=2*np.pi*(48*t+1.8*(1-np.exp(-t*42)))
    kick=np.sin(phase)*np.exp(-t*21)+rng.normal(0,.025,len(t))*np.exp(-t*160)
    add(kick,start,level=.46*energy)
    if b%2:
        t=np.arange(round(.16*SR))/SR
        clap=(rng.normal(0,1,len(t))*.7+np.sin(2*np.pi*180*t)*.1)*np.exp(-t*32)
        add(clap,start,pan=.06,level=.10*energy)
    for eighth in (0,.5):
        t=np.arange(round(.06*SR))/SR
        noise=rng.normal(0,1,len(t))
        noise=np.concatenate(([0],np.diff(noise)))
        add(noise*np.exp(-t*90),start+eighth*beat,pan=(-.4 if eighth else .4),level=.018*energy)
    add(synth(chord[0]/2,beat*.75,'bass'),start+.5*beat,level=.24*energy)
    if b%4==0:
        for k,freq in enumerate(chord):
            add(synth(freq,beat*3.8,'pad'),start,pan=(k-1)*.6,level=.043)
    if start>15:
        for step in (0,.5):
            note=chord[(b+int(step*2))%3]*(2 if b%4<2 else 4)
            signal=synth(note,.62)
            add(signal,start+step*beat,pan=np.sin(b)*.55,level=.065)
            add(signal,start+step*beat+beat*.75,pan=-np.sin(b)*.55,level=.022)
    if b%16==15:
        for j in range(4):
            add(synth(170-j*20,.15,'bass'),start+j*beat/4,pan=(j-1.5)*.3,level=.12)
for scene in story['scenes'][1:]:
    end=scene['from']/30
    start=max(0,end-.45)
    t=np.arange(round(.6*SR))/SR
    noise=rng.normal(0,1,len(t))
    smooth=np.convolve(noise,np.ones(25)/25,mode='same')
    env=np.where(t<.45,(t/.45)**2,np.exp(-(t-.45)*25))
    add(smooth*env,start,level=.22)
    add(synth(880,.4),end,pan=-.25,level=.055)
    add(synth(1318.51,.55),end+.08,pan=.25,level=.035)
# Soft mastering and global fades; narration is mixed separately in Remotion.
t=np.arange(N)/SR
fade=np.minimum(1,t/.6)*np.minimum(1,(DURATION-t)/2)
mix=np.tanh(mix*1.5)*fade[:,None]
peak=np.max(np.abs(mix))
encoded=(mix/max(peak,.01)*.82*32767).astype('<i2')
output=ROOT/'public/launch/launch-music.wav'
with wave.open(str(output),'wb') as wav:
    wav.setnchannels(2);wav.setsampwidth(2);wav.setframerate(SR);wav.writeframes(encoded.tobytes())
print(json.dumps({'path':str(output),'seconds':DURATION,'bpm':128,'original':True,'peak':float(peak)}))
