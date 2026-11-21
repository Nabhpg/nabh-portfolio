"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import { PHASE, SPLIT, SPLIT2, SPLIT3 } from "./phases";
import LaptopOverlay from "../laptop/LaptopOverlay";
import ScreeningOverlay from "../screening/ScreeningOverlay";
import FilmOverlay from "../film/FilmOverlay";
import { loading } from "@/lib/loading";
import { styleWriter } from "@/lib/styleWriter";

const PrologueScene = dynamic(() => import("./PrologueScene"), { ssr: false });

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);

/** Chapter 0 — a fountain pen is unveiled by a blade of light, then signs the page as you scroll. */
export default function Prologue() {
  // the opening's two textures are fetched with the page, not after the 3D bundle arrives
  preload("/signature/ink.png", { as: "image", fetchPriority: "high" });
  preload("/signature/time.png", { as: "image", fetchPriority: "high" });
  const section = useRef<HTMLElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const outro = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const film = useRef(0);
  const screen = useRef(0);
  const laptop = useRef(0);
  const [reduced, setReduced] = useState(false);
  const [running, setRunning] = useState(true);
  const [load, setLoad] = useState({ p: 0, ready: false });

  // the film's load state: a quiet percentage under the opening line, and the page holds still until it is ready
  // Scroll opens when the whole film is ready (its one-time GPU warm-up then happens behind the loader), or, on a
  // slow connection, a few seconds after the opening itself is ready, so nobody waits long on a black screen.
  useEffect(() => {
    let grace: ReturnType<typeof setTimeout> | undefined;
    const off = loading.on((p, intro, ready) => {
      if (intro && !ready && !grace) grace = setTimeout(() => setLoad((l) => ({ ...l, ready: true })), 4000);
      setLoad((l) => (l.ready ? l : ready ? { p: 1, ready: true } : Math.abs(l.p - p) < 0.01 ? l : { p, ready: false }));
    });
    return () => { off(); if (grace) clearTimeout(grace); };
  }, []);
  useEffect(() => {
    if (load.ready) return;
    const lenis = (window as unknown as { __lenis?: { stop(): void; start(): void } }).__lenis;
    const html = document.documentElement;
    html.style.overflow = "hidden"; lenis?.stop();
    const giveUp = setTimeout(() => setLoad((l) => ({ ...l, ready: true })), 12000); // never hold the page hostage to a slow connection
    return () => { clearTimeout(giveUp); html.style.overflow = ""; lenis?.start(); };
  }, [load.ready]);

  // no frames are drawn while the film is off screen (e.g. on the contact form)
  useEffect(() => {
    const el = section.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => setRunning(e.isIntersecting), { rootMargin: "200px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    let raf = 0, smooth = -1, last = performance.now();
    // touch scrolling arrives in uneven steps; on phones the film follows a smoothed position instead
    // (desktop is already smoothed by Lenis). Big jumps, like the header links, are taken at once.
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const wIntro = intro.current ? styleWriter(intro.current) : null, wOutro = outro.current ? styleWriter(outro.current) : null;
    const tick = (now: number) => {
      const el = section.current;
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      if (el) {
        const r = el.getBoundingClientRect();
        const span = r.height - window.innerHeight;
        const raw = reduced ? 1 : span > 0 ? clamp01(-r.top / span) : 0;
        smooth = smooth < 0 || !touch || Math.abs(raw - smooth) > 0.03 ? raw : smooth + (raw - smooth) * (1 - Math.exp(-dt * 12));
        const all = smooth;
        // dev aids (see docs): pin one chapter; everything before it is held at its end
        const pins = window as unknown as { __filmP?: number; __screenP?: number; __laptopP?: number };
        const has = (v?: number): v is number => typeof v === "number";
        const p = clamp01(all / SPLIT);
        const rk = has(pins.__laptopP) || has(pins.__screenP) ? 1 : has(pins.__filmP) ? pins.__filmP : clamp01((all - SPLIT) / (SPLIT2 - SPLIT));
        const sk = has(pins.__laptopP) ? 1 : has(pins.__screenP) ? pins.__screenP : has(pins.__filmP) ? 0 : clamp01((all - SPLIT2) / (SPLIT3 - SPLIT2));
        const dk = has(pins.__laptopP) ? pins.__laptopP : has(pins.__screenP) || has(pins.__filmP) ? 0 : clamp01((all - SPLIT3) / (1 - SPLIT3));
        progress.current = p; film.current = rk; screen.current = sk; laptop.current = dk;
        wIntro?.("opacity", clamp01(1 - p / 0.03));
        if (wOutro) {
          const o = clamp01((p - PHASE.exit[0]) / 0.07) * clamp01(1 - rk / 0.04);
          wOutro("opacity", o);
          wOutro("transform", `translateY(${((1 - o) * 14).toFixed(1)}px)`);
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
        <PrologueScene progress={progress} film={film} screen={screen} laptop={laptop} reduced={reduced} running={running} />

        <div ref={intro} className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-7 pb-[7svh] text-center" style={{ opacity: reduced ? 0 : 1 }}>
          <p className="font-display text-[clamp(1.05rem,2.2vw,1.5rem)] italic text-stone-300/90">Every story begins with a name.</p>
          <div className={`cue${load.ready ? "" : " cue-loading"}`} role="status" aria-live="polite">
            <span className="cue-label">{load.ready ? "Scroll to begin" : `Loading ${Math.round(load.p * 100)}%`}</span>
            <span className="cue-track" aria-hidden><i className="cue-dot" /><i className="cue-fill" style={{ transform: `scaleY(${load.ready ? 1 : load.p})` }} /></span>
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
