# Fractal Glass Cube — Music Visualizer

An audio-reactive volumetric visualizer that renders inside a semi-transparent glass cube.
A single raymarched WebGL fragment shader drives everything — no dependencies, no build step.

![mode: liquid + fractal](https://img.shields.io/badge/modes-liquid%20%7C%20fractal-4cc5ff) ![deps: none](https://img.shields.io/badge/deps-none-success)

## Two modes

- **Liquid** — domain-warped fluid with cyan veins and a molten base.
- **Fractal** — a Kali / Star-Nest sphere-folding field; intricate fractal foam that folds and tumbles to the music.

Both react to the track in real time: bass + beat detection pump density and brightness (rhythm),
spectral centroid shifts the hue (pitch), and mids drive the spin and fold rotation.

## Run it

```bash
python3 server.py        # → http://localhost:8000/
```

`server.py` serves the folder and **auto-lists** `tracks/` — drop `.mp3` / `.wav` / `.ogg`
files in there and they appear in the selector automatically (no manual config).

You can also just open `index.html` directly (`file://`) and **drag audio files onto the page**
or use the "＋ Add audio files" button — auto-listing won't work over `file://`, but playback does.

A generated `tracks/test-tone.wav` is included as a demo. Your own music stays local (git-ignored).

## Controls

| | |
|---|---|
| **Mode** | Liquid / Fractal |
| **Palette** | Liquid Cyan · Plasma · Nebula · Inferno · Aurora |
| **Speed / Reactivity / Density / Hue** | transform speed, audio sensitivity, fill, color shift |
| **Auto-rotate / Spin / Quality** | cube motion and render scale (drag the cube to rotate) |
| **Player** | track selector, play/pause, prev/next, seek, volume, live spectrum |

## License

MIT. Bring your own music — bundled audio is not included for copyright reasons.
