# Screening chapter — the agency and client work (follows Film & Motion in the same shot)

**Status: v1 built 2026-11-13, awaiting Nabh's review.** Code: `src/chapters/screening/`.
Idea: the film that was shot and cut in the last chapter is now *screened*. Client work is light on a wall, not cards on a page.

## What happens (s = 0..1; timings in `timeline.ts` → `SHOW`, camera stations in `KEYS`)
- 0.00–0.13 **arrive**: the written section fades, the sun goes, the camera follows the film strip from the cine camera to a vintage 8mm projector and its red feed reel.
- 0.10–0.17 **lamp**: projector switches on; blank gate racks into focus on a plaster wall; beam through haze.
- Three **reels** (0.17–0.42, 0.45–0.68, 0.71–0.84), each: title slate → footage. White flash + cue mark at each change; camera whips to a new side.
  1. Decor by Tarun — the real storefront, scrolled by the viewer's scroll (`decor.jpg`, stitched capture of decorbytarun.com).
  2. Hav Stories — two real ad films side by side (`hav1.mp4` = "havstories ad redesign", `hav2.mp4` = "HAV CRAFTED BEER").
  3. I Want Paris — slate + one line only (no footage on file yet).
- 0.87–1.00 **credits**: Markgenics, founders, cities, five years, six services roll as film credits; camera pulls back.

## How it works
- `programme.ts` paints slates / footage / credits to a canvas each frame. `ScreeningScene.tsx` uses that canvas as light in the wall shader (plaster albedo + normal show through; gate weave, flicker, grain, scratches, focus blur, cue mark), plus beam, lens glow, bounce light coloured by the picture, turning spools.
- `ScreeningOverlay.tsx` + `.so-*` CSS: real text and links per client (bottom-left), chapter mark (bottom-right).
- Scroll: `SPLIT` / `SPLIT2` in `prologue/phases.ts`. FilmScene dims the day and draws the feed strip (`feedPath`).
- Whole frame gets a film-print texture (scratches, dust, gate breathing) from `film/fx.ts`.
- Assets in `public/screening/` (~6 MB): Poly Haven "Filmstrip Projector 8mm" + "painted_plaster_wall" (CC0).
- Dev aid: `window.__screenP = 0.3` pins this chapter.

## Round 2 (2026-11-13, Nabh's review)
- Hav Stories: copy is only "Instagram content made for the brand." No link. I Want Paris: slate only, no link. Only Decor by Tarun has clickable links (the other two were clients a few years ago; their Instagram pages are gone).
- Transition from the written film section: sequenced instead of overlapping (text clears by s=0.045 → camera travels 0.035–0.175 on an outward swing, beside the film → lamp 0.16–0.215).
- Feed film: meets the red reel's rim at a tangent, winds on and spirals in; turns flat to the reel's axis and narrows to fit between the flanges; no curl.
- Note for testing: screenshots of a hidden preview pane sometimes come back black; re-shoot before assuming a bug.

## Open / known weak spots
- Reel 3 has no footage. More client clips, and any numbers, would lift the section.
- Site capture is 800 px wide (soft when the camera is close). A proper screen recording would be sharper.
- Reel 2 showed a black frame once while its videos were loading; videos are now pre-fetched and painting is guarded, but watch for it.
- Phone layout not checked. Motion / real scrolling not judged by Claude.
- The projector scan carries a "SIRIUS" label (visible from one side) — conflicts mildly with the no-logos rule.
- Client permission to show names and work publicly: Nabh to confirm.
