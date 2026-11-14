import * as THREE from "three";
import { sigToWorldX, sigToWorldY } from "../prologue/signaturePath";

type V2 = [number, number];
/** The signed sheet of paper lying on the desk (centre, half-size; world units ≈ 3 cm each). */
export const SHEET_C: V2 = [sigToWorldX(742), sigToWorldY(642)];
export const SHEET_H: V2 = [5.75, 4.1];
/** Where the vintage 8mm camera stands on the desk, to the right of the page. */
export const CINE: V2 = [13.5, 1.0];
/** Low sun far behind the page: the backlight that gives the haze and halation. */
export const SUN = new THREE.Vector3(-30, 6, 8.5);

/** Film chapter timeline (f = 0..1 of its scroll length). */
export const FILM = {
  travel: [0.0, 0.2],   // tilt down from the autograph and move to the camera
  orbit: [0.17, 0.42],  // half orbit around it
  reel: [0.4, 0.62],    // the film unwinds toward the viewer
  logos: [0.5, 0.63],
  dim: [0.6, 0.7],      // the scene falls back; the writing takes over
  beatA: [0.63, 0.8],   // editing
  beatB: [0.8, 0.98],   // motion graphics
} as const;

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
export const seg = (x: number, r: readonly number[]) => clamp01((x - r[0]) / (r[1] - r[0]));
export const ease = (x: number) => x * x * (3 - 2 * x);

/** How far back a narrow (phone) screen must stand to hold the same framing. */
export const farOf = (portrait: boolean) => (portrait ? 1.85 : 1);
export const ORBIT_R = 12;

/**
 * Viewer camera for the film chapter. `pos`/`tgt` arrive holding the autograph's final framing and are
 * moved toward the travel → half-orbit → hold path. Returns how much "up" has turned from page-up to world-up.
 */
export function filmCamera(f: number, portrait: boolean, pos: THREE.Vector3, tgt: THREE.Vector3, tmp: THREE.Vector3) {
  const far = farOf(portrait);
  const orbit = ease(seg(f, FILM.orbit));
  const theta = Math.PI * (1 + orbit) + 0.05 * seg(f, [0.42, 1]);
  const R = ORBIT_R * far * (1 + 0.1 * ease(seg(f, [0.42, 1])));
  const h = (4.2 - 1.5 * orbit) * far;
  const side = ease(seg(f, [0.3, 0.46])) * (portrait ? 0.9 : 2.7); // slide the camera into the right third of frame
  const travel = ease(seg(f, FILM.travel));
  tmp.set(CINE[0] + Math.cos(theta) * R, CINE[1] + Math.sin(theta) * R, h);
  pos.lerp(tmp, travel);
  tmp.set(CINE[0], CINE[1] - side, 1.9);
  tgt.lerp(tmp, travel);
  return ease(seg(f, [0.02, 0.17]));
}

/** How the cine camera is turned on the desk (radians about the vertical). */
export const CINE_YAW = 0.75;
/** Where the film leaves the camera: a point on the roof of the body, behind the light-meter block (camera-local → world offset). */
const EXIT: [number, number] = [-0.6 * Math.sin(CINE_YAW), 0.6 * Math.cos(CINE_YAW)];

/**
 * Path of the film strip. It starts inside the body, rises straight up through the roof (so it reads as
 * coming out of a slot, not slicing the camera), then curls toward the viewer and off the left of frame.
 */
export function stripPath(portrait: boolean) {
  const far = farOf(portrait), ys = portrait ? 0.42 : 1, zs = portrait ? 1.2 : 1;
  const pts: [number, number, number][] = [
    [0, 0, 2.5], [0, 0, 4.5], [0.9, -1.5, 5.25], [2.9, -4.0, 4.2], [5.1, -6.0, 2.6], [7.4, -6.3, 3.5], [9.5, -4.8, 1.9], [11.7, -3.3, 2.3],
  ];
  return new THREE.CatmullRomCurve3(
    pts.map(([x, y, z], k) => new THREE.Vector3(CINE[0] + EXIT[0] + x * far, CINE[1] + EXIT[1] + y * ys, k < 2 ? z : 2.5 + (z - 2.5) * zs)),
    false, "catmullrom", 0.5,
  );
}
