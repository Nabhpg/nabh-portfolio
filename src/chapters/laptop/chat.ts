import { ANSWER, QUESTION, ease, seg } from "./timeline";

const W = 2048, H = 1330;

/** The laptop's screen: an AI chat window, painted to a canvas. q = 0..1 runs the exchange (type, send, answer). */
export class ChatScreen {
  canvas = document.createElement("canvas");
  private c: CanvasRenderingContext2D;
  private sans = "Helvetica, Arial, sans-serif";
  private last = -1;

  constructor() {
    this.canvas.width = W; this.canvas.height = H;
    this.c = this.canvas.getContext("2d")!;
    const g = getComputedStyle(document.documentElement).getPropertyValue("--font-geist-sans").trim();
    if (g) this.sans = `${g}, Helvetica, sans-serif`;
  }

  private rr(x: number, y: number, w: number, h: number, r: number) { this.c.beginPath(); this.c.roundRect(x, y, w, h, r); }
  private wrap(text: string, maxW: number) {
    const lines: string[] = []; let line = "";
    for (const word of text.split(" ")) {
      const t = line ? line + " " + word : word;
      if (this.c.measureText(t).width > maxW && line) { lines.push(line); line = word; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }

  /** Returns true if the picture changed. */
  draw(q: number, blink: boolean) {
    const key = Math.round(q * 4000) * 2 + (blink ? 1 : 0);
    if (key === this.last) return false;
    this.last = key;
    const c = this.c;
    const typed = QUESTION.slice(0, Math.round(QUESTION.length * seg(q, [0.04, 0.3])));
    const sent = q > 0.34, thinking = sent && q < 0.42;
    const words = ANSWER.join(" \n ").split(" "), shown = Math.round(words.length * seg(q, [0.42, 0.95]));

    // window
    const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#101114"); bg.addColorStop(1, "#0a0b0d");
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    // sidebar
    c.fillStyle = "#0c0d0f"; c.fillRect(0, 0, 330, H);
    c.fillStyle = "rgba(255,255,255,0.06)"; c.fillRect(330, 0, 2, H);
    c.textBaseline = "middle"; c.textAlign = "left";
    c.font = `500 26px ${this.sans}`; c.fillStyle = "#8d8a85"; c.fillText("Chats", 44, 96);
    [["About Nabh", true], ["Gradient descent, again", false], ["Shot list: short film", false], ["Notes on attention", false]].forEach(([t, on], i) => {
      const y = 160 + i * 66;
      if (on) { c.fillStyle = "rgba(241,214,164,0.09)"; this.rr(24, y - 28, 282, 56, 12); c.fill(); }
      c.font = `400 25px ${this.sans}`; c.fillStyle = on ? "#efe6d4" : "#77746f"; c.fillText(t as string, 44, y);
    });
    // header
    c.font = `500 26px ${this.sans}`; c.fillStyle = "#b9b5ae"; c.fillText("About Nabh", 392, 96);
    c.fillStyle = "#f1d6a4"; c.beginPath(); c.arc(W - 70, 96, 7, 0, Math.PI * 2); c.fill();
    c.textAlign = "right"; c.font = `400 22px ${this.sans}`; c.fillStyle = "#77746f"; c.fillText("online", W - 92, 96); c.textAlign = "left";

    const colX = 392 + (W - 392 - 1180) / 2, colW = 1180;
    let y = 210;
    if (sent) {
      // the question, sent
      c.font = `400 38px ${this.sans}`;
      const ql = this.wrap(QUESTION, 820), bw = Math.max(...ql.map((l) => c.measureText(l).width)) + 72, bh = ql.length * 54 + 44;
      c.fillStyle = "rgba(255,255,255,0.075)"; this.rr(colX + colW - bw, y, bw, bh, 30); c.fill();
      c.fillStyle = "#f2efe9"; ql.forEach((l, i) => c.fillText(l, colX + colW - bw + 36, y + 22 + 27 + i * 54));
      y += bh + 64;
      // the answer, arriving word by word
      c.fillStyle = "#f1d6a4"; c.save(); c.translate(colX + 16, y + 20); c.rotate(Math.PI / 4); c.fillRect(-11, -11, 22, 22); c.restore();
      c.font = `500 24px ${this.sans}`; c.fillStyle = "#a8a39b"; c.fillText("Assistant", colX + 48, y + 21);
      y += 74;
      if (thinking) {
        for (let i = 0; i < 3; i++) { c.globalAlpha = 0.35 + 0.65 * ease(seg(((q * 40 + i * 0.33) % 1), [0, 1])); c.fillStyle = "#cfc9c0"; c.beginPath(); c.arc(colX + 12 + i * 30, y + 14, 8, 0, Math.PI * 2); c.fill(); }
        c.globalAlpha = 1;
      } else {
        c.font = `400 40px ${this.sans}`; c.fillStyle = "#ebe7df";
        const paras = words.slice(0, shown).join(" ").split(" \n ");
        let endX = colX, endY = y;
        paras.forEach((para) => {
          const lines = this.wrap(para.replace("\n", "").trim(), colW - 40);
          lines.forEach((l) => { c.fillText(l, colX, y + 26); endX = colX + c.measureText(l).width; endY = y; y += 60; });
          y += 30;
        });
        if (shown < words.length && blink) { c.fillStyle = "#f1d6a4"; c.fillRect(endX + 10, endY + 6, 18, 40); }
      }
    }
    // input
    const iy = H - 190;
    c.fillStyle = "rgba(255,255,255,0.055)"; this.rr(colX, iy, colW, 104, 52); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.10)"; c.lineWidth = 2; this.rr(colX, iy, colW, 104, 52); c.stroke();
    c.font = `400 36px ${this.sans}`;
    if (!sent) {
      c.fillStyle = typed ? "#f2efe9" : "#6f6c67"; c.fillText(typed || "Ask anything", colX + 44, iy + 53);
      if (blink) { c.fillStyle = "#f1d6a4"; c.fillRect(colX + 44 + (typed ? c.measureText(typed).width + 6 : -10), iy + 30, 3, 46); }
    } else { c.fillStyle = "#6f6c67"; c.fillText("Ask a follow-up", colX + 44, iy + 53); }
    c.fillStyle = typed && !sent ? "#f1d6a4" : "rgba(255,255,255,0.12)"; c.beginPath(); c.arc(colX + colW - 56, iy + 52, 30, 0, Math.PI * 2); c.fill();
    c.strokeStyle = typed && !sent ? "#141210" : "#8d8a85"; c.lineWidth = 4; c.lineCap = "round"; c.beginPath();
    c.moveTo(colX + colW - 56, iy + 64); c.lineTo(colX + colW - 56, iy + 40); c.moveTo(colX + colW - 67, iy + 50); c.lineTo(colX + colW - 56, iy + 39); c.lineTo(colX + colW - 45, iy + 50); c.stroke();
    // camera housing
    c.fillStyle = "#000"; this.rr(W / 2 - 130, -30, 260, 72, 22); c.fill();
    return true;
  }
}
