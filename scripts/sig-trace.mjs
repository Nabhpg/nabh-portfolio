// Traces the autograph into ordered centerline strokes.
// Rough hand-placed waypoints (writing order) are routed along the ink skeleton.
import sharp from "sharp";
import fs from "node:fs";
const W = 1600, H = 1200;
const alpha = await sharp("assets-src/ink-alpha.png").extractChannel(0).raw().toBuffer();
const ink = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) ink[i] = alpha[i] > 110 ? 1 : 0;

// --- Zhang–Suen thinning ---
const sk = Uint8Array.from(ink);
const idx = (x, y) => y * W + x;
let changed = true;
while (changed) {
  changed = false;
  for (const pass of [0, 1]) {
    const del = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (!sk[idx(x, y)]) continue;
      const p2 = sk[idx(x, y - 1)], p3 = sk[idx(x + 1, y - 1)], p4 = sk[idx(x + 1, y)], p5 = sk[idx(x + 1, y + 1)],
        p6 = sk[idx(x, y + 1)], p7 = sk[idx(x - 1, y + 1)], p8 = sk[idx(x - 1, y)], p9 = sk[idx(x - 1, y - 1)];
      const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
      if (B < 2 || B > 6) continue;
      const s = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
      let A = 0; for (let k = 0; k < 8; k++) if (!s[k] && s[k + 1]) A++;
      if (A !== 1) continue;
      if (pass === 0) { if (p2 * p4 * p6 || p4 * p6 * p8) continue; }
      else { if (p2 * p4 * p8 || p2 * p6 * p8) continue; }
      del.push(idx(x, y));
    }
    if (del.length) { changed = true; for (const i of del) sk[i] = 0; }
  }
}

// --- waypoints, in writing order ---
const strokes = [
  // 1: opening flick, rise into the tall loop, bowl, long descender
  [[277,503],[250,523],[215,572],[188,632],[196,624],[230,570],[262,516],[285,506],[300,514],[330,515],[365,490],[400,455],[440,420],[470,395],[505,350],[540,310],[600,240],[650,172],[678,138],[672,128],[655,135],[620,175],[600,200],[550,270],[500,350],[470,400],[430,480],[400,550],[390,585],[400,605],[430,610],[470,598],[510,575],[555,540],[510,578],[450,650],[395,715],[300,840],[230,950],[180,1040],[155,1100],[152,1140],[165,1155]],
  // 2: "au", tall second loop, descender with return hook
  [[645,537],[625,535],[605,548],[592,575],[590,598],[600,607],[620,592],[638,570],[645,545],[646,570],[650,588],[660,587],[675,570],[688,548],[688,575],[695,592],[710,585],[725,565],[735,543],[735,570],[745,590],[765,596],[790,590],[810,578],[830,562],[850,545],[870,525],[900,490],[935,445],[975,400],[1005,350],[1030,305],[1038,288],[1020,300],[990,340],[960,380],[945,400],[905,465],[850,558],[800,625],[770,655],[700,780],[650,850],[600,920],[550,985],[520,1030],[510,1050],[525,1058],[560,1035],[600,1000],[640,965],[660,952]],
  // 3: crossbar
  [[730,485],[745,488],[800,480],[900,458],[1000,435],[1100,415],[1150,410],[1180,413]],
  // 4: "a" and the tail
  [[1018,530],[990,535],[965,560],[958,583],[970,590],[990,578],[1015,560],[1027,552],[1032,568],[1050,568],[1100,553],[1150,540],[1200,522],[1250,512],[1300,500],[1350,487],[1368,485],[1345,475]],
  // 5: underline flourish
  [[72,752],[78,765],[100,767],[200,752],[400,716],[600,680],[780,648],[1000,612],[1200,582],[1350,567],[1415,562]],
];

function snap([x, y], r = 14) {
  let best = null, bd = 1e9;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const X = Math.round(x) + dx, Y = Math.round(y) + dy;
    if (X < 0 || Y < 0 || X >= W || Y >= H || !sk[idx(X, Y)]) continue;
    const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [X, Y]; }
  }
  return best;
}
function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1;
  let t = ((px - ax) * vx + (py - ay) * vy) / l2; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}
// Dijkstra along skeleton between a and b, penalising drift from the straight chord
function route(a, b) {
  const sa = snap(a), sb = snap(b);
  const straight = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (!sa || !sb) return null;
  const dist = new Map(), prev = new Map(); const start = idx(...sa), goal = idx(...sb);
  const heap = [[0, start]]; dist.set(start, 0);
  const lim = straight * 2.2 + 40;
  while (heap.length) {
    let mi = 0; for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[mi][0]) mi = i;
    const [d, u] = heap.splice(mi, 1)[0];
    if (u === goal) break; if (d > dist.get(u)) continue;
    const ux = u % W, uy = (u / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const vx = ux + dx, vy = uy + dy;
      if (vx < 0 || vy < 0 || vx >= W || vy >= H || !sk[idx(vx, vy)]) continue;
      const pen = segDist(vx, vy, a[0], a[1], b[0], b[1]);
      if (pen > 30) continue;
      const nd = d + Math.hypot(dx, dy) * (1 + pen * 0.15);
      const v = idx(vx, vy);
      if (nd < (dist.get(v) ?? 1e9) && nd < lim * 4) { dist.set(v, nd); prev.set(v, u); heap.push([nd, v]); }
    }
  }
  if (!prev.has(goal) && goal !== start) return null;
  const out = []; let c = goal; while (c !== undefined) { out.push([c % W, (c / W) | 0]); c = prev.get(c); }
  out.reverse();
  let len = 0; for (let i = 1; i < out.length; i++) len += Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]);
  if (len > straight * 1.7 + 25) return null;
  return out;
}
const smooth = (pts, k) => pts.map((_, i) => {
  let sx = 0, sy = 0, n = 0;
  for (let j = Math.max(0, i - k); j <= Math.min(pts.length - 1, i + k); j++) { sx += pts[j][0]; sy += pts[j][1]; n++; }
  return i === 0 || i === pts.length - 1 ? pts[i] : [sx / n, sy / n];
});
function resample(pts, step) {
  const out = [pts[0]]; let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    let [ax, ay] = pts[i - 1]; const [bx, by] = pts[i]; let seg = Math.hypot(bx - ax, by - ay);
    while (carry + seg >= step) { const t = (step - carry) / seg; ax += (bx - ax) * t; ay += (by - ay) * t; out.push([ax, ay]); seg = Math.hypot(bx - ax, by - ay); carry = 0; }
    carry += seg;
  }
  out.push(pts[pts.length - 1]); return out;
}

const result = []; let fallbacks = 0;
for (const wp of strokes) {
  let pts = [];
  for (let i = 1; i < wp.length; i++) {
    const r = route(wp[i - 1], wp[i]);
    if (r) pts.push(...r); else { fallbacks++; console.log("fallback", wp[i - 1].join(","), wp[i].join(",")); pts.push(snap(wp[i - 1], 6) ?? wp[i - 1], snap(wp[i], 6) ?? wp[i]); }
  }
  pts = resample(smooth(resample(pts, 2), 5), 5).map(([x, y]) => [+x.toFixed(1), +y.toFixed(1)]);
  result.push(pts);
}
// coverage: how much ink lies within the reveal brush of the traced path
const BRUSH = 13; const cov = new Uint8Array(W * H);
for (const s of result) for (const [x, y] of s) for (let dy = -BRUSH; dy <= BRUSH; dy++) for (let dx = -BRUSH; dx <= BRUSH; dx++) {
  if (dx * dx + dy * dy > BRUSH * BRUSH) continue; const X = Math.round(x) + dx, Y = Math.round(y) + dy;
  if (X >= 0 && Y >= 0 && X < W && Y < H) cov[idx(X, Y)] = 1;
}
let tot = 0, hit = 0; for (let i = 0; i < W * H; i++) if (ink[i]) { tot++; if (cov[i]) hit++; }
console.log("strokes", result.map(s => s.length), "fallbacks", fallbacks, "ink coverage", (hit / tot * 100).toFixed(1) + "%");

fs.mkdirSync("src/chapters/prologue", { recursive: true });
fs.writeFileSync("src/chapters/prologue/signature.json", JSON.stringify({ width: W, height: H, strokes: result }));

// debug overlay: ink grey, strokes coloured, start dots, uncovered ink red
const cols = ["#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4"];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` + result.map((s, i) =>
  `<polyline points="${s.map(p => p.join(",")).join(" ")}" fill="none" stroke="${cols[i]}" stroke-width="3"/><circle cx="${s[0][0]}" cy="${s[0][1]}" r="9" fill="${cols[i]}"/><text x="${s[0][0] + 12}" y="${s[0][1] - 8}" font-size="26" fill="${cols[i]}">${i + 1}</text>`).join("") + `</svg>`;
const base = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) { const miss = ink[i] && !cov[i]; base[i * 3] = miss ? 255 : ink[i] ? 190 : 255; base[i * 3 + 1] = miss ? 0 : ink[i] ? 190 : 255; base[i * 3 + 2] = miss ? 0 : ink[i] ? 190 : 255; }
await sharp(base, { raw: { width: W, height: H, channels: 3 } }).composite([{ input: Buffer.from(svg) }]).png().toFile("assets-src/trace-debug.png");

// --- draw-order map: for every pixel near the path, when (0..1 of drawn length) the pen reaches it ---
{
  let total = 0; const cum = [];
  for (const s of result) { const c = [total]; for (let i = 1; i < s.length; i++) { total += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]); c.push(total); } cum.push(c); }
  const R = 18, NEAR = 5.5, best = new Float32Array(W * H).fill(1e9), tmap = new Float32Array(W * H).fill(-1);
  result.forEach((s, si) => s.forEach(([x, y], pi) => {
    const t = cum[si][pi] / total;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const d = dx * dx + dy * dy; if (d > R * R) continue;
      const X = Math.round(x) + dx, Y = Math.round(y) + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const i = idx(X, Y);
      // inside the pen's own line width the FIRST pass wins (so shared/crossing ink never flickers); beyond it, nearest wins
      if (d <= NEAR * NEAR) { if (best[i] > NEAR * NEAR || tmap[i] < 0) { best[i] = d; tmap[i] = t; } }
      else if (d < best[i]) { best[i] = d; tmap[i] = t; }
    }
  }));
  const out = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) if (tmap[i] >= 0) { const v = Math.round(tmap[i] * 65535); out[i * 3] = v >> 8; out[i * 3 + 1] = v & 255; out[i * 3 + 2] = 255; }
  await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 9 }).toFile("public/signature/time.png");
  console.log("time map written, drawn length", total.toFixed(0));
}
