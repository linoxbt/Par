"""
Par demo soundtrack: original score + designed SFX + Kokoro voiceover, mixed and mastered.
Everything is synthesized here (no third-party samples), so the soundtrack is license-free.

  python tools/audio.py   ->  public/audio/soundtrack.wav  (48 kHz stereo)
"""
import json, os
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve, resample_poly

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, "src/timeline.json")))
CUES = json.load(open(os.path.join(ROOT, "src/cues.json")))
TOTAL = TL["total"]
N = int(TOTAL * SR) + SR
rng = np.random.default_rng(7)
SC = {s["id"]: s for s in TL["scenes"]}


def T(scene, cue=None, off=0.0):
    s = SC[scene]
    return s["start"] + (CUES[scene][cue] if cue else 0.0) + off


# ------------------------------------------------------------------ dsp helpers
def lp(x, f, order=2):
    return sosfilt(butter(order, min(f, SR / 2 - 100) / (SR / 2), "low", output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f / (SR / 2), "high", output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], "band", output="sos"), x)


def env_adsr(n, a=0.01, d=0.1, s=0.7, r=0.2):
    t = np.arange(n) / SR
    dur = n / SR
    e = np.ones(n) * s
    e[t < a] = t[t < a] / max(a, 1e-4)
    m = (t >= a) & (t < a + d)
    e[m] = 1 - (1 - s) * (t[m] - a) / max(d, 1e-4)
    rel = t > dur - r
    e[rel] *= np.clip((dur - t[rel]) / max(r, 1e-4), 0, 1)
    return e


def exp_env(n, tau):
    return np.exp(-np.arange(n) / SR / tau)


def make_ir(seconds=2.6, tone=6000, predelay=0.012):
    n = int(seconds * SR)
    ir = rng.standard_normal((n, 2)) * np.exp(-np.arange(n) / SR / (seconds / 6.0))[:, None]
    ir[:, 0] = lp(ir[:, 0], tone)
    ir[:, 1] = lp(ir[:, 1], tone * 0.92)
    pad = np.zeros((int(predelay * SR), 2))
    ir = np.vstack([pad, ir])
    return ir / np.sqrt((ir ** 2).sum(axis=0, keepdims=True))


IR_HALL = make_ir(3.2, 5200)
IR_ROOM = make_ir(1.1, 7500)


def reverb(stereo, ir, wet):
    out = np.zeros((len(stereo) + len(ir) - 1, 2))
    for c in range(2):
        out[:, c] = fftconvolve(stereo[:, c], ir[:, c])
    out = out[: len(stereo)]
    return stereo * (1 - wet) + out * wet


def st(mono, pan=0.0):
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    return np.stack([mono * l, mono * r], axis=1)


def place(bus, sig, t, gain=1.0):
    i = int(t * SR)
    if i >= len(bus):
        return
    if sig.ndim == 1:
        sig = st(sig)
    j = min(len(bus), i + len(sig))
    bus[i:j] += sig[: j - i] * gain


def note_hz(n):  # midi
    return 440.0 * 2 ** ((n - 69) / 12)


# ------------------------------------------------------------------ instruments
def saw(f, n, detune=0.0):
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k, dt in enumerate([-detune, 0, detune]):
        ph = (f * (1 + dt) * t + rng.random()) % 1.0
        out += 2 * ph - 1
    return out / 3


def pad_chord(notes, dur, bright=1800):
    n = int(dur * SR)
    sig = np.zeros(n)
    for m in notes:
        sig += saw(note_hz(m), n, 0.004) * 0.5 + np.sin(2 * np.pi * note_hz(m) * np.arange(n) / SR) * 0.5
    sig = lp(sig, bright, 2) * env_adsr(n, a=min(1.6, dur * 0.35), d=0.5, s=0.85, r=min(1.8, dur * 0.4))
    return sig / max(1, len(notes))


def epiano(m, dur, vel=0.8):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = note_hz(m)
    mod = np.sin(2 * np.pi * f * 2.0 * t) * (2.2 * np.exp(-t / 0.35))
    car = np.sin(2 * np.pi * f * t + mod)
    tine = np.sin(2 * np.pi * f * 4.0 * t) * 0.12 * np.exp(-t / 0.08)
    return (car + tine) * exp_env(n, 0.9) * env_adsr(n, 0.004, 0.05, 1, 0.08) * vel


def pluck(m, dur, vel=0.7, bright=5000):
    n = int(dur * SR)
    s = saw(note_hz(m), n, 0.002)
    cutoff_env = lp(s, bright) * exp_env(n, 0.18)
    return cutoff_env * env_adsr(n, 0.002, 0.05, 1, 0.05) * vel


def sub(m, dur, vel=0.9):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = note_hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)
    return s * env_adsr(n, 0.01, 0.1, 0.8, 0.12) * vel


def kick(vel=1.0):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 46 + 110 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.22)
    click = hp(rng.standard_normal(n), 3000) * np.exp(-t / 0.004) * 0.25
    return np.tanh((body + click) * 1.6) * vel


def hat(vel=0.3, open_=False):
    n = int((0.25 if open_ else 0.06) * SR)
    s = hp(rng.standard_normal(n), 7500, 4) * exp_env(n, 0.09 if open_ else 0.018)
    return s * vel


def clap(vel=0.5):
    n = int(0.3 * SR)
    s = bp(rng.standard_normal(n), 900, 4200)
    e = np.zeros(n)
    for k, d in enumerate([0, 0.011, 0.022]):
        i = int(d * SR)
        e[i:] += np.exp(-np.arange(n - i) / SR / (0.012 if k < 2 else 0.11))
    return s * e * vel * 0.6


# ------------------------------------------------------------------ SFX (designed)
def sfx_whoosh(dur=0.9, up=True, gain=0.6, bright=1.0):
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    centers = np.linspace(400, 5200 * bright, 24) if up else np.linspace(5200 * bright, 400, 24)
    seg = n // len(centers)
    for i, c in enumerate(centers):
        a, b = i * seg, min(n, (i + 2) * seg)
        chunk = bp(noise[a:b], c * 0.6, c * 1.4)
        out[a:b] += chunk * np.hanning(b - a)
    shape = np.sin(np.pi * t) ** 1.6
    return st(out * shape * gain, 0) + st(out * shape * gain * 0.5, (-0.6 if up else 0.6))


def sfx_riser(dur=2.2, gain=0.5):
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    steps = 32
    seg = n // steps
    for i in range(steps):
        c = 300 + (8000 - 300) * (i / steps) ** 1.6
        a, b = i * seg, min(n, (i + 2) * seg)
        out[a:b] += bp(noise[a:b], c * 0.7, c * 1.3) * np.hanning(b - a)
    f = 110 * 2 ** (t * 2.0)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.35
    shape = t ** 2.2
    return st((out + tone) * shape * gain)


def sfx_impact(gain=1.0, size=1.0):
    n = int(2.6 * SR)
    t = np.arange(n) / SR
    f = 32 + 80 * np.exp(-t / 0.08)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.55 * size))
    crack = lp(rng.standard_normal(n), 4500) * np.exp(-t / 0.05) * 0.6
    tail = lp(rng.standard_normal(n), 1800) * np.exp(-t / 0.7) * 0.12
    s = np.tanh((boom * 1.4 + crack + tail) * 1.2)
    return reverb(st(s), IR_HALL, 0.25) * gain


def sfx_click(gain=0.5):
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    s = (np.sin(2 * np.pi * 2400 * t) * np.exp(-t / 0.004) + hp(rng.standard_normal(n), 2000) * np.exp(-t / 0.002) * 0.6)
    s2 = np.concatenate([np.zeros(int(0.045 * SR)), np.sin(2 * np.pi * 1800 * t) * np.exp(-t / 0.003) * 0.6])
    out = np.zeros(len(s2)); out[: len(s)] += s; out += s2
    return reverb(st(out * gain), IR_ROOM, 0.12)


def sfx_pop(gain=0.45, pitch=880):
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    f = pitch * (1 + 0.6 * np.exp(-t / 0.01))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.05)
    return reverb(st(s * gain), IR_ROOM, 0.2)


def sfx_tick(gain=0.25):
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    s = bp(rng.standard_normal(n), 2500, 9000) * np.exp(-t / 0.004)
    return st(s * gain, rng.uniform(-0.3, 0.3))


def sfx_chime(notes=(84, 88, 91), gain=0.35, spread=0.07):
    out = np.zeros(int(2.5 * SR))
    for k, m in enumerate(notes):
        n = len(out) - int(k * spread * SR)
        t = np.arange(n) / SR
        f = note_hz(m)
        bell = (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.3)
                + 0.2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / 0.12)) * np.exp(-t / 0.9)
        out[int(k * spread * SR):] += bell
    return reverb(st(out * gain / len(notes)), IR_HALL, 0.35)


def sfx_coin(gain=0.35):
    a = sfx_chime((88, 95), gain, 0.06)
    return a


def sfx_alert(gain=0.35):
    out = np.zeros(int(0.6 * SR))
    for k, m in enumerate([81, 76]):
        n = int(0.16 * SR)
        t = np.arange(n) / SR
        s = np.sign(np.sin(2 * np.pi * note_hz(m) * t)) * 0.3 + np.sin(2 * np.pi * note_hz(m) * t)
        s = lp(s, 3000) * env_adsr(n, 0.005, 0.03, 0.7, 0.05)
        i = int(k * 0.18 * SR)
        out[i:i + n] += s
    return reverb(st(out * gain), IR_ROOM, 0.15)


def sfx_crack(gain=0.6):
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for k in range(9):
        i = int(rng.uniform(0, 0.12) * SR)
        m = n - i
        s[i:] += hp(rng.standard_normal(m), rng.uniform(1500, 4000)) * np.exp(-np.arange(m) / SR / rng.uniform(0.01, 0.05)) * rng.uniform(0.3, 1)
    low = np.sin(2 * np.pi * 60 * t) * np.exp(-t / 0.2) * 0.6
    return reverb(st((s * 0.5 + low) * gain), IR_HALL, 0.3)


def sfx_swell(dur=2.0, gain=0.3, m=62):
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    s = pad_chord([m, m + 7, m + 12, m + 16], dur, 2500) * (t ** 1.5)
    return reverb(st(s * gain), IR_HALL, 0.4)


def sfx_thud(gain=0.6):
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    f = 55 + 60 * np.exp(-t / 0.03)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.15)
    return st(np.tanh(s * 1.5) * gain)


def sfx_sparkle(gain=0.25):
    out = np.zeros(int(2.0 * SR))
    for k in range(10):
        m = rng.choice([84, 86, 88, 91, 93, 96, 98])
        i = int(k * 0.06 * SR)
        n = len(out) - i
        t = np.arange(n) / SR
        out[i:] += np.sin(2 * np.pi * note_hz(m) * t) * np.exp(-t / 0.25) * rng.uniform(0.4, 1)
    return reverb(st(out * gain / 4), IR_HALL, 0.5)


def sfx_typing(dur, gain=0.18, rate=13):
    out = np.zeros((int((dur + 0.1) * SR), 2))
    t = 0.0
    while t < dur:
        place(out, sfx_tick(gain * rng.uniform(0.6, 1.1)), t)
        t += rng.uniform(0.6, 1.4) / rate
    return out


# ------------------------------------------------------------------ score
BPM = 96
BEAT = 60 / BPM
BAR = BEAT * 4
# D minor -> Bb -> F -> C  (warm, hopeful); voicings in midi
PROG = [
    ([50, 57, 62, 65, 69], 38),   # Dm9-ish (bass D2)
    ([46, 53, 58, 62, 65], 34),   # Bbmaj7 (bass Bb1)
    ([53, 57, 60, 64, 67], 41),   # Fmaj7  (bass F2)
    ([48, 55, 60, 64, 67], 36),   # C      (bass C2)
]


def build_music():
    mus = np.zeros((N, 2))
    pads = np.zeros((N, 2))
    drums = np.zeros((N, 2))
    keys = np.zeros((N, 2))
    bass = np.zeros((N, 2))
    arps = np.zeros((N, 2))

    logo_hit = T("logo", "join")
    groove_on = T("insight")
    circuit_on = T("circuit")
    clear_drop = T("clear", "netted")
    tech_on = T("tech")
    build_on = T("next")
    outro_hit = T("outro", "join")
    end = TOTAL

    # ---- pads, 2 bars per chord across the whole piece
    t = 0.0
    k = 0
    while t < end:
        notes, root = PROG[k % 4]
        dur = BAR * 2
        bright = 1100 if t < logo_hit else (1700 if t < tech_on else 2400)
        g = 0.55 if t < logo_hit else 0.42
        place(pads, st(pad_chord(notes, dur + 1.2, bright), (-0.3 if k % 2 else 0.3)) , t, g)
        t += dur
        k += 1

    # ---- logo bloom: a sustained, bright chord under the impact, then a light pulse into the groove
    place(pads, st(pad_chord([53, 60, 65, 69, 72, 76], 9.0, 3200)), logo_hit - 0.05, 0.55)
    t = logo_hit + 1.6
    while t < groove_on:
        place(bass, st(sub(41, BEAT * 0.5, 0.45)), t)
        place(drums, st(hat(0.06), 0.3), t + BEAT / 2)
        t += BEAT

    # ---- intro pulse (hook/idle): muted sub heartbeat + clock ticks
    t = 0.6
    while t < logo_hit - 1.5:
        place(bass, st(sub(38, BEAT * 0.45, 0.55)), t)
        place(drums, st(hat(0.07)), t + BEAT / 2)
        t += BEAT

    # ---- groove: kick/hat/clap + bass + epiano + arps
    def section(t0, t1, density):
        t = t0
        bar_i = 0
        while t < t1:
            chord_idx = int((t - 0) // (BAR * 2)) % 4
            notes, root = PROG[chord_idx]
            for b in range(4):
                bt = t + b * BEAT
                if bt >= t1:
                    break
                if density >= 1:
                    place(drums, st(kick(0.85)), bt)
                    if b in (1, 3):
                        place(drums, st(clap(0.42), 0.05), bt)
                for s in range(2):
                    ht = bt + s * BEAT / 2 + (0.018 if s else 0)
                    place(drums, st(hat(0.11 if s else 0.07), 0.35), ht)
                if density >= 2:
                    place(drums, st(hat(0.05), -0.35), bt + BEAT * 0.75)
                # bass: root on 1 and the "and" of 2
                if b in (0, 2):
                    place(bass, st(sub(root, BEAT * 0.9, 0.6)), bt)
                if b == 1 and density >= 2:
                    place(bass, st(sub(root + 12, BEAT * 0.4, 0.35)), bt + BEAT / 2)
            # epiano comp on beat 1 and the "and" of 3
            if density >= 1:
                for (off, vel) in ((0, 0.5), (BEAT * 2.5, 0.35)):
                    for m in notes[1:]:
                        place(keys, st(epiano(m + 12, BEAT * 1.6, vel)), t + off + rng.uniform(0, 0.012))
            # 16th arp in busy sections
            if density >= 2:
                pattern = [0, 2, 3, 4, 3, 2, 4, 1]
                for i in range(16):
                    at = t + i * BEAT / 4
                    if at >= t1:
                        break
                    m = notes[1:][pattern[i % 8] % 4] + 24
                    place(arps, st(pluck(m, BEAT / 3, 0.22 if i % 4 else 0.3), (-0.5 if i % 2 else 0.5)), at)
            t += BAR
            bar_i += 1

    section(groove_on, circuit_on, 1)
    section(circuit_on, clear_drop - 2.2, 2)
    section(clear_drop, build_on, 2)
    section(build_on, outro_hit - 1.6, 2)

    # ---- outro: final chord ring
    place(pads, st(pad_chord([50, 57, 62, 65, 69, 74], 9.0, 2600)), outro_hit, 0.6)
    for m in [62, 65, 69, 74]:
        place(keys, st(epiano(m + 12, 6.0, 0.4)), outro_hit + 0.05)

    # sidechain-ish pump on pads from kicks
    pump = np.ones(N)
    t = groove_on
    while t < outro_hit - 1.6:
        i = int(t * SR)
        L = int(0.32 * SR)
        if i + L < N:
            pump[i:i + L] = np.minimum(pump[i:i + L], 0.55 + 0.45 * (np.arange(L) / L) ** 0.7)
        t += BEAT
    pads *= pump[:, None]

    keys = reverb(keys, IR_HALL, 0.28)
    arps = reverb(arps, IR_HALL, 0.32)
    pads = reverb(pads, IR_HALL, 0.35)
    mus = pads * 0.9 + drums * 0.75 + keys * 0.55 + bass * 0.8 + arps * 0.5
    mus[:, 0] = hp(mus[:, 0], 30)
    mus[:, 1] = hp(mus[:, 1], 30)
    # fade in/out
    fi = int(1.5 * SR)
    mus[:fi] *= np.linspace(0, 1, fi)[:, None]
    fo_start = int((end - 4.0) * SR)
    mus[fo_start:] *= np.linspace(1, 0, N - fo_start)[:, None] ** 1.5
    return mus


def build_sfx():
    fx = np.zeros((N, 2))
    # transitions: whoosh at every scene boundary (except the very first)
    for s in TL["scenes"][1:]:
        place(fx, sfx_whoosh(0.8, up=True, gain=0.22), s["start"] - 0.45)
    # hook
    for c in ("line1", "line2", "line3"):
        place(fx, sfx_pop(0.35, 660), T("hook", c))
        place(fx, sfx_typing(1.4, 0.12), T("hook", c, 0.1))
    place(fx, sfx_crack(0.55), T("hook", "break"))
    # idle
    place(fx, sfx_whoosh(1.2, up=False, gain=0.35), T("idle", "freeze"))
    place(fx, sfx_swell(2.2, 0.22, 62), T("idle", "btc") - 0.4)
    # logo: riser into impact
    place(fx, sfx_riser(2.4, 0.42), T("logo", "join") - 2.4)
    place(fx, sfx_impact(0.95), T("logo", "join"))
    place(fx, sfx_sparkle(0.22), T("logo", "word"))
    place(fx, sfx_pop(0.25, 990), T("logo", "tag"))
    place(fx, sfx_pop(0.22, 1180), T("logo", "mezo"))
    # insight
    place(fx, sfx_swell(1.8, 0.18, 57), T("insight", "bar") - 0.3)
    place(fx, sfx_pop(0.32, 880), T("insight", "undrawn"))
    place(fx, sfx_whoosh(0.7, True, 0.28), T("insight", "promises") - 0.2)
    place(fx, sfx_chime((79, 84, 88), 0.3), T("insight", "zero"))
    # vault
    place(fx, sfx_click(0.5), T("vault", "create"))
    place(fx, sfx_whoosh(0.6, True, 0.22), T("vault", "trove") - 0.25)
    place(fx, sfx_click(0.5), T("vault", "open"))
    place(fx, sfx_chime((81, 86, 89), 0.25), T("vault", "dash"))
    place(fx, sfx_pop(0.3, 760), T("vault", "buffer"))
    # builder
    place(fx, sfx_typing(1.6, 0.15), T("builder", "typeA"))
    place(fx, sfx_typing(1.4, 0.15), T("builder", "typeB"))
    place(fx, sfx_riser(1.6, 0.3), T("builder", "stress") - 0.2)
    place(fx, sfx_thud(0.55), T("builder", "crash"))
    place(fx, sfx_chime((79, 83, 86, 91), 0.38, 0.09), T("builder", "fits"))
    place(fx, sfx_click(0.5), T("builder", "make"))
    place(fx, sfx_sparkle(0.2), T("builder", "done"))
    # certificate
    place(fx, sfx_whoosh(0.9, True, 0.35), T("cert", "phone") - 0.3)
    place(fx, sfx_pop(0.3, 700), T("cert", "cover"))
    place(fx, sfx_pop(0.3, 820), T("cert", "drop"))
    place(fx, sfx_chime((88, 91), 0.28, 0.08), T("cert", "share"))
    # missed payment
    place(fx, sfx_alert(0.35), T("miss", "missed"))
    place(fx, sfx_click(0.55), T("miss", "click"))
    place(fx, sfx_coin(0.4), T("miss", "paid"))
    place(fx, sfx_whoosh(0.6, False, 0.25), T("miss", "buffer") - 0.2)
    place(fx, sfx_whoosh(0.6, True, 0.25), T("miss", "mint") - 0.2)
    place(fx, sfx_pop(0.28, 940), T("miss", "keeper"))
    # circuit
    for i, c in enumerate(("inv1", "inv2", "inv3")):
        place(fx, sfx_pop(0.3, 660 + i * 120), T("circuit", c))
    # clear
    place(fx, sfx_click(0.55), T("clear", "click"))
    place(fx, sfx_riser(4.2, 0.32), T("clear", "collapse"))
    for k in range(4):
        place(fx, sfx_whoosh(0.7, k % 2 == 0, 0.22), T("clear", "collapse", 0.4 + k * 1.05))
    place(fx, sfx_impact(0.85, 0.8), T("clear", "netted"))
    place(fx, sfx_typing(1.6, 0.14, 18), T("clear", "count"))
    place(fx, sfx_thud(0.55), T("clear", "force"))
    place(fx, sfx_coin(0.3), T("clear", "force", 0.25))
    # tech
    for c in ("arch", "verified", "tests", "keeper"):
        place(fx, sfx_pop(0.3, 880), T("tech", c))
    place(fx, sfx_typing(1.8, 0.14, 16), T("tech", "tests", 0.2))
    place(fx, sfx_chime((84, 88, 91), 0.26), T("tech", "tests", 2.0))
    # next
    for i, c in enumerate(("c1", "c2", "c3")):
        place(fx, sfx_pop(0.3, 700 + i * 150), T("next", c))
    # montage
    for c in ("a", "b", "c"):
        place(fx, sfx_whoosh(0.8, True, 0.3), T("montage", c) - 0.2)
    # outro
    place(fx, sfx_riser(2.0, 0.38), T("outro", "join") - 2.0)
    place(fx, sfx_impact(0.9), T("outro", "join"))
    place(fx, sfx_sparkle(0.24), T("outro", "sparkle"))
    return fx


def build_vo():
    vo = np.zeros((N, 2))
    for s in TL["scenes"]:
        if not s["vo"]:
            continue
        a, sr = sf.read(os.path.join(ROOT, "public/vo", s["vo"] + ".wav"), dtype="float32")
        if a.ndim > 1:
            a = a.mean(axis=1)
        a = resample_poly(a, SR, sr)
        # voice chain: HPF, gentle presence, light compression, a touch of room
        a = hp(a, 80)
        a = a + 0.25 * bp(a, 2500, 6000)
        a = np.tanh(a * 1.8) / np.tanh(1.8)
        place(vo, st(a), s["voStart"])
    return reverb(vo, IR_ROOM, 0.06)


def duck_curve(vo):
    level = np.abs(vo).mean(axis=1)
    win = int(0.05 * SR)
    level = np.convolve(level, np.ones(win) / win, mode="same")
    active = (level > 0.004).astype(float)
    # attack 80 ms, release 450 ms smoothing
    out = np.zeros_like(active)
    a_att = np.exp(-1 / (0.08 * SR))
    a_rel = np.exp(-1 / (0.45 * SR))
    y = 0.0
    for i in range(0, len(active), 32):  # block-wise for speed
        x = active[i]
        coef = a_att if x > y else a_rel
        coef = coef ** 32
        y = coef * y + (1 - coef) * x
        out[i:i + 32] = y
    return 1.0 - 0.62 * out  # ~ -8.5 dB under voice


def master(x):
    # glue: soft knee saturation then peak normalise to -1 dBFS
    x = np.tanh(x * 1.15) / np.tanh(1.15)
    peak = np.max(np.abs(x))
    return x / peak * 10 ** (-1 / 20)


if __name__ == "__main__":
    print("music…")
    music = build_music()
    print("sfx…")
    fx = build_sfx()
    print("voice…")
    vo = build_vo()
    duck = duck_curve(vo)
    mix = music * 0.55 * duck[:, None] + fx * 0.8 + vo * 1.0
    mix = master(mix)[: int(TOTAL * SR)]
    os.makedirs(os.path.join(ROOT, "public/audio"), exist_ok=True)
    sf.write(os.path.join(ROOT, "public/audio/soundtrack.wav"), mix.astype(np.float32), SR, subtype="PCM_16")
    sf.write(os.path.join(ROOT, "public/audio/music_only.wav"), master(music)[: int(TOTAL * SR)].astype(np.float32), SR, subtype="PCM_16")
    rms = np.sqrt((mix ** 2).mean())
    print("done", round(len(mix) / SR, 2), "s  rms dBFS", round(20 * np.log10(rms), 1))
