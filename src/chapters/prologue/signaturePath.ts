import data from "./signature.json";

/** Signature image space (pixels) → timeline the pen follows. */
export const SIG_W = data.width;
export const SIG_H = data.height;
/** World units per signature pixel. Signature is 6.4 × 4.8 world units. */
export const SIG_SCALE = 0.004;

type Pt = [number, number];
const strokes = data.strokes as Pt[][];

const cum: number[][] = [];
let drawnTotal = 0;
for (const s of strokes) {
  const c = [drawnTotal];
  for (let i = 1; i < s.length; i++) {
    drawnTotal += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
    c.push(drawnTotal);
  }
  cum.push(c);
}

/** Timeline = strokes (by length) with pen-lift gaps between them. */
type Seg =
  | { kind: "stroke"; i: number; t0: number; t1: number }
  | { kind: "gap"; from: Pt; to: Pt; drawn: number; t0: number; t1: number };
const segs: Seg[] = [];
let T = 0;
strokes.forEach((s, i) => {
  const len = cum[i][s.length - 1] - cum[i][0];
  segs.push({ kind: "stroke", i, t0: T, t1: T + len });
  T += len;
  if (i < strokes.length - 1) {
    const from = s[s.length - 1];
    const to = strokes[i + 1][0];
    const gap = 260 + 0.45 * Math.hypot(to[0] - from[0], to[1] - from[1]);
    segs.push({ kind: "gap", from, to, drawn: cum[i][s.length - 1], t0: T, t1: T + gap });
    T += gap;
  }
});

export const SIG_START: Pt = strokes[0][0];
export const SIG_END: Pt = strokes[strokes.length - 1][strokes[strokes.length - 1].length - 1];

const ease = (x: number) => x * x * (3 - 2 * x);

export type PenSample = { x: number; y: number; lift: number; drawn: number };

/** u in 0..1 over the whole writing timeline. Writes into `out` to avoid allocations. */
export function samplePen(u: number, out: PenSample): PenSample {
  const t = Math.min(Math.max(u, 0), 1) * T;
  let seg = segs[segs.length - 1];
  for (const s of segs) if (t <= s.t1) { seg = s; break; }
  if (seg.kind === "gap") {
    const f = (t - seg.t0) / (seg.t1 - seg.t0);
    const e = ease(f);
    out.x = seg.from[0] + (seg.to[0] - seg.from[0]) * e;
    out.y = seg.from[1] + (seg.to[1] - seg.from[1]) * e;
    out.lift = Math.sin(Math.PI * f);
    out.drawn = seg.drawn / drawnTotal;
    return out;
  }
  const s = strokes[seg.i];
  const c = cum[seg.i];
  const target = c[0] + (t - seg.t0);
  let lo = 0, hi = c.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= target) lo = m; else hi = m; }
  const f = c[hi] > c[lo] ? (target - c[lo]) / (c[hi] - c[lo]) : 0;
  out.x = s[lo][0] + (s[hi][0] - s[lo][0]) * f;
  out.y = s[lo][1] + (s[hi][1] - s[lo][1]) * f;
  out.lift = 0;
  out.drawn = target / drawnTotal;
  return out;
}

export const sigToWorldX = (px: number) => (px - SIG_W / 2) * SIG_SCALE;
export const sigToWorldY = (py: number) => (SIG_H / 2 - py) * SIG_SCALE;
