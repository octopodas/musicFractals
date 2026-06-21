# Build: "Fractal Glass Cube" — an audio-reactive music visualizer (single HTML file)

> A self-contained requirements prompt. Hand this to any capable coding model to
> reproduce the full app. It specifies *what* to build and the exact behaviors and
> parameters, but leaves the implementation to the model.

Build a complete, self-contained, real-time **audio-reactive music visualizer** as ONE
`index.html` file. The centerpiece is mesmerizing, liquid, colorful volumetric effects
rendered inside a semi-transparent 3D container (a glass cube), changing to the rhythm
and pitch of music playback. It must play real local audio tracks and expose rich
controls. Make it genuinely compelling, not a tech demo.

## Hard constraints
- **Single file**, no build step, **no external dependencies or CDNs** (must run offline
  by opening the file or via a static server).
- **All visuals rendered on the GPU** via a WebGL fragment shader doing **volumetric
  raymarching** on a fullscreen triangle. No per-pixel CPU work.
- Request a **high-performance GPU** context (prefer discrete GPU), opaque canvas, no
  MSAA/depth/stencil. Detect and display the active GPU/renderer name; gracefully handle
  WebGL being unavailable or the renderer name being masked.
- Smooth 60fps target on a mid-range GPU; provide a quality/resolution-scale control.

## Container (the shape holding the visuals)
A top-level **Container** selector, independent of the visualization mode:
- **Cube (glass):** a semi-transparent glass cube (half-size 1, centered at origin).
  Ray–box intersection; refract the view ray into the glass; show the interior volume
  through it; add a fresnel reflection of the environment; add a **thin, subtle glowing
  rim** along the cube edges (treble makes it shimmer slightly).
- **Sphere (invisible):** ray–sphere intersection (radius 1); the boundary is **fully
  transparent** — no glass shell, no edges, no refraction, no rim. March straight through
  and composite the emissive volume over the background so it reads as a glowing orb with
  the background visible around/through it.
- The same volumetric field, palette, and all controls must work identically in either
  container. A soft radial falloff fades the volume toward the container surface.

## Visualization modes (the field marched inside the container)
A **Mode** selector with four distinct volumetric fields, all audio-reactive and sharing
the color system:
1. **Liquid** — domain-warped fractal (FBM) noise fluid with bright ridged "veins"
   threading through a smooth body; flowing, morphing motion.
2. **Fractal** — a Kali / "Star-Nest" style sphere-folding orbit-trap field producing
   glowing fractal foam that folds, tumbles, and pulses (the fold strength/offset and
   rotation are driven by the music).
3. **Crystal** — a 3D Voronoi/Worley cellular lattice rendered as a faceted crystal/geode:
   thin glowing facet edges plus soft glowing gem cores; cell scale grows with bass, edges
   flare on the beat, cell centers drift over time.
4. **Cosmos** — a spiral galaxy: two winding arms, a bright nucleus, and a field of
   twinkling stars; the disk spins with the mids, the core throbs on bass/beat, stars
   shimmer with treble.

Each mode must look clearly different from the others and "dance" to the music.

## Color system
- **Palette** selector with 5 presets: *Liquid Cyan* (blue body, white-hot core, molten
  orange base), *Plasma*, *Nebula*, *Inferno*, *Aurora* — plus a **Custom** entry.
- Color is a function of local density and vertical position (so the base/floor can glow a
  different hue than the body/core).
- **Custom palette** = a 5-stop scheme using **native color pickers**: a density gradient
  **Low → Body → High → Core** (sparse to dense) plus a separate **Base** (floor glow).
  Picking any swatch auto-switches Palette to Custom. Picked colors must render faithfully
  (clamp so the brightest regions equal the chosen Core color, no hue drift).
  Defaults: Low `#0a2a66`, Body `#26a6ff`, High `#7fe0ff`, Core `#bcf0ff`, Base `#ff7a1e`.
- **Hue shift** slider (0–360°), and **Saturation** slider (0 = greyscale, 1 = normal, up
  to 2 = boosted) — both apply to every palette including presets.
- Pitch reactivity: a spectral-centroid value subtly shifts the hue automatically.

## Audio analysis
- Use the Web Audio API: an `<audio>` element → MediaElementSource → AnalyserNode
  (FFT size 2048, smoothing ~0.78) → destination. Create the source once.
- Each frame compute normalized energy for **bass (~20–160 Hz)**, **mid (~160–1800 Hz)**,
  **treble (~1800–9000 Hz)**, and overall **level (~20–12 kHz)**, with **attack-fast /
  decay-slow** smoothing (jump up instantly, fall off gradually).
- **Beat detection** on bass energy vs a running average (trigger when bass exceeds ~1.35×
  the average and above a floor); the beat value decays after each hit.
- **Spectral centroid** → drives the automatic hue shift (pitch).
- Show a **live spectrum** bar display in the panel.

## Reactive mappings (how audio drives the visuals)
- Bass/beat → density, brightness, fractal fold strength, crystal cell scale, galaxy core.
- Mids → container/disk rotation speed, reflection strength.
- Treble → shimmer/filaments, star twinkle, crystal edge flare, rim glow.
- Beat → a brightness flash and acceleration of the radial pulse.

## Effects
- **Radial beat pulse:** brightness rings that travel from the container center outward to
  the sides, accelerating on each beat (driven by a phase that advances faster on beats).
  A **Pulse** slider (0–2.5, default 1) scales the effect; applies to all modes.
- **Auto-speed (beat sync) toggle:** "Sync speed to beat." When on, the transformation
  speed follows a smoothed, beat-driven tempo — it bursts on each beat and eases between
  beats — with the Speed slider acting as a scale. While active, dim the Speed slider and
  show the live computed value in its readout. When off, the Speed slider controls it
  manually.

## Controls panel (glassmorphism, collapsible)
A floating control panel with these controls. Show numeric value next to each slider.
Ranges/defaults:
- **Tracks:** dropdown selector; "＋ Add audio files" file picker; drag-and-drop anywhere.
- **Mode:** Liquid / Fractal / Crystal / Cosmos.
- **Container:** Cube (glass) / Sphere (invisible).
- **Palette:** the 5 presets + Custom.
- **Speed:** 0–3, default 1 (+ the Sync-speed-to-beat toggle).
- **Reactivity:** 0–6, default 1 (global audio sensitivity).
- **Pulse:** 0–2.5, default 1.
- **Density:** 0.3–2, default 1.
- **Hue shift:** 0–360°, default 0.
- **Saturation:** 0–2, default 1.
- **Custom colors:** five color pickers (Low/Body/High/Core/Base).
- **Auto-rotate** toggle (default on) + **Spin speed** 0–1.5, default 0.3
  (rotation also nudged by the mids). Plus **drag the container with the mouse to rotate**.
- **Quality:** render-resolution scale Low/Med/High (≈0.6 / 0.8 / 1.0), default Med.
- **Live spectrum** display and a **Renderer** (GPU name) readout.
- Dropdown option text must be readable (dark background, light text).

## Music player (transport)
A separate player bar (bottom-left): scrolling track title, current/total time, seek bar,
previous / play-pause / next buttons, volume slider, and a small beat indicator. Auto-
advance to the next track on end. Play/pause icon reflects state.

## Track loading ("real tracks in the page folder")
- A `tracks/` folder holds the audio. Because a static page can't list a directory,
  support: (a) when served over http, **auto-load** filenames listed in
  `tracks/tracks.json`; (b) a file picker; (c) drag-and-drop. Include a small generated
  demo tone so it works out of the box.
- Provide a tiny **companion static server** (e.g., a stdlib Python script) that serves
  the folder AND dynamically returns a live listing of the `tracks/` folder at
  `tracks/tracks.json`, so users just drop files in and they appear — no manual editing.

## Layout, UX, and chrome
- Dark, space-like background with faint warm bokeh "embers" and a warm floor bounce.
- Tone-mapping + vignette on the final image.
- Control panel is collapsible (✕ to close); when closed, a ☰ button (top-left) reopens it.
- A **fullscreen** toggle button (top-right) using the native Fullscreen API; its icon
  swaps between expand/collapse with the fullscreen state.
- When the panel is open, **shift the visualization to the right** so it's centered in the
  area beside the panel; re-center to the full screen when the panel is hidden. Recompute
  on window resize and quality change (use the panel's layout box, not a transformed rect).
- Player bar sits at bottom-left and must not overlap the panel.

## Persistence
- Persist **all control settings** (mode, container, palette, all five custom colors, every
  slider, all toggles, quality, volume) in `localStorage` and restore them on load so they
  survive page reloads / server relaunches. Restore by applying saved values through the
  normal control handlers (restore colors before palette so a saved preset isn't forced to
  Custom). Note that localStorage is per-origin (port matters).

## Acceptance criteria
- Opening the page (served) auto-loads any audio in `tracks/`; pressing play makes the
  chosen mode visibly react to the music in real time (rhythm and pitch).
- All four modes render distinctly; both containers work for every mode; the sphere shows
  no visible shell.
- Every control changes the visuals as described; settings persist across reloads.
- No external network requests; runs offline; renders on the GPU.
