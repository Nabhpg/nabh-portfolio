"use client";

import { useEffect, useRef, useState } from "react";
import { SPLIT, SPLIT2, SPLIT3 } from "@/chapters/prologue/phases";

/**
 * Where each link lands, as a fraction of the opening's scroll length (it is one long pinned section),
 * and where its part of the site begins (for highlighting the current link).
 */
const LINKS = [
  { id: "experience", label: "Experience", at: SPLIT + (SPLIT2 - SPLIT) * 0.66, from: SPLIT },   // editing & motion
  { id: "work", label: "Work", at: SPLIT2 + (SPLIT3 - SPLIT2) * 0.2, from: SPLIT2 },             // the projector: client work
  { id: "about", label: "About", at: SPLIT3 + (1 - SPLIT3) * 0.62, from: SPLIT3 },                // the laptop
  { id: "contact", label: "Contact", at: -1, from: 2 },
] as const;

type LenisLike = { scrollTo: (y: number, o?: { immediate?: boolean }) => void };

/** Floating glass navigation. Jumps are instant behind a brief fade, since scrolling through the scenes at speed would be a blur. */
export default function SiteHeader() {
  const [active, setActive] = useState(-1);
  const [veil, setVeil] = useState(false);
  const [open, setOpen] = useState(false); // the phone menu
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const section = () => document.querySelector<HTMLElement>('section[aria-label="Prologue"]');
  const span = (el: HTMLElement) => el.offsetHeight - window.innerHeight;

  useEffect(() => {
    const onScroll = () => {
      setOpen(false);
      const el = section(), contact = document.getElementById("contact");
      if (!el) return;
      if (contact && contact.getBoundingClientRect().top < window.innerHeight * 0.5) return setActive(3);
      const all = span(el) > 0 ? (window.scrollY - el.offsetTop) / span(el) : 0;
      setActive(all >= SPLIT3 ? 2 : all >= SPLIT2 ? 1 : all >= SPLIT ? 0 : -1);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (timer.current) clearTimeout(timer.current); };
  }, []);

  const go = (i: number) => {
    setOpen(false);
    const el = section(), contact = document.getElementById("contact");
    const y = i < 0 ? 0 : LINKS[i].at < 0 || !el || span(el) <= 0 ? (contact ? contact.offsetTop : 0) : el.offsetTop + LINKS[i].at * span(el);
    setVeil(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const lenis = (window as unknown as { __lenis?: LenisLike }).__lenis;
      if (lenis) lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
      timer.current = setTimeout(() => setVeil(false), 520);
    }, 260);
  };

  return (
    <>
      <div className={`nav-veil${veil ? " on" : ""}`} aria-hidden />
      <header className={`nav${open ? " open" : ""}`}>
        <button className="nav-brand" onClick={() => go(-1)} aria-label="Nabh Priya Gautam — back to the top">
          <span className="nav-full">Nabh Priya Gautam</span><span className="nav-short">Nabh Priya Gautam</span>
        </button>
        {/* phones: the current section's name and a menu button; the links open in a glass panel below */}
        <button className="nav-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="nav-links" aria-label={open ? "Close menu" : "Open menu"}>
          <span className="nav-now">{active >= 0 ? LINKS[active].label : "Menu"}</span>
          <span className="nav-burger" aria-hidden><i /><i /></span>
        </button>
        <nav id="nav-links" aria-label="Sections">
          {LINKS.map((l, i) => (
            <button key={l.id} onClick={() => go(i)} className={active === i ? "on" : undefined} aria-current={active === i ? "true" : undefined}>{l.label}</button>
          ))}
        </nav>
      </header>
    </>
  );
}
