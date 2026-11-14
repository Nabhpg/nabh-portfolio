"use client";

import { useEffect, useRef, type RefObject } from "react";
import { ANSWER, LAP, QUESTION, ease, seg } from "./timeline";

/** Chapter mark, plus the exchange as real text for screen readers and search (the visible copy lives on the laptop's screen). */
export default function LaptopOverlay({ laptop }: { laptop: RefObject<number> }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const x = laptop.current ?? 0, el = root.current;
      if (el) {
        el.style.visibility = x > LAP.cut ? "visible" : "hidden";
        el.style.opacity = (ease(seg(x, [0.14, 0.24])) * (1 - 0.6 * ease(seg(x, LAP.push)))).toFixed(3);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [laptop]);
  return (
    <div ref={root} className="lp" style={{ visibility: "hidden" }}>
      <p className="lp-mark"><span>03</span> What comes next</p>
      <div className="lp-sr">
        <p>{QUESTION}</p>
        {ANSWER.map((a) => <p key={a}>{a}</p>)}
      </div>
    </div>
  );
}
