import json, os, soundfile as sf, numpy as np
from kokoro_onnx import Kokoro
k = Kokoro(os.environ.get("KOKORO_MODEL", "kokoro-v1.0.onnx"), os.environ.get("KOKORO_VOICES", "voices-v1.0.bin"))
segs = json.load(open("/home/user/Par/video/script.json"))
out = {}
for s in segs:
    audio, sr = k.create(s["text"], voice="af_heart", speed=0.97, lang="en-us")
    # trim leading/trailing silence, add 60 ms pad
    a = np.asarray(audio, dtype=np.float32)
    idx = np.where(np.abs(a) > 0.01)[0]
    a = a[max(0, idx[0] - 1200): idx[-1] + 2400]
    sf.write(f"/home/user/Par/video/public/vo/{s['id']}.wav", a, sr)
    out[s["id"]] = round(len(a) / sr, 3)
    print(s["id"], out[s["id"]])
json.dump(out, open("/home/user/Par/video/vo-durations.json", "w"), indent=1)
print("total", round(sum(out.values()), 1))
