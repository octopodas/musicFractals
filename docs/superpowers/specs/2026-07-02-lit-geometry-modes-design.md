# Lit-Geometry Modes: Monolith, Gyroid, Equalizer, Shards

Date: 2026-07-02 · Status: approved

## Goal

Four new visualization modes with pronounced 3D solidity. All existing modes are
soft emissive fog; these render **lit hard surfaces** — normals, specular, ambient
occlusion — with neon palette accents so they still belong to the app.

## Architecture

One shared **surface rail** added to the existing fragment shader (`src/shader.js`),
selected by `uMode >= 8`. No second shader program; `renderer.js` only gains new
uniform locations. The rail replaces the volume-accumulation loop for these modes:

1. Ray enters the container exactly as today (glass cube / invisible sphere / open
   slab, refraction and rim glow unchanged).
2. Sphere-trace an SDF up to ~96 steps; step size from the SDF distance.
3. On miss: existing `background(rd)`.
4. On hit:
   - Normal: tetrahedron 4-tap of the SDF.
   - AO: 4 samples along the normal.
   - Lighting: one cool key light, one warm rim/back light, Blinn-Phong specular.
   - **Neon accents**: cavities/edges (low AO or curvature proxy) emit palette
     colour through the existing `fluidColor(d, y)` — so Palette, Custom colours,
     Audio tint, Saturation and Pitch → Color all work unchanged.
   - Beat flash (existing `uBeat` terms) applies to the emissive part only, and
     accent brightness scales with `uLevel` so quiet passages calm the surfaces
     (matching the fog modes' loudness exposure).
5. The beat-ripple displacement (`qb` pattern) offsets the SDF sample position:
   beats physically warp the geometry in every surface mode.

Each mode is one SDF function `float xxxSDF(vec3 p, out float glow)` plugged into
the rail — mirroring how fog modes plug fields into the volume loop. `glow` is the
mode's own 0..1 accent coordinate (also used as the multicolour hue coordinate,
subject to the chroma collapse).

## Modes and music mapping

All mappings are structural (shape, not gain), matching the reactivity work of
2026-07-02. All zero out in silence → calm, intact geometry.

| # | Mode | Geometry | Bass | Mid | Treble | Beat |
|---|------|----------|------|-----|--------|------|
| 8 | Monolith | Menger/KIFS box-fold, ~5 iterations | morphs fold offset (architecture reshapes) | tumbles rotation | fine-edge glow | ripple + fold strength kick |
| 9 | Gyroid | gyroid shell `abs(dot(sin p, cos p.yzx)) - t` | wall thickness `t` swells | domain undulation warp | secondary high-freq shimmer lattice | cavity glow pulse + ripple |
| 10 | Equalizer | radial ring of rounded solid columns | (via bands) | (via bands) | (via bands) | wave travelling around the ring |
| 11 | Shards | icosahedral mirror-folded shard | shards separate outward | rotates the fold | facet glint (specular boost) | fold-angle kick → chamber re-assembles |

## Data addition: 16-band spectrum (Equalizer only)

`src/audio.js` computes `analysis.bands` — a `Float32Array(16)`, log-spaced
60 Hz–10 kHz, each band normalized by its own rolling peak (same recipe as the
existing per-band AGC: rise instantly, decay by `ui.agcDecay`, floored).
`renderer.js` uploads it as `uniform float uBands[16]` via `uniform1fv` every
frame. Cheap enough to upload unconditionally.

Column *i* of 16 around the ring takes height and tip-glow from `uBands[i]`.

## UI integration (`index.html`, `controls.js`)

- Four new `<option>`s in the Mode select: Monolith (8), Gyroid (9),
  Equalizer (10), Shards (11). No new sliders — Reactivity, Density (accent
  amount), Pulse, Speed, palette and chroma controls all apply.
- Mode persistence already covers the select.

## Performance

Sphere tracing terminates early on hit; SDFs are a few lines each. Budget:
~96 steps worst case + 8 extra SDF evals (normal + AO) on hit only — comparable
to the current 64-step fog loop with 5-octave fbm per step. Quality select
(render scale) remains the escape hatch. Target: 60 fps at scale 0.8 on the
dev machine (RTX 3060 Ti); acceptable on integrated GPUs at Low.

## Explicitly out of scope (YAGNI)

- Shadow rays (AO carries the depth cue), reflections between surfaces.
- Per-mode sliders, new palettes.
- A second shader program.
- Bands-driven behaviour in the seven fog modes.

## Verification

The session's standard loop, per mode: page loads with no shader compile errors
(single program validates all modes), screenshots playing vs paused (music
reshapes geometry; silence = calm solid), all four modes non-black with healthy
brightness variance, console clean. Equalizer additionally: columns visibly
track a frequency sweep (`tracks/showcase.wav` or `test-tone.wav`).
