# Performance (phones first) — 2026-11-21

Measured: desktop Chrome, full quality, scripted scroll through the whole film (900 frames):
- before: 18 frames over 34 ms, worst 416 ms (at every section change)
- after, first pass: 2 frames over 34 ms (100 ms at the film start, 50 ms at the projector), then a steady 60 fps
- after, second pass: 0 slow frames, worst 18 ms, average 16.7 ms
Not measured on a real phone (no device here). Phone layouts were checked in a 375 × 812 touch emulation.

## What caused the stutter at section changes
1. Lights inside groups that were hidden/shown (screening, laptop) and the sun's `visible` toggle: in three.js a light
   appearing or disappearing recompiles every lit material. Lights now stay put; only their intensity changes.
2. First-time GPU work when a chapter first appeared (shader compiles, texture/mesh uploads, shadow shaders).
   `Warmup` in `PrologueScene.tsx` draws the whole scene once off screen, everything shown, nothing culled.
3. Video decoders starting cold: reel videos are started and paused once after load; the halo is now a blurred still.
4. Load waterfall: textures waited for the 3D models. Everything now preloads in parallel (`useLoader.preload`, `preload()` for the opening).

## Phone tier (`src/lib/quality.ts` → `LITE`, = touch screen or small screen)
- 1k textures for the camera, projector, desk and wall (`*_lite.gltf`, `*_1k.jpg`); no real-time shadows; no MSAA;
  bloom at half resolution; fewer noise octaves in the paper and laptop-haze shaders (`#ifdef LITE`).
- Resolution starts at 1.25× and adapts (drei `PerformanceMonitor`), max 1.5× on phones, 1.75× on desktop.
- Projected picture painted at 30 fps and 640 × 360; no canvas blur. Laptop chat canvas at half size.
- CSS `@media (pointer: coarse)`: no backdrop blurs or blend modes over the canvas, no grain layers on the video.
- Touch scrolling is smoothed in `Prologue.tsx` (desktop is smoothed by Lenis).

## Everywhere
- Canvas stops drawing when the film is off screen (contact form). Canvas ignores scroll for measuring (`resize.scroll: false`).
- Overlays write styles only when a value changes (`src/lib/styleWriter.ts`).
- Projector picture and laptop chat re-upload to the GPU only when their content changes.
- Load state is shared via `window.__filmLoading` (`src/lib/loading.ts`); the page shows "Loading n%" and opens scroll
  when everything is ready (warm-up hidden behind the loader), or 4 s after the opening is ready on slow connections.

## Phone layout fixes
- Laptop: on tall screens the camera frames the screen square on and the page shows the conversation itself
  (`LaptopOverlay.tsx`, `.lp-chat`), crisp and readable.
- Pr / Ae tiles: on tall screens anchored to the top left of the frame, sized to the screen, just behind the film.
