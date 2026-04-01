# Training a Custom "Hey Circuit" Wake Word

openWakeWord supports training custom wake words from ~30 positive samples.
This takes about 20 minutes total.

## Step 1 — Record positive samples

Record yourself (and ideally a few other voices) saying "Hey Circuit" clearly.
You need at least 30 samples, 50+ is better.

```bash
# Quick recording script — run this 30+ times
python -c "
import sounddevice as sd
import soundfile as sf
import numpy as np
import sys

idx = sys.argv[1] if len(sys.argv) > 1 else '0'
print('Say Hey Circuit in 3..2..1')
import time; time.sleep(2)
print('Recording...')
audio = sd.rec(int(1.5 * 16000), samplerate=16000, channels=1, dtype='int16')
sd.wait()
sf.write(f'wake_word/positive/hey_circuit_{idx}.wav', audio, 16000)
print('Done.')
"
```

Save them all to: `backend/wake_word/positive/`

## Step 2 — Generate negative samples (automatic)

openWakeWord uses its own background noise corpus for negatives.
No manual work needed.

## Step 3 — Train

```bash
pip install openwakeword[train]

python -m openwakeword.train \
    --positive_samples wake_word/positive/ \
    --output_path wake_word/ \
    --model_name hey_circuit \
    --epochs 100
```

This produces: `wake_word/hey_circuit.tflite`

## Step 4 — Test

```bash
python -c "
import pyaudio, numpy as np
from openwakeword.model import Model

oww = Model(wakeword_models=['wake_word/hey_circuit.tflite'], inference_framework='tflite')
pa = pyaudio.PyAudio()
stream = pa.open(format=pyaudio.paInt16, channels=1, rate=16000, input=True, frames_per_buffer=1280)

print('Say Hey Circuit...')
while True:
    raw = stream.read(1280)
    chunk = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    pred = oww.predict(chunk)
    for name, conf in pred.items():
        if conf > 0.5:
            print(f'Detected! {name}: {conf:.3f}')
"
```

## Fallback

If the custom model isn't ready, the pipeline automatically falls back to
detecting 'hey_jarvis' as a placeholder. Set WAKE_WORD_THRESHOLD lower
(e.g. 0.3) if detection is too sensitive.
