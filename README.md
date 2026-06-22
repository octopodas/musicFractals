# Fractal Glass Cube — Music Visualizer

An audio-reactive volumetric visualizer that ray-marches a glowing volume inside a
semi-transparent glass cube (or an invisible sphere). One WebGL fragment shader does
the rendering — no dependencies, no build step.

![modes: 7](https://img.shields.io/badge/modes-7-4cc5ff) ![deps: none](https://img.shields.io/badge/deps-none-success)

Everything reacts to the track in real time: bass + beat detection pump density and
brightness (rhythm), spectral centroid shifts the hue (pitch), and mids drive the
spin and fold rotation. Per-band auto-gain keeps naturally-quiet bands (treble)
swinging full-scale.

## Visualizations

Seven **modes** — the shape of the volume:

- **Liquid** — domain-warped fluid with cyan veins and a molten base.
- **Fractal** — a Kali / Star-Nest sphere-folding field; intricate foam that folds and tumbles.
- **Crystal** — faceted Voronoi lattice with glowing gem cells, flaring on the beat.
- **Cosmos** — spiral galaxy: winding arms, a pulsing core, and twinkling stars.
- **Bioluminescence** — drifting glow blobs with trailing tendrils, breathing on bass.
- **Singularity** — an accretion disk spiralling into a dark event horizon.
- **Wormhole** — a ribbed tunnel funnelling to a bright vanishing point.

Two **containers** (Cube glass / Sphere invisible) and six **palettes**
(Liquid Cyan · Plasma · Nebula · Inferno · Aurora · Custom).

## Run it

```bash
python3 server.py        # → http://localhost:8000/
```

`server.py` serves the folder and **auto-lists** `tracks/` — drop `.mp3` / `.wav` / `.ogg`
files in there and they appear in the selector automatically (no manual config).

The code is split into ES modules under `src/`, so it must be **served** (any static
server works) — opening `index.html` over `file://` won't load the modules. Once served,
**drag audio files onto the page** or use the "＋ Add audio files" button to add your own.

A generated `tracks/test-tone.wav` is included as a demo. Your own music stays local (git-ignored).

### Live audio (no file needed)

- **🎧 System audio** — capture another app via screen-share (Chrome: pick a *Tab* + "Share tab audio"; system-wide only on Windows).
- **🎤 Mic / Monitor** — capture an input device. On Linux, pick a *"Monitor of …"* source for all system audio with no extra software.

## Controls

| | |
|---|---|
| **Mode / Container / Palette** | volume shape, glass cube or invisible sphere, colour ramp |
| **Speed / Sync speed to beat** | animation speed; optionally let the beat drive the tempo |
| **Reactivity / Density / Pulse** | audio sensitivity, fill, beat-driven brightness rings |
| **AGC floor / AGC adapt / Snap** | per-band auto-gain sensitivity + adaptation, and smoothing tightness |
| **Hue / Saturation / Audio tint** | colour shift, intensity, wash toward the loudest band |
| **Custom colors / Backdrop** | per-density colour stops + background gradient (with presets) |
| **Auto-rotate / Spin / Quality** | scene motion and render scale (drag the cube to rotate) |
| **Player** | track selector, play/pause, prev/next, seek, volume, live spectrum |

## Code layout

ES modules under `src/`, each with one responsibility:

| File | Responsibility |
|---|---|
| `shader.js` | GLSL vertex + fragment source (the raymarcher) |
| `renderer.js` | WebGL context, shader build, context-loss recovery, per-frame draw |
| `audio.js` | Web Audio graph + analysis (bass/mid/treble/level/beat/hue) |
| `capture.js` | live system-audio and mic/monitor stream capture |
| `player.js` | playlist, transport, file add/drop, track auto-discovery |
| `controls.js` | settings state, panel bindings, help, persistence |
| `main.js` | wires the modules together and runs the frame loop |

## License

MIT. Bring your own music — bundled audio is not included for copyright reasons.
