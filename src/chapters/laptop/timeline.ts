import * as THREE from "three";

/** Laptop chapter (x = 0..1 of its scroll length): a film-strip wipe, then a laptop in the air asking an AI about Nabh. */
export const LAP = {
  wipe: [0.0, 0.2],     // the film crosses the frame; the cut to the laptop happens while it covers everything
  cut: 0.1,
  emerge: [0.11, 0.4],
  lid: [0.16, 0.38],
  push: [0.36, 0.58],
  chat: [0.52, 0.97],
} as const;

/** Where the laptop floats: far above the desk, in its own dark. */
export const HOME = new THREE.Vector3(0, 0, 140);
export const OPEN = THREE.MathUtils.degToRad(106);

export const QUESTION = "Who is Nabh, and what is he working toward?";
export const ANSWER = [
  "Nabh is a Computer Science student at Chandigarh University. He is studying machine learning and AI from the ground up. Alongside it he edits videos, makes content and freelances for clients.",
  "Where he is headed: an AI engineer who also makes films.",
  "He is not there yet. He is working on it.",
];

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
export const seg = (v: number, r: readonly number[]) => clamp01((v - r[0]) / (r[1] - r[0]));
export const ease = (v: number) => v * v * (3 - 2 * v);

export const lidAngle = (x: number) => OPEN * ease(seg(x, LAP.lid));
export const yawAt = (x: number) => -0.9 * (1 - ease(seg(x, [0.11, 0.46])));

/** laptop-local (x right, y up, z toward the user) → world offset from HOME (world z is up, the user sits to the south) */
const toWorld = (v: THREE.Vector3, x: number, y: number, z: number) => v.set(HOME.x + x, HOME.y - z, HOME.z + y);

/** Viewer camera: watch the laptop arrive, then move in until its screen fills the frame. Sets pos/tgt outright (this follows a cut). */
export function laptopCamera(x: number, aspect: number, pos: THREE.Vector3, tgt: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) {
  const th = lidAngle(x), sn = Math.sin(th), cs = Math.cos(th), portrait = aspect < 1;
  // centre of the display and the direction it faces
  const cy = 0.07 + 1.1 * sn, cz = -1.075 + 1.1 * cs, ny = -cs, nz = sn;
  // far enough that the whole display fits the frame's width. On a phone the display just fills the width, square on;
  // the page then takes over with its own, readable copy of the conversation (LaptopOverlay).
  const fit = 3.0 / (2 * Math.tan(THREE.MathUtils.degToRad(17.5)) * aspect);
  const dist = portrait ? fit * 0.97 : Math.max(3.3, fit * 1.08) - 0.25 * ease(seg(x, LAP.chat));
  toWorld(a, portrait ? 0 : 0.62, cy + ny * dist + (portrait ? 0 : 0.22), cz + nz * dist);   // close: square on to the screen (a touch off-axis on wide screens)
  toWorld(b, 0, cy - 0.02, cz);
  const drift = ease(seg(x, LAP.emerge));
  pos.set(HOME.x + 3.0 - 1.2 * drift, HOME.y - (portrait ? 17 : 9.5) + 1.2 * drift, HOME.z + 2.4);
  tgt.set(HOME.x, HOME.y, HOME.z + 0.95);
  const e = ease(seg(x, LAP.push));
  pos.lerp(a, e); tgt.lerp(b, e);
}
