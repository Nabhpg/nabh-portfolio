import { CLIENTS, SHOW, ease, reelAt, seg } from "./timeline";
import { LITE } from "@/lib/quality";

const W = 1024, H = 576;
const SCALE = LITE ? 0.625 : 1;

/**
 * What the projector shows: title slates, client footage and the closing credits, painted to a canvas
 * every frame. The wall shader then treats that canvas as light.
 */
export class Programme {
  canvas = document.createElement("canvas");
  /** rough average colour of the current frame (0..1), for the beam and the light bouncing off the wall */
  avg: [number, number, number] = [0, 0, 0];
  private x: CanvasRenderingContext2D;
  private probe = document.createElement("canvas");
  private px: CanvasRenderingContext2D;
  private decor = new Image();
  private vids: HTMLVideoElement[] = [];
  private serif = "Georgia, serif";
  private sans = "Helvetica, Arial, sans-serif";
  private tick = 0;

  constructor() {
    // phones paint the picture at a lower resolution; layout below stays in 1024 × 576 units
    this.canvas.width = Math.round(W * SCALE); this.canvas.height = Math.round(H * SCALE);
    this.x = this.canvas.getContext("2d")!;
    this.probe.width = this.probe.height = 4;
    this.px = this.probe.getContext("2d", { willReadFrequently: true })!;
    this.decor.src = "/screening/decor.jpg";
    this.decor.decode?.().catch(() => {}); // decode now, not on the first frame it is drawn
    for (const src of ["/screening/hav1.mp4", "/screening/hav2.mp4"]) {
      const v = document.createElement("video");
      v.src = src; v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto";
      // start the decoder once, early, so the reel does not hitch when its footage comes up
      v.addEventListener("loadeddata", () => { v.play().then(() => v.pause()).catch(() => {}); }, { once: true });
      this.vids.push(v);
    }
    const css = getComputedStyle(document.documentElement);
    const d = css.getPropertyValue("--font-cormorant").trim(), g = css.getPropertyValue("--font-geist-sans").trim();
    if (d) this.serif = `${d}, Georgia, serif`;
    if (g) this.sans = `${g}, Helvetica, sans-serif`;
  }

  private text(t: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = "center", spacing = 0) {
    const c = this.x;
    c.font = font; c.fillStyle = color; c.textAlign = align; c.textBaseline = "middle";
    (c as unknown as { letterSpacing: string }).letterSpacing = `${spacing}px`;
    c.fillText(t, x, y);
  }

  private slate(i: number, p: number) {
    const c = this.x, cl = CLIENTS[i];
    c.fillStyle = "#0b0a09"; c.fillRect(0, 0, W, H);
    c.strokeStyle = "rgba(240,226,196,0.34)"; c.lineWidth = 1.5; c.strokeRect(38, 38, W - 76, H - 76);
    const a = ease(seg(p, [0.04, 0.3]));
    c.globalAlpha = a;
    this.text("MARKGENICS  ·  CLIENT WORK", W / 2, 92, `500 15px ${this.sans}`, "#b9a988", "center", 7);
    this.text(cl.name, W / 2, H / 2 - 14 + (1 - a) * 14, `italic 400 104px ${this.serif}`, "#f3e7cf");
    this.text(cl.role.toUpperCase(), W / 2, H / 2 + 74, `500 17px ${this.sans}`, "#cdbb95", "center", 6);
    this.text(`REEL 0${i + 1}`, 70, H - 74, `500 15px ${this.sans}`, "#b9a988", "left", 6);
    this.text(`0${i + 1} / 0${CLIENTS.length}`, W - 70, H - 74, `500 15px ${this.sans}`, "#b9a988", "right", 6);
    c.globalAlpha = 1;
  }

  private footage(i: number, p: number) {
    const c = this.x;
    if (i === 0 && this.decor.complete && this.decor.naturalWidth) {
      // their storefront, scrolled by your scroll
      const iw = this.decor.naturalWidth, vh = (iw * H) / W, max = this.decor.naturalHeight - vh;
      c.drawImage(this.decor, 0, ease(p) * max, iw, vh, 0, 0, W, H);
      return;
    }
    if (i === 1 && this.vids[0].readyState >= 2) {
      // two vertical ad films side by side, over a soft copy of the first
      if (LITE) { c.fillStyle = "#0d0b09"; c.fillRect(0, 0, W, H); } // a canvas blur every frame is too slow on phones
      else {
        c.filter = "blur(26px) brightness(0.45) saturate(1.2)";
        c.drawImage(this.vids[0], -40, -200, W + 80, ((W + 80) * 16) / 9);
        c.filter = "none";
      }
      const ph = H - 44, pw = (ph * 9) / 16, gap = 46, x0 = W / 2 - pw - gap / 2;
      this.vids.forEach((v, k) => { if (v.readyState >= 2) c.drawImage(v, x0 + k * (pw + gap), 22, pw, ph); });
      return;
    }
    // no footage on file for this client yet: the slate holds, with its one line
    this.slate(i, 1);
  }

  private credits(p: number) {
    const c = this.x;
    c.fillStyle = "#090807"; c.fillRect(0, 0, W, H);
    const rows: [string, string][] = [
      ["", "MARKGENICS"], ["", "Marketing, decoded."], ["", ""],
      ["CO-FOUNDER", "Nabh Priya Gautam"], ["CO-FOUNDER", "Mohd Shahzar"], ["BASED IN", "Delhi × Moradabad"], ["IN PRACTICE", "Five years"], ["", ""],
      ["CONTENT", "Instagram reels, carousels, stories"], ["BUILD", "Shopify & web development"], ["CUT", "Video editing"],
      ["MOTION", "Motion graphics"], ["FILM", "AI filmmaking & ad building"], ["GROWTH", "Performance ads"], ["", ""],
      ["", "Craft as a genuine pursuit,"], ["", "not just a service."],
    ];
    const lh = 54, y0 = H + 30 - ease(p) * (rows.length * lh + 60);
    rows.forEach(([k, v], r) => {
      const y = y0 + r * lh;
      if (y < -40 || y > H + 40) return;
      if (!k) { this.text(v, W / 2, y, r === 0 ? `500 34px ${this.sans}` : `italic 400 34px ${this.serif}`, "#f3e7cf", "center", r === 0 ? 16 : 0); return; }
      this.text(k, W / 2 - 22, y, `500 15px ${this.sans}`, "#a8997a", "right", 5);
      this.text(v, W / 2 + 22, y, `400 30px ${this.serif}`, "#f3e7cf", "left");
    });
  }

  /** Paint the frame for screening progress s. Returns true when the picture changed. */
  draw(s: number) {
    const c = this.x, { i, p } = reelAt(s);
    c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    const lamp = ease(seg(s, SHOW.lamp));
    const wantVideo = i === 1;
    for (const v of this.vids) {
      if (wantVideo && v.paused) v.play().catch(() => {});
      if (!wantVideo && !v.paused) v.pause();
    }
    if (lamp <= 0) { c.fillStyle = "#000"; c.fillRect(0, 0, W, H); }
    else if (i >= 0) { if (p < SHOW.slate) this.slate(i, p / SHOW.slate); else this.footage(i, (p - SHOW.slate) / (1 - SHOW.slate)); }
    else if (s >= SHOW.credits[0]) this.credits(seg(s, SHOW.credits));
    else if (s < SHOW.reels[0][0]) { c.fillStyle = "#e9dfca"; c.fillRect(0, 0, W, H); }  // bare lamp through an empty gate
    else { c.fillStyle = "#050505"; c.fillRect(0, 0, W, H); }                              // between reels
    if (this.tick++ % 8 === 0) {
      this.px.drawImage(this.canvas, 0, 0, 4, 4);
      const d = this.px.getImageData(0, 0, 4, 4).data;
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < d.length; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2]; }
      const n = (d.length / 4) * 255;
      this.avg = [r / n, g / n, b / n];
    }
  }
}
