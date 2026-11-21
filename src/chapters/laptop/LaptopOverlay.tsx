"use client";

import { useEffect, useRef, type RefObject } from "react";
import { ANSWER, LAP, QUESTION, ease, seg } from "./timeline";
import { styleWriter } from "@/lib/styleWriter";

const WORDS = ANSWER.map((a) => a.split(" "));
const TOTAL = WORDS.reduce((n, w) => n + w.length, 0);

/**
 * Chapter mark; on tall (phone) screens, the conversation itself, drawn by the page so it is crisp and readable
 * (wide screens read it on the laptop's 3D screen); and the exchange as real text for screen readers and search.
 */
export default function LaptopOverlay({ laptop }: { laptop: RefObject<number> }) {
  const root = useRef<HTMLDivElement>(null), chat = useRef<HTMLDivElement>(null), mark = useRef<HTMLParagraphElement>(null), ph = useRef<HTMLSpanElement>(null);
  const typed = useRef<HTMLSpanElement>(null), input = useRef<HTMLDivElement>(null), asked = useRef<HTMLParagraphElement>(null);
  const reply = useRef<HTMLDivElement>(null), dots = useRef<HTMLDivElement>(null);
  const paras = useRef<(HTMLParagraphElement | null)[]>([]);

  useEffect(() => {
    let raf = 0, lastTyped = -1, lastShown = -1;
    const setRoot = root.current ? styleWriter(root.current) : null;
    const setChat = chat.current ? styleWriter(chat.current) : null;
    const setMark = mark.current ? styleWriter(mark.current) : null;
    const tick = () => {
      const x = laptop.current ?? 0;
      setRoot?.("visibility", x > LAP.cut ? "visible" : "hidden");
      setRoot?.("opacity", ease(seg(x, [0.14, 0.24])));
      setMark?.("opacity", 1 - 0.6 * ease(seg(x, LAP.push)));
      const tall = window.innerWidth < window.innerHeight;
      if (setChat) {
        // the card lifts out of the laptop's screen: it starts as the screen's own shape and grows to full size,
        // then its contents fade up once the shape has settled
        const e = tall ? ease(seg(x, [LAP.push[1] - 0.09, LAP.push[1] + 0.02])) : 0;
        const o = e;
        setChat("--e", e);
        setChat("--c", ease(seg(e, [0.55, 1])));
        setChat("visibility", e > 0.001 ? "visible" : "hidden");
        if (o > 0.001) {
          const q = seg(x, LAP.chat);
          const n = Math.round(QUESTION.length * seg(q, [0.04, 0.3])), sent = q > 0.34, thinking = sent && q < 0.42;
          const shown = Math.round(TOTAL * seg(q, [0.42, 0.95]));
          const t = sent ? 0 : n;
          if (t !== lastTyped && typed.current) { lastTyped = t; typed.current.textContent = QUESTION.slice(0, t); }
          if (ph.current) ph.current.textContent = sent ? "Ask a follow-up" : "Ask anything";
          input.current?.classList.toggle("typing", !sent && n > 0);
          asked.current?.classList.toggle("on", sent);
          reply.current?.classList.toggle("on", sent);
          dots.current?.classList.toggle("on", thinking);
          if (shown !== lastShown) {
            lastShown = shown;
            let left = shown;
            WORDS.forEach((w, i) => {
              const p = paras.current[i]; if (!p) return;
              const k = Math.max(0, Math.min(w.length, left)); left -= w.length;
              p.textContent = w.slice(0, k).join(" ");
              p.classList.toggle("caret", k > 0 && k < w.length || (k === w.length && left < 0 && i === WORDS.length - 1 && shown < TOTAL));
            });
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [laptop]);

  return (
    <div ref={root} className="lp" style={{ visibility: "hidden" }}>
      <div ref={chat} className="lp-chat" aria-hidden style={{ visibility: "hidden" }}>
        <div className="lp-bar"><span>About Nabh</span><span className="lp-online"><i /> online</span></div>
        <div className="lp-thread">
          <p ref={asked} className="lp-q">{QUESTION}</p>
          <div ref={reply} className="lp-a">
            <p className="lp-who"><i /> Assistant</p>
            <div ref={dots} className="lp-dots"><i /><i /><i /></div>
            {ANSWER.map((a, i) => <p key={a} ref={(el) => { paras.current[i] = el; }} />)}
          </div>
        </div>
        <div ref={input} className="lp-input"><span ref={typed} /><span ref={ph} className="lp-ph">Ask anything</span><b aria-hidden>↑</b></div>
      </div>
      <p ref={mark} className="lp-mark"><span>03</span> What comes next</p>
      <div className="lp-sr">
        <p>{QUESTION}</p>
        {ANSWER.map((a) => <p key={a}>{a}</p>)}
      </div>
    </div>
  );
}
