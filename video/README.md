# Par demo video

A 3-minute motion video built with [Remotion](https://remotion.dev): real screens captured from the app on a
seeded local chain that mimics Mezo testnet (chain 31611), a Kokoro-82M voiceover (`af_heart`), and an original
score and sound design synthesized in code (no third-party samples, so the soundtrack is license-free).

| Step | Command |
| ---- | ------- |
| 1. Voiceover | `python tools/vo.py` (kokoro-onnx, `af_heart`, speed 0.97) → `public/vo/*.wav`, `vo-durations.json` |
| 2. Timeline | `python3 tools/timeline.py` → `src/timeline.json` (scene starts from VO lengths) |
| 3. Soundtrack | `python tools/audio.py` → `public/audio/soundtrack.wav` (score + SFX + VO, ducked and mastered) |
| 4. Screens | captured with Playwright against `contracts/hardhat.video.config.ts` (see `tools/capture/`) → `public/shots` |
| 5. Render | `npx remotion render src/index.ts ParDemo out/par-demo.mp4 --crf=18 --audio-bitrate=320k` |

Script: `script.json`. Animation and SFX share cue times in `src/cues.json`.
