// Turns the autograph photo into a clean ink mask (white ink, alpha = ink density).
import sharp from "sharp";
const src = "assets-src/autograph.jpg";
const W = 1600, H = 1200;
const gray = await sharp(src).resize(W, H).greyscale().raw().toBuffer();
const bg = await sharp(src).resize(W, H).greyscale().blur(40).raw().toBuffer();
const a = Buffer.alloc(W * H);
for (let i = 0; i < W * H; i++) {
  const d = bg[i] - gray[i];            // darker than local background = ink
  a[i] = Math.max(0, Math.min(255, (d - 28) * 6));
}
// kill faint pencil ghosts at the bottom (low contrast) — handled by the threshold above
const rgba = Buffer.alloc(W * H * 4, 255);
for (let i = 0; i < W * H; i++) rgba[i * 4 + 3] = a[i];
await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toFile("public/signature/ink.png");
await sharp(a, { raw: { width: W, height: H, channels: 1 } }).png().toFile("assets-src/ink-alpha.png");
// preview: ink black on white with a 100px grid for tracing
const lines = [];
for (let x = 0; x <= W; x += 100) lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#f00" stroke-opacity=".35"/><text x="${x+3}" y="14" font-size="16" fill="#c00">${x}</text>`);
for (let y = 0; y <= H; y += 100) lines.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#00f" stroke-opacity=".35"/><text x="3" y="${y-3}" font-size="16" fill="#00c">${y}</text>`);
const inv = Buffer.from(a.map(v => 255 - v));
await sharp(inv, { raw: { width: W, height: H, channels: 1 } })
  .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${lines.join("")}</svg>`) }])
  .png().toFile("assets-src/preview-grid.png");
