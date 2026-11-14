# State — updated 2026-11-13

## Done
- Discovery + concept (VISION.md). Context-saving doc system.
- Next.js 16 + R3F + drei + postprocessing + Lenis scaffold. Node lives at `~/.local/node/bin` (not on PATH by default).
- **Chapter 0 Prologue v1**: light blade unveils fountain pen → pen writes Nabh's real autograph on scroll → name fades in. Works on desktop + phone layouts, reduced-motion fallback. Spec: docs/chapters/00-prologue.md.

- **Film & Motion chapter v1** (docs/chapters/03-film.md): camera travels from the autograph to a scanned vintage 8mm camera, half orbit, 3D film strip unwinds, Pr/Ae tiles, then editing + motion text staged like editing software with Nabh's reel playing. The ink-trail skill rack was scrapped.

- **Screening chapter v1** (docs/chapters/04-screening.md): agency + client work projected by a scanned 8mm projector onto a plaster wall, three reels and credits.

- **Laptop chapter v1** (docs/chapters/05-laptop.md): film-strip wipe → a MacBook-Air-style laptop floats in → close-up of an AI chat where a question about Nabh is typed and answered. (Replaced the scrapped Denoise idea.)

- **Contact section** (`src/components/Contact.tsx`, `.ct-*` CSS): two-line about, email link, message form that posts to FormSubmit (no backend), autograph sign-off. Replaces the placeholder end section.

- **Glass navigation header** replaces Skip intro (Experience / Work / About / Contact).

## Live
- https://nabh-portfolio.netlify.app (Netlify site `nabh-portfolio`, id ae8b4359-dcd0-4325-8694-fa5d2dba7b27, account Nabh priya Gautam).
- Redeploy: `PATH="$HOME/.local/node/bin:$PATH" npm run build && npx netlify-cli deploy --dir=out --prod --site=ae8b4359-dcd0-4325-8694-fa5d2dba7b27`

## Code
- Public repo: https://github.com/Nabhpg/nabh-portfolio (branch main). Kept out via .gitignore: docs/PROFILE.md, assets-src/, .netlify/, .claude/.
- GitHub CLI lives at ~/.local/gh/bin/gh (logged in as Nabhpg). Commits use the GitHub noreply email.

## Run
`PATH="$HOME/.local/node/bin:$PATH" npm run dev` → http://localhost:3000

## Next
1. Nabh sends the first message through the contact form and clicks FormSubmit's one-time activation email (until then messages are not delivered).
2. Nabh reviews the whole site end to end by scrolling; collect tweaks.
3. Then: tighten scroll lengths, phone pass, performance pass, deploy, inner pages and admin.

## Open questions for Nabh
- Final intro/outro copy lines.
- Film chapter copy: is "four years of cutting for local businesses" accurate? Which other videos should appear?
- Public under own name for philosophy/poetry, or keep Nabh.pg separate?
- Site goal ranking: MS admissions / agency clients / Nabh.pg brand?
- Assets: 6–10 clips (3–6s, title/client/year), headshot, poems to publish, public links.
