"use client";

import { useEffect, useRef, type RefObject } from "react";
import { CLIENTS, SHOW, ease, seg } from "./timeline";
import { styleWriter } from "@/lib/styleWriter";

/**
 * Words over the screening: who the client is, what was done, where to see it. The slates and credits are
 * part of the projected picture; this layer carries the same facts as real text and real links.
 */
export default function ScreeningOverlay({ screen, out }: { screen: RefObject<number>; out: RefObject<number> }) {
  const root = useRef<HTMLDivElement>(null);
  const caps = useRef<(HTMLElement | null)[]>([]);
  const end = useRef<HTMLElement>(null), intro = useRef<HTMLElement>(null);

  useEffect(() => {
    let raf = 0;
    const writers = new Map<HTMLElement, ReturnType<typeof styleWriter>>();
    const w = (el: HTMLElement) => { let f = writers.get(el); if (!f) { f = styleWriter(el); writers.set(el, f); } return f; };
    const tick = () => {
      const s = screen.current ?? 0, el = root.current;
      if (el) {
        const gone = ease(seg(out.current ?? 0, [0, 0.06])), r = w(el);
        r("visibility", s > 0.05 && gone < 1 ? "visible" : "hidden");
        r("opacity", 1 - gone);
        r("--mark", ease(seg(s, [0.16, 0.22])));
        SHOW.reels.forEach(([a, b], i) => {
          const c = caps.current[i]; if (!c) return;
          const p = (s - a) / (b - a);
          const o = ease(seg(p, [SHOW.slate + 0.04, SHOW.slate + 0.16])) * (1 - ease(seg(p, [0.9, 0.99]))), cw = w(c);
          cw("opacity", o);
          cw("transform", `translateY(${((1 - o) * 12).toFixed(1)}px)`);
          cw("pointerEvents", o > 0.6 ? "auto" : "none");
        });
        if (intro.current) {
          // said once, as the projector warms up, before the first reel
          const o = ease(seg(s, [0.1, 0.16])) * (1 - ease(seg(s, [0.215, 0.25]))), iw = w(intro.current);
          iw("opacity", o);
          iw("transform", `translateY(${((1 - o) * 12).toFixed(1)}px)`);
        }
        if (end.current) {
          const o = ease(seg(s, [0.93, 0.99])), ew = w(end.current);
          ew("opacity", o);
          ew("pointerEvents", o > 0.6 ? "auto" : "none");
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [screen, out]);

  return (
    <div ref={root} className="so" style={{ visibility: "hidden" }}>
      <p className="so-mark"><span>02</span> Markgenics <i>· the agency, screened</i></p>
      <article ref={intro} className="so-cap" style={{ opacity: 0 }}>
        <p className="so-kicker">Markgenics</p>
        <h3>I co-founded a freelancing agency.</h3>
        <p className="so-line">This is some of the work we have made for our clients.</p>
      </article>
      {CLIENTS.map((c, i) => (
        <article key={c.name} ref={(el) => { caps.current[i] = el; }} className="so-cap" style={{ opacity: 0 }}>
          <p className="so-kicker">Reel 0{i + 1} · {c.role}</p>
          <h3>{c.name}</h3>
          <p className="so-line">{c.line}</p>
          {c.links.length > 0 && (
            <p className="so-links">
              {c.links.map(([label, href]) => (
                <a key={href} href={href} target="_blank" rel="noreferrer">{label} <span aria-hidden>↗</span></a>
              ))}
            </p>
          )}
        </article>
      ))}
      <article ref={end} className="so-cap so-end" style={{ opacity: 0 }}>
        <p className="so-kicker">Co-founded with Mohd Shahzar · Delhi × Moradabad</p>
        <p className="so-links"><a href="https://markgenics-180.netlify.app/" target="_blank" rel="noreferrer">Visit Markgenics <span aria-hidden>↗</span></a></p>
      </article>
    </div>
  );
}
