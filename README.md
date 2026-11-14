# Nabh Priya Gautam — portfolio

**Live:** https://nabh-portfolio.netlify.app

A single continuous, scroll-driven 3D film shot, built with Next.js, React Three Fiber and custom GLSL shaders.

1. **Prologue**: a blade of light unveils a fountain pen, which signs my autograph as you scroll. The ink follows the real stroke order, traced from a photo of my signature.
2. **Film & Motion**: the camera travels across a desk to a scanned vintage 8mm cine camera. A film strip unwinds toward the viewer, then the editing and motion-graphics section is staged like the inside of an editor.
3. **Screening room**: the film feeds a scanned 8mm projector, and client work from my agency, Markgenics, is projected as light on a plaster wall.
4. **What comes next**: a film-strip wipe, then a floating laptop where an AI chat answers a question about me.
5. **Contact**: a message form that sends straight from the page.

## Stack
- Next.js 16 (static export), React 19, TypeScript, Tailwind CSS 4
- three.js, @react-three/fiber, @react-three/drei, @react-three/postprocessing
- Lenis for smooth scrolling
- Hosted on Netlify. The contact form uses FormSubmit.

## Run locally
```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # static site in out/
```

## Project layout
- `src/chapters/<name>/`: each chapter is its own module (scene, overlay, timeline).
- `docs/`: design notes and decisions for each chapter.
- `scripts/`: tools that turned the signature photo into the ink mask and the draw-order map. The source photo is not in this repo.

## Credits
- 3D models and textures: [Poly Haven](https://polyhaven.com) (CC0): *Vintage Video Camera*, *Filmstrip Projector 8mm*, *wood_table_worn*, *painted_plaster_wall*.
- The footage, photos, signature and client work are my own or my clients'. They are **not** covered by an open licence. Please don't reuse them.
