"use client";

import { useEffect, useRef, type RefObject } from "react";
import { FILM, ease, seg } from "./timeline";

/** The editing-software cursor that drags words into place. */
const Cursor = () => (
  <svg className="fo-cursor" viewBox="0 0 20 24" aria-hidden>
    <path d="M2 1.5v17l4.6-4.3 3 7 2.9-1.3-3-6.8H16z" fill="#f5f5f4" stroke="#0c0a09" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);
/** Layer bounding box with handles, as drawn around a selected layer. */
const Bounds = () => (
  <span className="fo-bounds" aria-hidden>
    <i /><i /><i /><i /><i /><i /><i /><i />
  </span>
);

/**
 * Film chapter, written part: what Nabh does as an editor and motion designer, staged like the inside of
 * the software he works in. Everything is driven by scroll through CSS variables set on the root.
 */
export default function FilmOverlay({ film, out }: { film: RefObject<number>; out: RefObject<number> }) {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const glow = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = root.current, f = film.current ?? 0, gone = ease(seg(out.current ?? 0, [0, 0.045]));
      if (el) {
        const set = (k: string, v: number) => el.style.setProperty(k, v.toFixed(4));
        const a = seg(f, FILM.beatA), b = seg(f, FILM.beatB);
        set("--cap", ease(seg(f, [0.44, 0.5])) * (1 - ease(seg(f, [0.58, 0.63]))));
        set("--dim", ease(seg(f, FILM.dim)));
        set("--mon", ease(seg(f, [0.62, 0.69])));
        // beat A — editing
        set("--a-in", ease(seg(a, [0, 0.16])) * (1 - ease(seg(a, [0.88, 1]))));
        set("--a-w", ease(seg(a, [0.14, 0.44])));
        set("--a-box", ease(seg(a, [0.1, 0.2])));
        set("--a-away", ease(seg(a, [0.46, 0.6])));
        set("--a-list", seg(a, [0.42, 0.8]));
        // beat B — motion
        set("--b-in", ease(seg(b, [0, 0.16])));
        set("--b-w", ease(seg(b, [0.14, 0.42])));
        set("--b-box", ease(seg(b, [0.1, 0.2])));
        set("--b-away", ease(seg(b, [0.44, 0.58])));
        set("--b-curve", ease(seg(b, [0.4, 0.85])));
        el.style.visibility = f > 0.4 && gone < 1 ? "visible" : "hidden";
        el.style.opacity = (1 - gone).toFixed(3);
        const want = f > 0.61 && gone < 1;
        for (const v of [video.current, glow.current]) {
          if (!v) continue;
          if (want && v.paused) v.play().catch(() => {});
          if (!want && !v.paused) v.pause();
        }
        // the halo is the same picture, blurred; keep it in step with the main one
        const v = video.current, g = glow.current;
        if (v && g && Math.abs(g.currentTime - v.currentTime) > 0.3) g.currentTime = v.currentTime;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [film, out]);

  return (
    <div ref={root} className="fo" style={{ visibility: "hidden" }}>
      <div className="fo-dim" />
      <div className="fo-tex" aria-hidden />

      <p className="fo-cap">
        <span>01</span> Film &amp; Motion
      </p>

      <div className="fo-stage">
        <div className="fo-copy">
          <article className="fo-beat fo-a">
            <p className="fo-kicker"><i className="fo-key" /> Video editing · Premiere Pro</p>
            <h2>
              I cut for{" "}
              <span className="fo-drag">feeling<Bounds /><Cursor /></span>{" "}
              first.
            </h2>
            <p className="fo-body">
              Years of editing for local businesses and my own page. Pace, sound and colour, shaped until the story lands in the first second.
            </p>
            <ul className="fo-clips">
              {["Pacing & rhythm", "Sound design", "Colour & grade", "Reels · ads · long-form"].map((t, i) => (
                <li key={t} style={{ "--i": i } as React.CSSProperties}>{t}</li>
              ))}
            </ul>
          </article>

          <article className="fo-beat fo-b">
            <p className="fo-kicker"><i className="fo-key" /> Motion graphics · After Effects</p>
            <h2>
              Then I make it{" "}
              <span className="fo-drag">move<Bounds /><Cursor /></span>.
            </h2>
            <p className="fo-body">
              Titles, kinetic type and explainer graphics built in After Effects, like the brain sequences in the reel beside this.
            </p>
            <div className="fo-graph" aria-hidden>
              <div className="fo-props">
                <span><i className="fo-key" /> Position</span>
                <span><i className="fo-key" /> Scale</span>
                <span><i className="fo-key" /> Opacity</span>
              </div>
              <svg viewBox="0 0 300 110" preserveAspectRatio="none">
                <path d="M0 27.5H300M0 55H300M0 82.5H300M75 0V110M150 0V110M225 0V110" className="fo-grid" />
                <path d="M12 96 C 120 96, 110 14, 288 14" pathLength={1} className="fo-curve" />
                <path d="M12 96 L 86 96 M288 14 L 214 14" className="fo-handle" />
                <rect x="7" y="91" width="10" height="10" transform="rotate(45 12 96)" className="fo-kf" />
                <rect x="283" y="9" width="10" height="10" transform="rotate(45 288 14)" className="fo-kf" />
              </svg>
            </div>
          </article>
        </div>

        <figure className="fo-monitor">
          <video ref={glow} className="fo-halo" src="/film/reel.mp4" muted loop playsInline preload="none" aria-hidden />
          <div className="fo-screen">
            <video ref={video} src="/film/reel.mp4" poster="/film/poster.jpg" muted loop playsInline preload="none" />
            <span className="fo-leak" aria-hidden />
            <span className="fo-grain" aria-hidden />
          </div>
          <span className="fo-gate" aria-hidden><i /><i /><i /><i /></span>
        </figure>
      </div>
    </div>
  );
}
