"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { PHASE, SPLIT, SPLIT2, SPLIT3 } from "./phases";
import LaptopOverlay from "../laptop/LaptopOverlay";
import ScreeningOverlay from "../screening/ScreeningOverlay";
import FilmOverlay from "../film/FilmOverlay";

const PrologueScene = dynamic(() => import("./PrologueScene"), { ssr: false });

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);

/** Chapter 0 — a fountain pen is unveiled by a blade of light, then signs the page as you scroll. */
export default function Prologue() {
  const section = useRef<HTMLElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const outro = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const film = useRef(0);
  const screen = useRef(0);
  const laptop = useRef(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = section.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const span = r.height - window.innerHeight;
        const all = reduced ? 1 : span > 0 ? clamp01(-r.top / span) : 0;
        // dev aids (see docs): pin one chapter; everything before it is held at its end
        const pins = window as unknown as { __filmP?: number; __screenP?: number; __laptopP?: number };
        const has = (v?: number): v is number => typeof v === "number";
        const p = clamp01(all / SPLIT);
        const rk = has(pins.__laptopP) || has(pins.__screenP) ? 1 : has(pins.__filmP) ? pins.__filmP : clamp01((all - SPLIT) / (SPLIT2 - SPLIT));
        const sk = has(pins.__laptopP) ? 1 : has(pins.__screenP) ? pins.__screenP : has(pins.__filmP) ? 0 : clamp01((all - SPLIT2) / (SPLIT3 - SPLIT2));
        const dk = has(pins.__laptopP) ? pins.__laptopP : has(pins.__screenP) || has(pins.__filmP) ? 0 : clamp01((all - SPLIT3) / (1 - SPLIT3));
        progress.current = p; film.current = rk; screen.current = sk; laptop.current = dk;
        if (intro.current) intro.current.style.opacity = String(clamp01(1 - p / 0.03));
        if (outro.current) {
          const o = clamp01((p - PHASE.exit[0]) / 0.07) * clamp01(1 - rk / 0.04);
          outro.current.style.opacity = String(o);
          outro.current.style.transform = `translateY(${(1 - o) * 14}px)`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <section ref={section} aria-label="Prologue" className="relative bg-black" style={{ height: reduced ? "100svh" : "3100vh" }}>
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
        <PrologueScene progress={progress} film={film} screen={screen} laptop={laptop} reduced={reduced} />

        <div ref={intro} className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-7 pb-[7svh] text-center" style={{ opacity: reduced ? 0 : 1 }}>
          <p className="font-display text-[clamp(1.05rem,2.2vw,1.5rem)] italic text-stone-300/90">Every story begins with a name.</p>
          <div className="cue">
            <span className="cue-label">Scroll to begin</span>
            <span className="cue-track" aria-hidden><i className="cue-dot" /></span>
          </div>
        </div>

        <div ref={outro} className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-6 pb-[7svh] text-center" style={{ opacity: 0 }}>
          <h1 className="text-[clamp(0.7rem,1.5vw,0.95rem)] font-medium uppercase tracking-[0.55em] text-stone-200">Nabh Priya Gautam</h1>
          <p className="font-display text-[clamp(1.05rem,2.1vw,1.45rem)] italic text-stone-300">A portfolio site</p>
          <p className="-mt-1 font-display text-[clamp(0.9rem,1.6vw,1.1rem)] italic text-stone-500">(and the things I build)</p>
        </div>

        <FilmOverlay film={film} out={screen} />
        <ScreeningOverlay screen={screen} out={laptop} />
        <LaptopOverlay laptop={laptop} />
      </div>
    </section>
  );
}
