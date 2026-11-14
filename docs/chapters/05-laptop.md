# Laptop chapter — "What comes next" (follows the Screening; last dynamic chapter)

**Status: v1 built 2026-11-13, awaiting Nabh's review.** Code: `src/chapters/laptop/`.
(The earlier "Denoise" version of this chapter was scrapped — Nabh didn't like it.)

## What happens (x = 0..1; `timeline.ts` → `LAP`)
- 0.00–0.20 **wipe**: a film strip comes in from the bottom-left corner, swells until it covers the frame, then its trailing edge leaves. The cut to the laptop's space happens at x = 0.10, while the frame is covered.
- 0.11–0.40 **emerge**: a laptop floats in the dark, turned away, settles facing the viewer; lid opens (0.16–0.38), screen powers on.
- 0.36–0.58 **push in** until the screen fills the frame (slightly off-axis, keyboard edge in view).
- 0.52–0.97 **chat**: an AI chat window. The question types itself ("Who is Nabh, and what is he working toward?"), is sent, three dots, then the answer arrives word by word: 2nd-year CSE at Chandigarh University, studying ML, edits films and makes content; headed toward "an AI engineer who also makes films"; "He is not there yet. He is working on it."

## How it works
- `ReelWipe.tsx` — full-frame quad (renderOrder 60), 2D film-strip shader using the reel's frame atlas.
- `LaptopScene.tsx` — the laptop is built in code to MacBook Air proportions (30.4 × 21.5 cm, rounded slab, notch, keys, trackpad); no logo. It lives at `HOME` (0, 0, 140), far above the desk. Screen = canvas texture.
- `chat.ts` — paints the chat UI (original design, not a copy of any product) to a 2048×1330 canvas. Copy in `timeline.ts` (`QUESTION`, `ANSWER`).
- `laptopCamera` sets the camera outright after the cut. Scroll: `SPLIT3` in `prologue/phases.ts`. Dev aid: `window.__laptopP = 0.6`.
- `LaptopOverlay.tsx` — chapter mark + the Q&A as screen-reader text.

## Open
- **Not a downloaded MacBook Air M5 model.** No free, legally downloadable one was found (paid on CGTrader / TurboSquid; Sketchfab needs an account). If Nabh buys or downloads a .glb, swap it into `LaptopScene.tsx`.
- Question and answer copy are placeholders for Nabh to rewrite.
- Palm rest was catching a hot reflection; roughness raised after the last check, not re-verified. Phone layout not checked. Motion not judged by Claude.
- Next: About me + contact (interests folded in as 2–3 lines), returning to the signed page.
