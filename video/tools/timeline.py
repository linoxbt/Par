"""Builds the scene timeline from the voiceover lengths (single source of truth for picture and sound)."""
import json
FPS = 30
d = json.load(open("vo-durations.json"))
# (scene id, vo id or None, lead-in before VO, fixed length if no VO, tail after VO)
plan = [
    ("hook",     "s01_hook",    1.0, None, 0.9),
    ("idle",     "s02_idle",    0.3, None, 0.8),
    ("logo",     "s03_intro",   1.6, None, 1.3),
    ("insight",  "s04_insight", 0.4, None, 1.2),
    ("vault",    "s05_vault",   0.4, None, 1.1),
    ("builder",  "s06_builder", 0.3, None, 1.2),
    ("cert",     "s07_cert",    0.4, None, 1.0),
    ("miss",     "s08_miss",    0.3, None, 1.4),
    ("circuit",  "s09_circuit", 0.4, None, 0.4),
    ("clear",    "s10_clear",   0.3, None, 1.5),
    ("tech",     "s11_tech",    0.4, None, 1.3),
    ("next",     "s12_next",    0.3, None, 1.0),
    ("montage",  None,          0.0, 6.0,  0.0),
    ("outro",    "s13_outro",   0.6, None, 5.5),
]
t = 0.0
scenes = []
for sid, vo, lead, fixed, tail in plan:
    length = fixed if vo is None else lead + d[vo] + tail
    scenes.append({"id": sid, "vo": vo, "start": round(t, 3), "voStart": round(t + lead, 3) if vo else None,
                   "voDur": d.get(vo) if vo else None, "dur": round(length, 3),
                   "from": round(t * FPS), "frames": round(length * FPS)})
    t += length
tl = {"fps": FPS, "total": round(t, 3), "frames": round(t * FPS), "scenes": scenes}
json.dump(tl, open("src/timeline.json", "w"), indent=1)
print("total", tl["total"], "s,", tl["frames"], "frames")
for s in scenes: print(f'{s["id"]:9s} {s["start"]:7.2f} +{s["dur"]:6.2f}  vo@{s["voStart"]}')
