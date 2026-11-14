# Nabh Priya Gautam — Personal Portfolio

Personal site for Nabh (CSE student, Chandigarh University; video editor, philosopher, poet, marketer, builder).
Home page = cinematic 3D scroll journey "through my mind". Inner pages = calm, detailed.

## Read order (load ONLY what the task needs)
1. `docs/STATE.md` — where we are, what's next. **Always read first.**
2. `docs/VISION.md` — home-page concept, chapters, visual language, stack.
3. `docs/DECISIONS.md` — settled decisions. Do not re-debate these.
4. `docs/PROFILE.md` — who Nabh is (condensed). Read only for copy/content work.
5. `docs/chapters/NN-*.md` — spec for the chapter being built. Read only the one in play.

## Rules
- Nabh wants concise, point-form, brutally honest answers. Hinglish is fine.
- Never claim engineering depth he doesn't have. Lead with creative + business work.
- Show only finished things on the site.
- Quality bar: top 0.1% portfolio. Awe on home, sobriety elsewhere. Performance is part of awe.

## Context-saving workflow (follow every session)
- One session = one focused task (e.g. "build film reel scene"). Start new sessions for new chapters.
- Start: read `STATE.md`, then only the files the task needs. Don't read whole codebase.
- Use `grep`/targeted reads with line ranges, not full-file reads of big files.
- Delegate wide searches / research to a subagent; keep only the conclusion.
- End of every session: update `STATE.md` (done / next / open questions) and append to `DECISIONS.md`.
- Keep docs short. Replace stale lines; don't append history to STATE.md.
- Each chapter = isolated module in `src/chapters/<name>/` so work on one never needs the others in context.
