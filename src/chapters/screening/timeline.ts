import * as THREE from "three";
import { CINE } from "../film/timeline";

/** The 8mm projector stands on the desk south-east of the cine camera and throws its picture on the wall behind the desk. */
export const PJ = new THREE.Vector3(24, -17, 0);
export const PJ_SCALE = 27; // same scale as the cine camera (model is in metres)
/** Lens, in world space (model lens ≈ (-0.055, 0.075, 0.14) m; model +z points south after standing it up). */
export const LENS = new THREE.Vector3(PJ.x - 1.5, PJ.y - 3.8, 2.0);
export const WALL_Y = -41;
/** The projected picture on the wall: centre x, centre z, width, height. */
export const PIC = { x: LENS.x, z: 6.7, w: 13.6, h: 13.6 * 9 / 16 };
export const PIC_C = new THREE.Vector3(PIC.x, WALL_Y, PIC.z);

/** Screening timeline (s = 0..1 of its scroll length). Three reels, then credits. */
export const SHOW = {
  arrive: [0.035, 0.175],
  lamp: [0.16, 0.215],
  reels: [[0.215, 0.44], [0.47, 0.69], [0.72, 0.84]],
  credits: [0.87, 1.0],
  slate: 0.24, // share of each reel spent on its title slate
} as const;

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
export const seg = (x: number, r: readonly number[]) => clamp01((x - r[0]) / (r[1] - r[0]));
export const ease = (x: number) => x * x * (3 - 2 * x);

/** Which reel is on screen (‑1 = none) and how far through it. */
export function reelAt(s: number) {
  for (let i = 0; i < SHOW.reels.length; i++) {
    const [a, b] = SHOW.reels[i];
    if (s >= a && s <= b) return { i, p: (s - a) / (b - a) };
  }
  return { i: -1, p: 0 };
}
/** White flash at each reel change (and at lamp-on): 1 at the cut, decaying after. */
export function flashAt(s: number) {
  let f = 0;
  for (const [a] of [...SHOW.reels, SHOW.credits]) { const d = s - a; if (d > -0.004 && d < 0.03) f = Math.max(f, Math.exp(-Math.max(d, 0) * 160)); }
  return f;
}

// Camera stations, as offsets from the projector: [s, x, y, z]. Reel changes are short, so the move between sides reads as a whip.
const KEYS: [number, number, number, number][] = [
  [0.175, 6.5, 11.5, 4.2], [0.44, 6.4, 4.6, 5.8],      // reel 1: push in past the projector's right shoulder
  [0.47, -8.2, 9.5, 3.3], [0.69, -6.6, 3.2, 5.6],     // reel 2: the other side
  [0.72, 10.5, 8.5, 2.4], [0.84, 8.6, 2.2, 4.4],     // reel 3: wide and low from the right, rising
  [0.88, -7.5, 9, 6.2], [1.0, -10.5, 17, 9.5],        // credits: pull back and rise, projector off to one side
];

/** Viewer camera for the screening. `pos`/`tgt` arrive holding the film chapter's last framing. */
export function screeningCamera(s: number, portrait: boolean, pos: THREE.Vector3, tgt: THREE.Vector3, tmp: THREE.Vector3) {
  const far = portrait ? 1.75 : 1;
  let k = 0;
  while (k < KEYS.length - 2 && s > KEYS[k + 1][0]) k++;
  const a = KEYS[k], b = KEYS[k + 1], t = ease(seg(s, [a[0], b[0]]));
  tmp.set(PJ.x + (a[1] + (b[1] - a[1]) * t) * far, PJ.y + (a[2] + (b[2] - a[2]) * t) * far, (a[3] + (b[3] - a[3]) * t) * (portrait ? 1.3 : 1));
  const arrive = ease(seg(s, SHOW.arrive));
  pos.lerp(tmp, arrive);
  // swing out and up on the way over, so the camera travels beside the film instead of through it
  const swing = Math.sin(Math.PI * arrive);
  pos.x += 5.2 * swing; pos.z += 2.0 * swing;
  tmp.copy(PIC_C); tmp.z -= 0.9 * ease(seg(s, SHOW.credits));
  tgt.lerp(tmp, arrive);
}

/** Hub of the projector's feed reel (the red one), and the radius of the film already wound on it. */
export const SPOOL = new THREE.Vector3(PJ.x - 1.49, PJ.y - 3.237, 6.93);
const PACK_R = 1.95;

/**
 * The film runs on from the end of the cine camera's strip to the projector. It climbs to the feed reel,
 * meets the wound film at a tangent and ends there, lying on it for a short arc, so it reads as winding on.
 */
export function feedPath() {
  const a0 = THREE.MathUtils.degToRad(64);
  // the point where it touches the pack, and a point 3.4 back along the tangent it arrives on
  const touch = new THREE.Vector3(SPOOL.x, SPOOL.y + PACK_R * Math.cos(a0), SPOOL.z + PACK_R * Math.sin(a0));
  const lead = new THREE.Vector3(SPOOL.x, touch.y + 3.4 * Math.sin(a0), touch.z - 3.4 * Math.cos(a0));
  const pts = [
    new THREE.Vector3(CINE[0] + 11.29, CINE[1] - 2.86, 2.3), new THREE.Vector3(24.5, -6.0, 2.6),
    new THREE.Vector3(23.9, -10.2, 3.4), new THREE.Vector3(23.0, -13.6, 4.9), lead, touch,
  ];
  for (let k = 1; k <= 4; k++) {
    const a = a0 + THREE.MathUtils.degToRad(k * 9);
    pts.push(new THREE.Vector3(SPOOL.x, SPOOL.y + PACK_R * Math.cos(a), SPOOL.z + PACK_R * Math.sin(a)));
  }
  return new THREE.CatmullRomCurve3(pts, false, "centripetal");
}

/** The clients, in screening order. Copy is from the Markgenics site. */
export const CLIENTS = [
  { name: "Decor by Tarun", role: "E-commerce build · Instagram", line: "A full storefront for a growing décor brand, with reels and carousels shot with an interior-editorial eye.", links: [["decorbytarun.com", "https://decorbytarun.com"], ["@decor_by_tarun", "https://www.instagram.com/decor_by_tarun/"]] },
  { name: "Hav Stories", role: "Instagram content", line: "Instagram content made for the brand.", links: [] },
  { name: "I Want Paris", role: "Café & F&B content", line: "A waffle shop and café with a feed you can almost taste.", links: [] },
];
