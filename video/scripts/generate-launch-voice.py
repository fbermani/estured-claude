"""Generate Argentine narration, word-timed captions and scene timing. CLI: python3 scripts/generate-launch-voice.py; needs edge-tts. JSON output."""
import asyncio
import json
import math
import re
import subprocess
from pathlib import Path
import edge_tts

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/launch'
SCRIPT = [
 ('El problema', 'Te vas a estudiar a Buenos Aires. Pero... ¿reservar tu próxima casa solo con fotos de Instagram y mensajes de WhatsApp?'),
 ('La distancia', 'Y viajar antes para conocer todas las residencias... no siempre es una opción.'),
 ('EstuRed verifica', 'Por eso existe EstuRed. Residencias verificadas presencialmente: ya fuimos por vos.'),
 ('Buscar en familia', 'Buscá y compará ubicación, servicios, reglas y precios. Desde tu casa, con tu familia. Vos elegís.'),
 ('Reserva registrada', 'Enviá tu solicitud y seguí cada paso desde tu panel. Cuando confirmás tu reserva, tenés un comprobante verificable. Todo queda registrado.'),
 ('Comunidad', 'Y antes de llegar, descubrí la comunidad de cada residencia. Porque la convivencia también se elige.'),
 ('Soporte', '¿Necesitás ayuda? Contás con Soporte para acompañarte durante el proceso.'),
 ('Tu próxima etapa', 'Tu próxima etapa empieza acá. Sumate a EstuRed y completá tu perfil.'),
]
async def main():
 OUT.mkdir(exist_ok=True, parents=True)
 scenes=[]
 clock=0
 for idx,(name,text) in enumerate(SCRIPT):
  path=OUT/f'voice-{idx+1:02d}.mp3'
  words=[]
  talk=edge_tts.Communicate(text, 'es-AR-ElenaNeural', rate='+8%', pitch='+1Hz', boundary='WordBoundary')
  temporary=path.with_suffix('.tmp')
  with temporary.open('wb') as stream:
   async for chunk in talk.stream():
    if chunk['type']=='audio':stream.write(chunk['data'])
    elif chunk['type']=='WordBoundary':words.append({'text':chunk['text'],'start':chunk['offset']/1e7,'end':(chunk['offset']+chunk['duration'])/1e7})
  temporary.replace(path)
  tokens=text.split()
  if len(tokens)==len(words):
   for token,word in zip(tokens,words):word['text']=token
  (OUT/f'words-{idx+1:02d}.json').write_text(json.dumps(words,ensure_ascii=False))
  info=subprocess.check_output(['afinfo',str(path)],text=True)
  duration=float(re.search(r'estimated duration:\s*([\d.]+)',info).group(1))
  # Scene ends on a musical bar at 128 BPM, with breathing room after narration.
  seconds=math.ceil((duration+.85)/1.875)*1.875
  frames=round(seconds*30)
  cues=[]; group=[]
  for word in words:
   if group and (len(group)>=7 or len(' '.join(x['text'] for x in group))+len(word['text'])>48 or group[-1]['text'].endswith(('.', '?', '!', '…'))):
    cues.append({'text':' '.join(x['text'] for x in group),'start':group[0]['start']+.35,'end':word['start']+.35})
    group=[]
   group.append(word)
  if group:cues.append({'text':' '.join(x['text'] for x in group),'start':group[0]['start']+.35,'end':group[-1]['end']+.65})
  scenes.append({'name':name,'text':text,'audio':f'launch/{path.name}','audioSeconds':duration,'from':clock,'frames':frames,'captions':cues})
  clock+=frames
  print(json.dumps({'scene':idx+1,'seconds':duration,'frames':frames}),flush=True)
 data={'fps':30,'bpm':128,'durationInFrames':clock,'scenes':scenes}
 (ROOT/'src/launch/story.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 # Portable subtitle file covers the exact same narration as the burned-in captions.
 def timestamp(sec):
  ms=round(sec*1000);return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}'
 lines=[]; count=0
 for scene in scenes:
  for cue in scene['captions']:
   count+=1
   lines.append(f"{count}\n{timestamp(scene['from']/30+cue['start'])} --> {timestamp(scene['from']/30+cue['end'])}\n{cue['text']}\n")
 (OUT/'estured.srt').write_text('\n'.join(lines))
 print(json.dumps({'durationInFrames':clock,'seconds':clock/30,'voice':'es-AR-ElenaNeural'}))
asyncio.run(main())
