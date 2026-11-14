# Chapter 0 — Prologue (the autograph)

**Status: built, v1.** Code: `src/chapters/prologue/`.

## What happens (scroll progress, see `phases.ts`)
- 0.02–0.15 **reveal**: a slanted blade of light sweeps sideways; a black curtain behind it uncovers the pen resting in the dark; flare + moving light glint on the gold, plus a screen-space cinema-lens glare (anamorphic streak, halation, ghosts).
- 0.17–0.31 **rise**: pen lifts, turns into writing pose; warm pool of light appears on dark paper.
- 0.31–0.88 **write**: pen writes Nabh's real autograph (5 strokes, pen lifts between them). Camera starts close on the nib, pulls back to the full signature. Fresh ink glows at the nib.
- 0.90–1.00 **exit**: pen lifts away into darkness; name + one-liner fade in (HTML).

## How it works
- `assets-src/autograph.jpg` → `scripts/sig-mask.mjs` → `public/signature/ink.png` (clean ink mask).
- `scripts/sig-trace.mjs` → `signature.json` (ordered centerline strokes, hand-placed waypoints routed along the ink skeleton) + `public/signature/time.png` (per-pixel draw order, 16-bit in R/G). Re-run both scripts if the autograph photo changes: `node scripts/sig-mask.mjs && node scripts/sig-trace.mjs`.
- `signaturePath.ts` — timeline sampler (tip position, lift, drawn fraction).
- `Pen.tsx` — procedural fountain pen (lathe body, extruded gold nib). No model file.
- `PrologueScene.tsx` — everything per-frame: poses, camera, curtain/blade/flare, paper+ink shader, post FX.
- `Prologue.tsx` — sticky 640vh section, scroll progress, HTML overlays, reduced-motion (static signed page).
- Dev aid: in the browser console `window.__prologueP = 0.5` pins the sequence; `delete window.__prologueP` releases it.

## Open / ideas
- Copy is placeholder ("Every story begins with a name." / "Film, philosophy, poetry — and the things I build.").
- Not yet judged on a real GPU for smoothness; no low-end quality fallback yet.
- Possible polish: engraved nib detail, ink pooling at stroke ends, paper texture, sound.
