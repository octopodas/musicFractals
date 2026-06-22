# Build: "Fractal Glass Cube" — an audio-reactive music visualizer

> A self-contained requirements prompt. Hand this to any capable coding model to
> reproduce the full app. It specifies *what* to build and the exact behaviors and
> parameters, but leaves the implementation to the model.

Build a complete, real-time **audio-reactive music visualizer** as a small static web
app. The centerpiece is mesmerizing, liquid, colorful volumetric effects rendered inside
a semi-transparent 3D container (a glass cube), changing to the rhythm and pitch of music
playback. It must play real local audio tracks, capture live system/mic audio, and expose
rich controls. Make it genuinely compelling, not a tech demo.

## Hard constraints
- **No external dependencies or CDNs, no build step.** Plain HTML/CSS/JS only.
- Organize the JavaScript as **native ES modules** (`<script type="module">`), one file
  per responsibility (shader, renderer, audio, capture, player, controls, entry point).
  Because ES modules don't load over `file://`, the app is **served** by a static server.
- **All visuals rendered on the GPU** via a WebGL fragment shader doing **volumetric
  raymarching** on a fullscreen triangle. No per-pixel CPU work.
- Request a **high-performance GPU** context (prefer discrete GPU), opaque canvas, no
  MSAA/depth/stencil. Detect and display the active GPU/renderer name; gracefully handle
  WebGL being unavailable or the renderer name being masked.
- **Recover from a lost GPU context:** listen for `webglcontextlost` (preventDefault) and
  `webglcontextrestored` (rebuild program, buffer, and uniform locations) so a driver
  reset self-heals without a page reload; skip drawing while the context is lost.
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
- **None (fullscreen):** no container — march a depth slab along every ray with no spatial
  bound and drop the radial falloff so the field fills the whole canvas edge to edge
  (composite emissively over the background, like the sphere). The cube-only controls
  (auto-rotate, spin) hide while this is selected.
- The same volumetric field, palette, and all controls must work identically in either
  bounded container (cube/sphere); a soft radial falloff fades the volume toward the
  container surface. The fullscreen option drops that falloff so it fills the view.

## Visualization modes (the field marched inside the container)
A **Mode** selector with seven distinct volumetric fields, all audio-reactive and sharing
the color system:
1. **Liquid** — domain-warped fractal (FBM) noise fluid with bright ridged "veins"
   threading through a smooth body; flowing, morphing motion.
2. **Fractal** — a Kali / "Star-Nest" style sphere-folding orbit-trap field producing
   glowing fractal foam that folds, tumbles, and pulses (the fold strength/offset and
   rotation are driven by the music). Hue is driven by the fold geometry (orbit trap +
   dominant fold depth) so the foam reads as rich multicolour, not just the palette's
   low/core stops.
3. **Crystal** — a 3D Voronoi/Worley cellular lattice rendered as a faceted crystal/geode:
   thin glowing facet edges plus soft glowing gem cores; cell scale grows with bass, edges
   flare on the beat, cell centers drift over time.
4. **Cosmos** — a spiral galaxy: two winding arms, a bright nucleus, and a field of
   twinkling stars; the disk spins with the mids, the core throbs on bass/beat, stars
   shimmer with treble. Stars are sharp emissive points colored by the loudest band
   (icy-white when quiet → band hue when loud, power-weighted to the dominant band).
5. **Singularity** — an accretion disk spiralling into a blazing core with a **dark event
   horizon**; inner matter whips around faster (gravity), two arms wind inward, the core
   throbs on bass/beat, and each beat sends shockwave rings outward.
6. **Wormhole** — a ribbed tunnel funnelling to a bright vanishing point, ribs rushing past
   the viewer, with a gentle twist down the throat; the core throbs on bass.
7. **Ink in liquid** — ink poured in at the top, flowing endlessly downward in braided
   streamers that diffuse into feathery tendrils; the noise scrolls down so it never repeats
   and the dye sweeps through colours as it falls. Has its own controls (flow speed with an
   optional beat-sync, colour-cycle speed, streamer crispness), shown only in this mode.

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
- **Pitch → colour:** octave-fold the FFT onto the 12-tone circle for the dominant pitch
  class and rotate the palette's hue toward it (strength = how tonal the moment is); spectral
  brightness (centroid) adds a warm↔cool temperature that recedes when the pitch is confident.
  A **Pitch → Color** slider scales it; the rotation is relative so each palette keeps its
  identity. (A spectral-centroid value also still nudges the auto-hue.)
- **Audio tint** (independent of palette): three band color pickers — **Bass / Mid /
  Treble** (defaults `#ff2e2e` / `#37ff5e` / `#3aa0ff`) — and an **Audio tint** slider
  (0–1, default 0). The slider washes the whole volume toward the loudest band's color,
  preserving the bright/dark structure; 0 = off. (These band colors also drive the Cosmos
  star coloring.)
- **Backdrop gradient:** two color pickers for the background **top** and **bottom**
  (defaults `#080d16` / `#040509`), plus a **preset gradient** dropdown (Midnight, Deep
  Space, Ocean, Aurora, Sunset) that just drives the two pickers.

## Audio analysis
- Use the Web Audio API: an `<audio>` element → MediaElementSource → AnalyserNode
  (FFT size 2048, smoothing ~0.78) → destination. Create the source once. Keep the
  analyser as a leaf (off the output path) so a captured live stream can drive it without
  echoing to the speakers.
- Each frame compute normalized energy for **bass (~20–160 Hz)**, **mid (~160–1800 Hz)**,
  **treble (~1800–9000 Hz)**, and overall **level (~20–12 kHz)**, with **attack-fast /
  decay-slow** smoothing (jump up instantly, fall off gradually).
- **Per-band auto-gain (AGC):** normalize each band to its own recent rolling peak so
  naturally-quiet bands (treble) still swing full-scale. The peak rises instantly, decays
  slowly, and is floored to gate silence. Expose two knobs:
  - **AGC floor** (0.3–2, default 1) scales the per-band floor (higher = a band must be
    louder to read full-scale; less sensitive).
  - **AGC adapt** (0.95–0.999, default 0.995) is the peak decay rate (lower = adapts faster
    to quiet sections; higher = steadier).
- **Snap** (0–1, default 0.3): one knob that loosens all three smoothing layers together
  (analyser FFT smoothing, band attack/decay, and beat decay). 0 = smooth/laggy, 1 = snappy.
- **Beat detection** on bass energy vs a running average (trigger when bass exceeds ~1.35×
  the average and above a floor); the beat value decays after each hit.
- **Spectral centroid** → drives the automatic hue shift (pitch).
- Show a **live spectrum** bar display in the panel.

## Live audio capture (no file needed)
Two independent ways to feed the visualizer from a live source instead of the file; only
**one capture is active at a time** (enabling one disables the other), and both **reset on
reload** (not persisted). Route the captured stream into the analyser in place of the file
and do **not** connect it to the destination (no echo). Use clean constraints for music
(echo cancellation, noise suppression, and auto-gain **off**).
- **🎧 System audio** (`getDisplayMedia`): capture another app via screen-share. Guide the
  user (Chrome: pick a *Tab* + "Share tab audio"; system-wide only on Windows). If the
  shared source has no audio track, warn and abort. Auto-uncheck when the user clicks
  "Stop sharing".
- **🎤 Mic / Monitor** (`getUserMedia`): capture an input device, with a **device picker**
  populated from the available audio inputs (labels appear once the site has mic
  permission). On Linux, a *"Monitor of …"* source captures all system audio with no extra
  software. Handle a busy/blocked default device by still opening the picker so the user can
  choose another source; switching the select swaps the live device.

## Reactive mappings (how audio drives the visuals)
- Bass/beat → density, brightness, fractal fold strength, crystal cell scale, galaxy core,
  singularity core + shockwave rings, wormhole core.
- Mids → container/disk rotation speed, reflection strength.
- Treble → shimmer/filaments, star twinkle, crystal edge flare, rim glow, bio sparkle.
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
A floating control panel with these controls. Show numeric value next to each slider, and
a small **"?" help icon** on each slider that toggles a one-line explanation.
Ranges/defaults:
- **Tracks:** dropdown selector; "＋ Add audio files" file picker; drag-and-drop anywhere.
- **System audio** toggle and **Mic / Monitor** toggle + device dropdown (see Live capture).
- **Mode:** Liquid / Fractal / Crystal / Cosmos / Singularity / Wormhole / Ink in liquid.
- **Container:** Cube (glass) / Sphere (invisible) / None (fullscreen).
- **Palette:** the 5 presets + Custom.
- **Speed:** 0–3, default 1 (+ the Sync-speed-to-beat toggle).
- **Reactivity:** 0–6, default 1 (global audio sensitivity).
- **AGC floor:** 0.3–2, default 1. **AGC adapt:** 0.95–0.999, default 0.995.
- **Snap:** 0–1, default 0.3.
- **Pulse:** 0–2.5, default 1.
- **Density:** 0.3–2, default 1.
- **Hue shift:** 0–360°, default 0.
- **Saturation:** 0–2, default 1.
- **Pitch → Color:** 0–1, default 0.8 (strength of the pitch-driven hue rotation; 0 = off).
- **Custom colors:** five color pickers (Low/Body/High/Core/Base).
- **Audio tint:** three band color pickers (Bass/Mid/Treble) + tint amount 0–1, default 0.
- **Ink in liquid** (shown only in that mode): **Flow speed** 0–3 default 1 with a **Sync
  flow to beat** toggle, **Color cycle** 0–3 default 1, **Streamer crispness** 0–1 default 0.5.
- **Backdrop gradient:** top/bottom color pickers + a preset-gradient dropdown.
- **Auto-rotate** toggle (default on) + **Spin speed** 0–1.5, default 0.3 (rotation also
  nudged by the mids; both hidden in the fullscreen container). Plus **drag the container
  with the mouse to rotate**.
- **Quality:** render-resolution scale Low/Med/High (≈0.6 / 0.8 / 1.0), default Med
  (lives with the Renderer readout).
- **Live spectrum** display and a **Renderer** (GPU name) readout.
- Dropdown option text must be readable (dark background, light text).

## Music player (transport)
A separate player bar (bottom-left): scrolling track title, current/total time, seek bar,
previous / play-pause / next buttons, volume slider, and a small beat indicator. Auto-
advance to the next track on end. Play/pause icon reflects state. A small toggle collapses
the bar in place to an icon in its bottom-left corner (and expands it back).

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
- Persist **all control settings** (mode, container, palette, all custom colors, the audio-
  tint band colors + amount, the backdrop gradient colors, every slider including AGC and
  Snap, all toggles, quality, volume) in `localStorage` and restore them on load so they
  survive page reloads / server relaunches. Restore by applying saved values through the
  normal control handlers (restore colors before palette so a saved preset isn't forced to
  Custom). Live capture state is intentionally **not** persisted. Note that localStorage is
  per-origin (port matters).

## Acceptance criteria
- Opening the page (served) auto-loads any audio in `tracks/`; pressing play makes the
  chosen mode visibly react to the music in real time (rhythm and pitch).
- All seven modes render distinctly; both containers work for every mode; the sphere shows
  no visible shell.
- System-audio and mic/monitor capture each drive the visuals from a live source with no
  echo, and only one is active at a time.
- Every control changes the visuals as described; settings persist across reloads.
- A lost GPU context recovers without a reload.
- No external network requests; no build step; renders on the GPU.
