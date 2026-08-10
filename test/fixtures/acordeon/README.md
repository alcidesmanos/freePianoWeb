# Fixtures de acordeón real

Ventanas de 4096 muestras (float32 LE, 48kHz mono, tomadas a los 0.5s del ataque)
de un acordeón sampleado real — soundfont MusyngKite, servido por el proyecto
midi-js-soundfonts de gleitz (GitHub Pages).

Regenerar:
```bash
BASE="https://gleitz.github.io/midi-js-soundfonts/MusyngKite/accordion-mp3"
for n in C3 E3 G3 C4 E4 G4 A4 C5 E5 G5 C6; do
  curl -s "$BASE/$n.mp3" -o /tmp/$n.mp3
  ffmpeg -y -loglevel error -i /tmp/$n.mp3 -f f32le -ac 1 -ar 48000 /tmp/$n.f32
  python3 -c "
import sys
raw=open('/tmp/$n.f32','rb').read()
open('$n.f32','wb').write(raw[4*24000:4*(24000+4096)])"
done
```
