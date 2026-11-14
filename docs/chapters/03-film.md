# Film & Motion chapter (follows the autograph in the same shot)

**Status: v1 built 2026-11-13. Awaiting Nabh's review.** Code: `src/chapters/film/`. The old ink-trail "skill rack" was scrapped (Nabh: ink felt fake).

## What happens (f = 0..1, timings in `timeline.ts` → `FILM`; `SPLIT` in `prologue/phases.ts` divides the scroll)
- 0.00–0.20 **travel**: camera tilts off the signed page and moves across the desk to a vintage 8mm cine camera; the room and haze come up.
- 0.17–0.42 **half orbit** around it, ending with the camera in the right third, low sun behind (backlight, halation).
- 0.40–0.62 **reel**: a 3D film strip unwinds out of the camera toward the viewer, right → left; frames are stills from Nabh's reel with a grungy green negative look. Pr and Ae tiles peek from behind it.
- 0.60–0.70 scene dims and blurs; 0.63–0.80 **beat A** (editing), 0.80–0.98 **beat B** (motion): HTML text staged like editing software — cursor drags a word into the sentence, layer bounding box, clip chips, graph editor, program monitor playing the reel with timecode + timeline.

## Assets (all in `public/film/`, ~6.4 MB)
- `camera/` — "Vintage Video Camera", photo-scanned, Poly Haven, CC0. 2k textures, recompressed.
- `desk/` — "wood_table_worn" PBR texture, Poly Haven, CC0.
- `reel.mp4` — first 36 s of `meditation reel.mp4`, silent, ~3 MB. `frames.jpg` — 12 stills atlas for the strip. `poster.jpg`.
- Pr / Ae tiles are drawn in code (`appTile`), not image files.

## How it works
- `timeline.ts` — phases, viewer camera path (`filmCamera`), strip path. `fx.ts` — grade effect + live handles to bloom/noise.
- `FilmScene.tsx` — desk, sheet shadow, cine camera, lights, sun glow, strip shader, tiles. `FilmOverlay.tsx` + `.fo-*` rules in `globals.css` — the written part, driven by CSS variables.
- Look ("black mist"): bloom threshold drops, grain rises, grade lifts green-teal blacks and warms highlights, fog swallows the far desk.
- Dev aid: `window.__filmP = 0.6` pins this chapter; `delete window.__filmP` releases. If new CSS doesn't show, restart the dev server.

## Round 2 fixes (2026-11-13, from Nabh's review)
- Reel now starts inside the camera body and rises straight out of the roof (`EXIT`, `CINE_YAW` in `timeline.ts`) before curling — no more slicing through the body.
- Pr / Ae tiles sit behind the film's plane, tucked under its arc, so the film never cuts through them.
- Desk: brighter wood colour, no grey reflections, real cast shadow from the sun (Canvas `shadows`), contact shadow, sun has soft rays.
- Monitor: timecode and timeline removed; picture has feathered edges, a blurred halo copy of itself, grain, light leak, corner marks.
- Clip tags: one warm gold in four weights. Written section has a film-texture layer (`.fo-tex`: grain, leaks, vignette).
- FilmScene has its own Suspense so the autograph never waits for film assets.

## Open / known weak spots
- Sun is bright at the right edge of the hold shot; no depth of field yet.
- Copy is placeholder ("I cut for feeling first." / "Then I make it move." + paragraphs). The "four years" line needs Nabh's confirmation.
- Phone layout not re-checked after round 2. Motion and real scrolling not judged by Claude (preview pane was hidden).
- Frames on the strip all come from one reel; more of Nabh's work can be added to the atlas.
