"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Environment, Lightformer, PerformanceMonitor, useProgress } from "@react-three/drei";
import { LITE, LITE_DEF } from "@/lib/quality";
import { loading } from "@/lib/loading";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import Pen, { PEN_LENGTH } from "./Pen";
import { PHASE } from "./phases";
import FilmScene from "../film/FilmScene";
import { SHEET_C, SHEET_H, ease as fEase, filmCamera, seg as fSeg } from "../film/timeline";
import { fx } from "../film/fx";
import ScreeningScene from "../screening/ScreeningScene";
import { screeningCamera } from "../screening/timeline";
import LaptopScene from "../laptop/LaptopScene";
import ReelWipe from "../laptop/ReelWipe";
import { LAP, laptopCamera } from "../laptop/timeline";
import { SIG_H, SIG_SCALE, SIG_W, samplePen, sigToWorldX, sigToWorldY, type PenSample } from "./signaturePath";

const FOV = 35;
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const REVEAL_Z = 2; // depth at which the pen rests during the light sweep
const SWEEP_TILT = 0.22; // slant of the light blade
// centre of the ink (not of the photo), in world units
const SIG_CENTER = new THREE.Vector3(sigToWorldX(742), sigToWorldY(642), 0);
const SIG_NEED_W = 1400 * SIG_SCALE, SIG_NEED_H = 1090 * SIG_SCALE;

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const seg = (p: number, r: readonly [number, number] | readonly number[]) => clamp01((p - r[0]) / (r[1] - r[0]));
const ease = (x: number) => x * x * (3 - 2 * x);
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

const paperVert = /* glsl */ `
  varying vec2 vSig; varying vec2 vW;
  uniform vec2 uSigSize;
  void main() {
    vW = position.xy;
    vSig = position.xy / uSigSize + 0.5;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const paperFrag = LITE_DEF + /* glsl */ `
  #ifdef LITE
  #define OCT 2
  #else
  #define OCT 4
  #endif
  varying vec2 vSig; varying vec2 vW;
  uniform sampler2D uInk, uOrder;
  uniform vec2 uSheetC, uSheetH;
  uniform float uRoom;
  uniform float uDrawn, uLight, uSpotSize, uShadow, uAspect, uTime;
  uniform vec2 uSpot, uTip, uShadowDir;
  uniform vec3 uInkColor, uGlowColor;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) { float a = 0.5, v = 0.0; for (int i = 0; i < OCT; i++) { v += a * vnoise(p); p = p * 2.03 + 17.0; a *= 0.5; } return v; }
  void main() {
    vec2 uv = vSig;
    // dark paper, lit by a warm pool of light that follows the nib
    vec2 d = (uv - uSpot) * vec2(uAspect, 1.0);
    float spot = exp(-dot(d, d) / (uSpotSize * uSpotSize)) * uLight;
    vec2 pa = (uv - 0.5) * vec2(uAspect, 1.0);
    // paper: fine fibre, tooth, and slow cloudy mottling like handmade stock
    float fibre = 0.8 + 0.4 * hash(floor(uv * vec2(1600.0, 1200.0) * 0.9));
    float tex = fibre * (0.74 + 0.5 * fbm(pa * 4.5)) * (0.88 + 0.24 * fbm(pa * 70.0));
    // a raking key light from the upper left, broken into soft shafts by drifting haze
    float band = dot(pa, vec2(0.55, 0.835)), down = dot(pa, vec2(0.835, -0.55));
    float beam = exp(-pow((band - 0.08) / 0.5, 2.0)) * smoothstep(1.9, -0.7, down);
    float shafts = 0.62 + 0.38 * sin(band * 21.0 + fbm(pa * 1.4 + uTime * 0.02) * 4.0);
    float haze = 0.6 + 0.8 * fbm(pa * 1.7 + vec2(uTime * 0.016, -uTime * 0.011));
    float rake = beam * shafts * haze * uLight;
    // split-tone: warm where the light lands, cold teal in the shadows
    vec3 col = tex * (vec3(0.060, 0.047, 0.036) * spot + vec3(0.050, 0.036, 0.024) * rake * 0.55 + vec3(0.006, 0.012, 0.016) * uLight);

    // the sheet ends; beyond it is the real desk (drawn by the film chapter)
    vec2 sd = abs(vW - uSheetC) - uSheetH;
    float outside = max(sd.x, sd.y);
    if (outside > 0.0) discard;
    col += tex * vec3(0.062, 0.052, 0.042) * uRoom; // the room's light reaches the page too
    col *= 1.0 - 0.3 * smoothstep(-0.07, 0.0, outside);

    // soft shadow the pen casts away from its tip
    vec2 q = (uv - uTip) * vec2(uAspect, 1.0);
    float along = dot(q, uShadowDir);
    float across = abs(dot(q, vec2(-uShadowDir.y, uShadowDir.x)));
    float w = 0.012 + along * 0.09;
    float sh = smoothstep(w, w * 0.25, across) * smoothstep(-0.004, 0.02, along) * smoothstep(0.85, 0.1, along);
    col *= 1.0 - 0.72 * sh * uShadow;

    // ink: revealed in the order the pen wrote it
    if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
      float a = texture2D(uInk, uv).a;
      vec3 o = texture2D(uOrder, uv).rgb;
      float t = (o.r * 65280.0 + o.g * 255.0) / 65535.0;
      float rev = o.b * (1.0 - smoothstep(uDrawn - 0.0022, uDrawn, t));
      float wet = exp(-max(uDrawn - t, 0.0) * 55.0) * rev;
      vec3 ink = uInkColor * (0.5 + 0.42 * min(spot, 1.0) + 0.3 * (1.0 - uLight));
      col = mix(col, ink, a * rev);
      col += uGlowColor * wet * a * 2.2 * uShadow;
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

const curtainFrag = /* glsl */ `
  varying vec3 vPos;
  uniform float uEdge, uTilt;
  void main() {
    float a = smoothstep(-0.35, 0.55, vPos.x + vPos.y * uTilt - uEdge);
    gl_FragColor = vec4(0.0, 0.0, 0.0, a);
  }`;
const posVert = /* glsl */ `
  varying vec3 vPos; varying vec2 vUv;
  void main() { vPos = position; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const bladeFrag = /* glsl */ `
  varying vec2 vUv; uniform float uI;
  void main() {
    float d = abs(vUv.x - 0.5) * 2.0;
    float core = exp(-d * d * 1400.0);
    float glow = exp(-d * 9.0) * 0.07;
    float y = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
    gl_FragColor = vec4(vec3(1.0, 0.9, 0.74) * (core * 1.5 + glow) * y * uI, 1.0);
  }`;
const flareFrag = /* glsl */ `
  varying vec2 vUv; uniform float uI;
  void main() {
    vec2 c = (vUv - 0.5) * 2.0;
    float streak = exp(-abs(c.y) * 26.0) * exp(-abs(c.x) * 3.2);
    float hot = exp(-dot(c * vec2(4.0, 14.0), c * vec2(4.0, 14.0)));
    gl_FragColor = vec4(vec3(1.0, 0.86, 0.62) * (streak * 0.3 + hot * 1.3) * uI, 1.0);
  }`;

/** Per-frame scratch objects, created once (no allocation while scrolling). */
const makeScratch = (reduced: boolean) => ({
  p: reduced ? 1 : 0, sample: { x: 0, y: 0, lift: 0, drawn: 0 } as PenSample,
  tip: new THREE.Vector3(), tipA: new THREE.Vector3(), tipW: new THREE.Vector3(),
  dirA: new THREE.Vector3(), dirW: new THREE.Vector3(), qA: new THREE.Quaternion(), qW: new THREE.Quaternion(),
  X: new THREE.Vector3(), Z: new THREE.Vector3(), m: new THREE.Matrix4(), up: new THREE.Vector3(0, 0, 1),
  camPos: new THREE.Vector3(), camTgt: new THREE.Vector3(), look: new THREE.Vector3(0, 0, REVEAL_Z),
  a: new THREE.Vector3(), b: new THREE.Vector3(), init: false, texReady: false, time: 0, cut: false,
  camUp: new THREE.Vector3(0, 1, 0),
});
type Scratch = ReturnType<typeof makeScratch>;

/** Pen body along `dir`, nib top facing away from the paper as far as possible. */
function orient(s: Scratch, dir: THREE.Vector3, out: THREE.Quaternion) {
  s.Z.copy(s.up).addScaledVector(dir, -s.up.dot(dir)).normalize();
  s.X.crossVectors(dir, s.Z).normalize();
  s.m.makeBasis(s.X, dir, s.Z);
  out.setFromRotationMatrix(s.m);
}

/** Dust motes hanging in the air above the page (fixed pseudo-random layout). */
const dustGeo = (() => {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const N = 40, pos = new Float32Array(N * 3), aux = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos.set([(rnd() - 0.5) * 11, (rnd() - 0.5) * 8, 0.25 + rnd() * rnd() * 5.5], i * 3);
    aux.set([0.006 + rnd() * rnd() * 0.016, rnd() * 6.283, 0.25 + rnd() * 0.75], i * 3); // radius, phase, speed
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aAux", new THREE.BufferAttribute(aux, 3));
  return g;
})();
const dustVert = /* glsl */ `
  attribute vec3 aAux; varying float vB;
  uniform float uTime, uPx; uniform vec3 uLamp;
  void main() {
    float t = uTime * aAux.z * 0.12 + aAux.y;
    vec3 p = position + vec3(sin(t), cos(t * 0.8 + aAux.y), sin(t * 0.6) * 0.5) * 0.45;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 dl = p - uLamp;
    vB = 0.05 + 0.95 * exp(-dot(dl, dl) / 3.0); // motes catch the light near the nib
    gl_PointSize = aAux.x * uPx / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const dustFrag = /* glsl */ `
  varying float vB; uniform float uI;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float disc = smoothstep(1.0, 0.0, r); // plain soft speck, no bokeh ring
    gl_FragColor = vec4(vec3(1.0, 0.86, 0.66) * disc * vB * uI, 1.0);
  }`;

const lensVert = /* glsl */ `
  varying vec2 vNdc;
  void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
/** What a cinema lens does with a hard light source: anamorphic streak, halation, veiling glare, ghosts. */
const lensFrag = /* glsl */ `
  varying vec2 vNdc;
  uniform vec2 uHit; uniform float uI, uAspect;
  float ghost(vec2 p, vec2 c, float size) {
    vec2 q = p - c; q.x *= uAspect; float r = length(q);
    return smoothstep(size, size * 0.82, r) * (0.3 + 0.7 * smoothstep(size * 0.45, size, r));
  }
  void main() {
    vec2 d = vNdc - uHit; d.x *= uAspect;
    float r = length(d);
    // anamorphic streak: long, thin, blue — with a white-hot core
    float wide = exp(-abs(d.y) * 80.0) * exp(-abs(d.x) * 0.95);
    float soft = exp(-abs(d.y) * 20.0) * exp(-abs(d.x) * 2.2);
    float core = exp(-abs(d.y) * 300.0) * exp(-abs(d.x) * 1.9);
    vec3 col = vec3(0.30, 0.56, 1.0) * (wide * 1.25 + soft * 0.22) + vec3(1.0, 0.97, 0.92) * core * 0.9;
    // halation (warm bleed around the source) and veiling glare (lifted blacks across the frame)
    col += vec3(1.0, 0.40, 0.16) * exp(-r * 5.0) * 0.20;
    col += vec3(1.0, 0.85, 0.68) * exp(-r * 1.15) * 0.045;
    // lens ghosts, mirrored through the centre of frame
    col += vec3(0.25, 0.75, 0.65) * ghost(vNdc, -uHit * 0.45, 0.07) * 0.035;
    col += vec3(0.85, 0.45, 0.95) * ghost(vNdc, -uHit * 0.95, 0.12) * 0.022;
    col += vec3(1.0, 0.7, 0.35) * ghost(vNdc, -uHit * 1.5, 0.045) * 0.045;
    col += vec3(0.4, 0.6, 1.0) * ghost(vNdc, uHit * 0.4, 0.03) * 0.05;
    gl_FragColor = vec4(col * uI, 1.0);
  }`;

export type SceneProps = {
  progress: RefObject<number>;
  /** film chapter progress 0..1 (follows the autograph in the same shot) */ film: RefObject<number>;
  /** screening chapter progress 0..1 (agency / client work, follows the film chapter) */ screen: RefObject<number>;
  /** laptop chapter progress 0..1 (what comes next: film wipe, then a laptop asking an AI about Nabh) */ laptop: RefObject<number>;
  reduced: boolean;
};

function Stage({ progress, film, screen, laptop, reduced }: SceneProps) {
  const pen = useRef<THREE.Group>(null);
  const curtain = useRef<THREE.Mesh>(null);
  const blade = useRef<THREE.Mesh>(null);
  const flare = useRef<THREE.Mesh>(null);
  const sweepLight = useRef<THREE.PointLight>(null);
  const nibLight = useRef<THREE.PointLight>(null);
  const paperMat = useRef<THREE.ShaderMaterial>(null);
  const curtainMat = useRef<THREE.ShaderMaterial>(null);
  const bladeMat = useRef<THREE.ShaderMaterial>(null);
  const flareMat = useRef<THREE.ShaderMaterial>(null);
  const lens = useRef<THREE.Mesh>(null);
  const laptopX = useRef(0);
  const screenS = useRef(0);
  const filmF = useRef(0); // film progress actually in effect this frame (after pins / reduced motion)
  const dustMat = useRef<THREE.ShaderMaterial>(null);
  const lensMat = useRef<THREE.ShaderMaterial>(null);

  const [inkTex, orderTex] = useLoader(THREE.TextureLoader, ["/signature/ink.png", "/signature/time.png"]);

  const paperInit = useMemo(() => ({
    uInk: { value: inkTex }, uOrder: { value: orderTex },
    uSigSize: { value: new THREE.Vector2(SIG_W * SIG_SCALE, SIG_H * SIG_SCALE) },
    uRoom: { value: 0 },
    uSheetC: { value: new THREE.Vector2(...SHEET_C) }, uSheetH: { value: new THREE.Vector2(...SHEET_H) },
    uAspect: { value: SIG_W / SIG_H },
    uTime: { value: 0 }, uDrawn: { value: 0 }, uLight: { value: 0 }, uSpotSize: { value: 0.3 }, uShadow: { value: 0 },
    uSpot: { value: new THREE.Vector2(0.5, 0.5) }, uTip: { value: new THREE.Vector2(0.5, 0.5) },
    uShadowDir: { value: new THREE.Vector2(0.6, -0.8) },
    uInkColor: { value: new THREE.Color("#efe4cd") }, uGlowColor: { value: new THREE.Color("#ffb868") },
  }), [inkTex, orderTex]);
  const curtainInit = useMemo(() => ({ uEdge: { value: -99 }, uTilt: { value: SWEEP_TILT } }), []);
  const bladeInit = useMemo(() => ({ uI: { value: 0 } }), []);
  const lensInit = useMemo(() => ({ uI: { value: 0 }, uAspect: { value: 1 }, uHit: { value: new THREE.Vector2() } }), []);
  const dustInit = useMemo(() => ({ uTime: { value: 0 }, uPx: { value: 1000 }, uI: { value: 0 }, uLamp: { value: new THREE.Vector3() } }), []);
  const flareInit = useMemo(() => ({ uI: { value: 0 } }), []);

  const scratch = useRef<Scratch | null>(null);
  // the opening's own textures are in (this component suspends until they are): the page can let people scroll
  useEffect(() => { loading.intro(); }, []);

  useFrame(({ camera, scene, size, viewport }, dtRaw) => {
    const s = (scratch.current ??= makeScratch(reduced));
    const dt = Math.min(dtRaw, 0.05);
    if (!paperMat.current || !curtainMat.current || !bladeMat.current || !flareMat.current) return;
    const paperU = paperMat.current.uniforms, curtainU = curtainMat.current.uniforms;
    const bladeU = bladeMat.current.uniforms, flareU = flareMat.current.uniforms;
    if (!s.texReady) {
      // the draw-order map stores exact values per pixel, so it must never be blended between pixels
      const order = paperU.uOrder.value as THREE.Texture, ink = paperU.uInk.value as THREE.Texture;
      order.minFilter = order.magFilter = THREE.NearestFilter; order.generateMipmaps = false; order.needsUpdate = true;
      ink.anisotropy = 8; ink.needsUpdate = true;
      s.texReady = true;
    }
    const target = reduced ? 1 : progress.current ?? 0;
    s.p += (target - s.p) * (1 - Math.exp(-dt * 7));
    if (Math.abs(target - s.p) < 0.00002) s.p = target;
    // dev aid: `window.__prologueP = 0.5` pins the sequence to a moment
    const pinned = (window as unknown as { __prologueP?: number }).__prologueP;
    if (typeof pinned === "number") { s.p = pinned; s.init = false; }
    const filmPin = (window as unknown as { __filmP?: number }).__filmP;
    if (typeof filmPin === "number") { s.p = 1; s.init = false; }
    const screenPin = (window as unknown as { __screenP?: number }).__screenP;
    if (typeof screenPin === "number") { s.p = 1; s.init = false; }
    const laptopPin = (window as unknown as { __laptopP?: number }).__laptopP;
    if (typeof laptopPin === "number") { s.p = 1; s.init = false; }
    const r = reduced || typeof screenPin === "number" || typeof laptopPin === "number" ? 1 : typeof filmPin === "number" ? filmPin : s.p >= 0.999 ? film.current ?? 0 : 0;
    const sc = reduced || typeof laptopPin === "number" ? 1 : typeof screenPin === "number" ? screenPin : r >= 0.999 ? screen.current ?? 0 : 0;
    screenS.current = sc;
    laptopX.current = reduced ? 1 : typeof laptopPin === "number" ? laptopPin : sc >= 0.999 ? laptop.current ?? 0 : 0;
    filmF.current = r;
    const p = s.p;
    const aspect = size.width / size.height;
    const portrait = aspect < 1;

    const reveal = seg(p, PHASE.reveal), rise = ease(seg(p, PHASE.rise));
    const u = seg(p, PHASE.write), exit = ease(seg(p, PHASE.exit));

    // --- pose A: pen resting in the dark, waiting for the light ---
    if (portrait) s.dirA.set(0.44, 0.895, 0.03).normalize(); else s.dirA.set(0.997, 0.07, 0.03).normalize();
    s.tipA.set(0, 0, REVEAL_Z).addScaledVector(s.dirA, -PEN_LENGTH * 0.5);
    orient(s, s.dirA, s.qA);
    const needW = Math.abs(s.dirA.x) * PEN_LENGTH / 0.78 + 0.5, needH = Math.abs(s.dirA.y) * PEN_LENGTH / 0.8 + 0.5;
    const distA = Math.max(needH / (2 * TAN), needW / (2 * TAN * aspect));

    // --- pose W: writing ---
    samplePen(u, s.sample);
    const hoverZ = (1 - ease(seg(rise, [0.72, 1]))) * 0.5; // settles onto the paper at the end of the rise
    s.tipW.set(sigToWorldX(s.sample.x), sigToWorldY(s.sample.y), 0.004 + s.sample.lift * 0.3 + hoverZ);
    s.dirW.set(0.36 + 0.11 * (s.tipW.x / 3.2), -0.5 - 0.05 * (s.tipW.y / 2.4), 0.78).normalize();
    orient(s, s.dirW, s.qW);

    // --- blend poses ---
    s.tip.lerpVectors(s.tipA, s.tipW, rise);
    s.tip.z += Math.sin(Math.PI * rise) * 0.9; // arc through the air
    if (pen.current) {
      pen.current.quaternion.slerpQuaternions(s.qA, s.qW, rise);
      if (exit > 0) {
        s.tip.x += exit * 1.6; s.tip.y += exit * 1.9; s.tip.z += exit * 3.4;
        pen.current.rotateX(-exit * 0.35);
      }
      pen.current.position.copy(s.tip);
      pen.current.visible = r <= 0; // the pen has left the frame by the time the camera turns to the desk
    }

    // --- camera ---
    const distFull = Math.max(SIG_NEED_H / 0.74 / (2 * TAN), SIG_NEED_W / 0.86 / (2 * TAN * aspect));
    const follow = 0.78 * (1 - ease(seg(u, [0.5, 1])));
    const closeK = portrait ? 0.42 : 0.56;
    const distW = distFull * THREE.MathUtils.lerp(closeK, 1, ease(seg(u, [0.42, 1]))) * (1 + 0.05 * exit);
    s.a.copy(SIG_CENTER); s.a.y -= 0.32 * ease(seg(u, [0.6, 1]));
    s.b.set(s.tipW.x, s.tipW.y, 0);
    s.camTgt.lerpVectors(s.a, s.b, follow);
    s.camTgt.x += 0.25 * follow; s.camTgt.y -= 0.3 * follow; // leave room for the pen body
    s.camPos.set(s.camTgt.x + 0.04 * distW, s.camTgt.y - 0.13 * distW, distW);
    // blend from the reveal camera
    s.a.set(0, 0.02 * distA, REVEAL_Z + distA * (1 - 0.06 * easeOut(reveal)));
    s.b.set(0, 0, REVEAL_Z);
    s.camPos.lerpVectors(s.a, s.camPos, rise);
    s.camTgt.lerpVectors(s.b, s.camTgt, rise);
    // --- film chapter: tilt down off the page, travel to the 8mm camera, half orbit, hold ---
    const wUp = r > 0 ? filmCamera(r, portrait, s.camPos, s.camTgt, s.a) : 0;
    if (sc > 0) screeningCamera(sc, portrait, s.camPos, s.camTgt, s.a);
    // laptop chapter: a hard cut (hidden by the film wipe) to the laptop's own space
    const lx = laptopX.current;
    if (lx > LAP.cut) { laptopCamera(lx, aspect, s.camPos, s.camTgt, s.a, s.b); if (!s.cut) { s.cut = true; s.init = false; } }
    else if (s.cut) { s.cut = false; s.init = false; }
    s.camUp.set(0, 1 - wUp, wUp).normalize();
    const k = s.init ? 1 - Math.exp(-dt * 5) : 1; s.init = true;
    camera.position.lerp(s.camPos, k);
    s.look.lerp(s.camTgt, k);
    camera.up.lerp(s.camUp, k).normalize();
    camera.lookAt(s.look);

    // --- the blade of light that unveils the pen ---
    const half = Math.max(needW, 2 * TAN * distA * aspect) * 0.5 + 0.8;
    const edge = THREE.MathUtils.lerp(-half, half, ease(reveal));
    const env = Math.pow(Math.sin(Math.PI * reveal), 0.55);
    const curtainOn = p < PHASE.reveal[1] + 0.005;
    curtainU.uEdge.value = edge;
    if (curtain.current) curtain.current.visible = curtainOn && !reduced;
    bladeU.uI.value = env; flareU.uI.value = env;
    if (blade.current) { blade.current.position.x = edge; blade.current.visible = env > 0.001; }
    // where the blade meets the pen
    const along = THREE.MathUtils.clamp((edge - s.tipA.x) / (s.dirA.x || 1), 0, PEN_LENGTH);
    const hitY = s.tipA.y + s.dirA.y * along;
    const hitX = edge - hitY * SWEEP_TILT;
    const onPen = hitX > s.tipA.x - 0.2 && hitX < s.tipA.x + s.dirA.x * PEN_LENGTH + 0.2 ? 1 : 0.25;
    if (flare.current) { flare.current.position.set(hitX, hitY, REVEAL_Z + 0.4); flare.current.visible = env > 0.001; flareU.uI.value = env * onPen; }
    if (lens.current && lensMat.current) {
      camera.updateMatrixWorld();
      s.a.set(hitX, hitY, REVEAL_Z + 0.15).project(camera);
      const lu = lensMat.current.uniforms;
      lu.uHit.value.set(s.a.x, s.a.y); lu.uAspect.value = aspect;
      lu.uI.value = env * (0.45 + 0.55 * onPen);
      lens.current.visible = env > 0.001;
    }
    if (sweepLight.current) { sweepLight.current.position.set(hitX, hitY + 0.5, REVEAL_Z + 1.1); sweepLight.current.intensity = env * 26; }

    // --- paper, ink, nib light ---
    const lit = rise * (1 - 0.35 * exit);
    paperU.uDrawn.value = u >= 1 ? 1.01 : s.sample.drawn;
    paperU.uLight.value = lit;
    s.time += dt; paperU.uTime.value = s.time;
    const tx = s.tip.x / (SIG_W * SIG_SCALE) + 0.5, ty = s.tip.y / (SIG_H * SIG_SCALE) + 0.5;
    paperU.uTip.value.set(tx, ty);
    const widen = ease(seg(u, [0.75, 1]));
    paperU.uSpot.value.set(THREE.MathUtils.lerp(tx, 0.47, widen), THREE.MathUtils.lerp(ty, 0.47, widen));
    paperU.uSpotSize.value = THREE.MathUtils.lerp(0.3, 0.72, widen);
    const contact = clamp01(1 - (s.tip.z - 0.004) / 0.45);
    paperU.uShadow.value = contact * rise * (1 - exit);
    paperU.uShadowDir.value.set(s.dirW.x, s.dirW.y).normalize();
    if (nibLight.current) {
      nibLight.current.position.set(s.tip.x - 0.5, s.tip.y + 0.7, s.tip.z + 1.3);
      nibLight.current.intensity = 9 * rise * (1 - exit);
    }
    if (dustMat.current) {
      const du = dustMat.current.uniforms;
      du.uTime.value = reduced ? 0 : s.time;
      du.uPx.value = size.height * viewport.dpr / TAN;
      du.uI.value = 0.07 * lit;
      du.uLamp.value.set(s.tip.x, s.tip.y, s.tip.z + 0.6).lerp(SIG_CENTER, widen);
    }
    scene.environmentIntensity = Math.max(1 - exit, fEase(fSeg(r, [0.03, 0.2])));
    // the look: past the autograph the lens gets a black-mist filter — lower bloom threshold, softer, grainier, graded
    const mist = fEase(fSeg(r, [0.03, 0.22]));
    paperU.uRoom.value = mist;
    fx.grade.amount = mist; fx.grade.time = s.time;
    if (fx.bloom) { fx.bloom.intensity = 0.75 + 0.75 * mist; fx.bloom.luminanceMaterial.threshold = 0.8 - 0.3 * mist; }
    if (fx.noise) fx.noise.blendMode.opacity.value = 0.5 + 0.35 * mist;
  });

  return (
    <>
      <mesh>
        <planeGeometry args={[70, 50]} />
        <shaderMaterial ref={paperMat} vertexShader={paperVert} fragmentShader={paperFrag} uniforms={paperInit} />
      </mesh>

      <points geometry={dustGeo} frustumCulled={false}>
        <shaderMaterial ref={dustMat} vertexShader={dustVert} fragmentShader={dustFrag} uniforms={dustInit} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>

      {/* the chapters load together behind the autograph (which never waits for them), then get warmed up */}
      <Suspense fallback={null}>
        <FilmScene f={filmF} s={screenS} />
        <ScreeningScene s={screenS} />
        <LaptopScene x={laptopX} />
        <ReelWipe x={laptopX} />
        <Warmup />
      </Suspense>
      <LoadProgress />

      <Pen ref={pen} />
      <pointLight ref={nibLight} color="#ffd9a8" distance={7} decay={2} intensity={0} />
      <pointLight ref={sweepLight} color="#fff0d8" distance={4.5} decay={1.6} intensity={0} />

      <mesh ref={curtain} position={[0, 0, REVEAL_Z + 0.5]} renderOrder={5}>
        <planeGeometry args={[60, 60]} />
        <shaderMaterial vertexShader={posVert} ref={curtainMat} fragmentShader={curtainFrag} uniforms={curtainInit} transparent depthWrite={false} depthTest={false} />
      </mesh>
      <mesh ref={blade} position={[0, 0, REVEAL_Z + 0.55]} rotation={[0, 0, Math.atan(SWEEP_TILT)]} renderOrder={6}>
        <planeGeometry args={[1.6, 30]} />
        <shaderMaterial vertexShader={posVert} ref={bladeMat} fragmentShader={bladeFrag} uniforms={bladeInit} transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={flare} renderOrder={7}>
        <planeGeometry args={[4.4, 0.8]} />
        <shaderMaterial vertexShader={posVert} ref={flareMat} fragmentShader={flareFrag} uniforms={flareInit} transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
      </mesh>

      <mesh ref={lens} frustumCulled={false} renderOrder={8}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial ref={lensMat} vertexShader={lensVert} fragmentShader={lensFrag} uniforms={lensInit} transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
      </mesh>

      <Environment resolution={LITE ? 128 : 256} frames={1}>
        <color attach="background" args={["#000"]} />
        <Lightformer form="rect" intensity={7} color="#fff4e2" position={[0, 6, 3]} rotation={[Math.PI / 2, 0, 0]} scale={[14, 1.2, 1]} />
        <Lightformer form="rect" intensity={3.5} color="#ffcf9a" position={[-7, 1, 4]} rotation={[0, Math.PI / 2, 0]} scale={[6, 0.7, 1]} />
        <Lightformer form="rect" intensity={2.2} color="#9fb6ff" position={[7, -2, 2]} rotation={[0, -Math.PI / 2, 0]} scale={[5, 0.5, 1]} />
        <Lightformer form="circle" intensity={2.5} color="#ffe9c9" position={[2, 2, 9]} scale={1.6} />
        <Lightformer form="rect" intensity={0.5} color="#cfd6e6" position={[0, -1, 12]} scale={[22, 5, 1]} />
      </Environment>
    </>
  );
}

/** Reports asset loading to the page's loader. */
function LoadProgress() {
  const { progress } = useProgress();
  useEffect(() => { loading.set(progress / 100); }, [progress]);
  return null;
}

/**
 * Once everything has loaded, draw the whole scene once, off screen, with every object shown and nothing culled.
 * That compiles every shader (shadow ones included) and uploads every texture and mesh to the GPU now, behind
 * the opening, instead of the first time each chapter scrolls into view, which is what made the cuts stutter.
 */
function Warmup() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    let cancelled = false;
    const hidden: THREE.Object3D[] = [], culled: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (!o.visible) { hidden.push(o); o.visible = true; }
      if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; }
    });
    const rt = new THREE.WebGLRenderTarget(16, 16);
    const auto = gl.shadowMap.autoUpdate;
    try {
      gl.compile(scene, camera);
      gl.shadowMap.autoUpdate = true; gl.shadowMap.needsUpdate = true;
      gl.setRenderTarget(rt); gl.render(scene, camera);
    } catch { /* a failed warm-up only costs a later hitch */ }
    gl.setRenderTarget(null);
    gl.shadowMap.autoUpdate = auto;
    hidden.forEach((o) => { o.visible = false; });
    culled.forEach((o) => { o.frustumCulled = true; });
    rt.dispose();
    const id = requestAnimationFrame(() => { if (!cancelled) loading.done(); });
    return () => { cancelled = true; cancelAnimationFrame(id); };
  }, [gl, scene, camera]);
  return null;
}

export default function PrologueScene({ running, ...props }: SceneProps & { running: boolean }) {
  // resolution adapts to the device: start modest on phones, step down if frames drop, back up if there is room
  const maxDpr = useMemo(() => Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, LITE ? 1.5 : 1.75), []);
  const [dpr, setDpr] = useState(() => Math.min(maxDpr, LITE ? 1.25 : 1.5));
  return (
    <Canvas
      shadows={LITE ? false : "soft"}
      dpr={dpr}
      frameloop={running ? "always" : "never"}
      resize={{ scroll: false, debounce: { scroll: 0, resize: 120 } }}
      camera={{ fov: FOV, near: 0.1, far: 120, position: [0, 0, 9] }}
      gl={{ antialias: !LITE, stencil: false, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
    >
      <PerformanceMonitor
        flipflops={4}
        onDecline={() => setDpr((d) => Math.max(1, +(d - 0.25).toFixed(2)))}
        onIncline={() => setDpr((d) => Math.min(maxDpr, +(d + 0.25).toFixed(2)))}
        onFallback={() => setDpr(1)}
      />
      <color attach="background" args={["#000"]} />
      <fogExp2 attach="fog" args={["#070a09", 0]} />
      <Stage {...props} />
      <EffectComposer multisampling={0}>
        <Bloom ref={(e) => { fx.bloom = e; }} mipmapBlur intensity={0.75} luminanceThreshold={0.8} luminanceSmoothing={0.2} radius={0.7} levels={LITE ? 5 : 8} resolutionScale={LITE ? 0.5 : 1} />
        <Noise ref={(e) => { fx.noise = e; }} premultiply blendFunction={BlendFunction.SCREEN} opacity={0.5} />
        <primitive object={fx.grade} dispose={null} />
        <Vignette offset={0.22} darkness={0.78} />
      </EffectComposer>
    </Canvas>
  );
}
