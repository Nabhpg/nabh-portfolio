"use client";

import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { CINE, CINE_YAW, FILM, SHEET_C, SHEET_H, SUN, ease, seg, stripPath } from "./timeline";
import { feedPath } from "../screening/timeline";
import { LITE, pick } from "@/lib/quality";

const CINE_SCALE = 27; // scanned model is in metres; the desk is ~3 cm per unit
const STRIP_W = 1.15;
const CELL = STRIP_W * 0.82;

/** Film ribbon along a curve. aU = length in frame cells, uv.y = across the strip. */
const X_AXIS = new THREE.Vector3(1, 0, 0);

function stripGeometry(curve: THREE.Curve<THREE.Vector3>, fromCamera = true) {
  const N = 260;
  const pts = curve.getSpacedPoints(N), len = curve.getLength();
  const pos = new Float32Array((N + 1) * 6), nor = new Float32Array((N + 1) * 6), aU = new Float32Array((N + 1) * 2), aV = new Float32Array((N + 1) * 2);
  const idx: number[] = [];
  const T = new THREE.Vector3(), W = new THREE.Vector3(), prevW = new THREE.Vector3(), Nn = new THREE.Vector3();
  const toViewer = new THREE.Vector3(1, 0, 0.25).normalize(), q = new THREE.Quaternion(), axis = new THREE.Vector3();
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    T.copy(pts[Math.min(i + 1, N)]).sub(pts[Math.max(i - 1, 0)]).normalize();
    W.crossVectors(T, toViewer);
    if (W.lengthSq() < 0.02) W.copy(prevW); else W.normalize();
    if (i && W.dot(prevW) < 0) W.negate();
    prevW.copy(W);
    const clear = Math.min(Math.max((t - 0.08) / 0.2, 0), 1), free = clear * clear * (3 - 2 * clear);
    // leaving the roof the strip lines up with the camera body; the lazy curl only starts once it is clear
    let h = STRIP_W / 2;
    if (fromCamera) W.applyQuaternion(q.setFromAxisAngle(T, CINE_YAW * (1 - free) + 0.55 * free * Math.sin(t * Math.PI * 2 * 1.35 + 0.4)));
    else {
      // onto the projector: turn to lie across the reel's axis, and narrow to sit between its flanges
      const k = Math.min(Math.max((t - 0.12) / 0.4, 0), 1), turn = k * k * (3 - 2 * k);
      W.lerp(axis.copy(X_AXIS).multiplyScalar(W.x < 0 ? -1 : 1), turn).addScaledVector(T, -W.dot(T)).normalize();
      const n = Math.min(Math.max((t - 0.3) / 0.4, 0), 1);
      h *= 1 - 0.8 * n * n * (3 - 2 * n); // down to the width of the film already on the reel
    }
    Nn.crossVectors(W, T).normalize();
    const p = pts[i];
    pos.set([p.x + W.x * h, p.y + W.y * h, p.z + W.z * h, p.x - W.x * h, p.y - W.y * h, p.z - W.z * h], i * 6);
    nor.set([Nn.x, Nn.y, Nn.z, Nn.x, Nn.y, Nn.z], i * 6);
    aU.set([(t * len) / CELL, (t * len) / CELL], i * 2);
    aV.set([0, 1], i * 2);
    if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("aU", new THREE.BufferAttribute(aU, 1));
  g.setAttribute("aV", new THREE.BufferAttribute(aV, 1));
  g.setIndex(idx);
  return { g, cells: len / CELL };
}

const stripVert = /* glsl */ `
  attribute float aU, aV; varying float vU, vV; varying vec3 vN, vP;
  void main() { vU = aU; vV = aV; vN = normal; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const stripFrag = /* glsl */ `
  varying float vU, vV; varying vec3 vN, vP;
  uniform sampler2D uAtlas; uniform float uReveal, uSlide, uTime, uI; uniform vec3 uSun;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    if (vU > uReveal) discard;
    float u = vU - uSlide;
    vec2 c = vec2(fract(u), vV);
    // perforations down both edges
    float px = fract(u * 4.0);
    float hole = step(abs(px - 0.5), 0.2) * (step(abs(c.y - 0.085), 0.034) + step(abs(c.y - 0.915), 0.034));
    if (hole > 0.5) discard;
    float inFrame = step(0.05, c.x) * step(c.x, 0.95) * step(0.17, c.y) * step(c.y, 0.83);
    // one still per cell, from a 4 x 3 atlas of frames taken from the reel
    float id = mod(floor(u), 12.0);
    vec2 f = vec2((c.x - 0.05) / 0.9, (c.y - 0.17) / 0.66);
    vec2 auv = vec2((mod(id, 4.0) + f.x) / 4.0, 1.0 - (floor(id / 4.0) + 0.1 + f.y * 0.62) / 3.0);
    vec3 img = texture2D(uAtlas, auv).rgb;
    // grungy negative: crushed, green-teal, low contrast
    float l = dot(img, vec3(0.299, 0.587, 0.114));
    vec3 neg = mix(vec3(0.015, 0.06, 0.05), vec3(0.60, 0.95, 0.80), smoothstep(0.02, 0.95, l));
    neg = mix(neg, img * vec3(0.8, 1.0, 0.9), 0.22);
    neg *= 0.78 + 0.44 * hash(floor(vec2(u * 80.0, c.y * 80.0)) + floor(uTime * 12.0));           // grain
    neg += 0.22 * step(0.994, hash(vec2(floor(c.y * 260.0), floor(u * 0.6))));                     // scratches run the length
    vec3 base = vec3(0.040, 0.032, 0.026) * (0.8 + 0.4 * hash(floor(vec2(u * 30.0, c.y * 30.0))));
    vec3 col = mix(base, neg * 0.42, inFrame);
    // light: the strip is translucent, so it glows where it hangs between the viewer and the sun
    vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
    vec3 V = normalize(cameraPosition - vP), L = normalize(uSun - vP);
    float diff = 0.3 + 0.7 * abs(dot(N, L));
    float through = pow(max(dot(-V, L), 0.0), 2.5);
    float spec = pow(max(dot(reflect(-L, N), V), 0.0), 36.0);
    col = col * diff + neg * inFrame * through * 1.3 + vec3(1.0, 0.82, 0.58) * (spec * 0.55 + through * 0.05);
    float lead = exp(-(uReveal - vU) * 1.6);   // the freshly pulled end catches the light
    col += vec3(1.0, 0.8, 0.55) * lead * 0.12;
    gl_FragColor = vec4(col * uI, 0.95);
    #include <colorspace_fragment>
  }`;

const glowVert = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const glowFrag = /* glsl */ `
  varying vec2 vUv; uniform float uI;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    vec2 d = vUv - 0.5; float a = atan(d.y, d.x);
    float rays = pow(0.5 + 0.5 * sin(a * 7.0 + 1.3), 3.0) * 0.6 + pow(0.5 + 0.5 * sin(a * 17.0 - 0.7), 6.0) * 0.4;
    float g = exp(-r * r * 4.5) * 0.36 + exp(-r * r * 140.0) * 0.9 + exp(-r * 2.3) * (0.07 + 0.22 * rays);
    gl_FragColor = vec4(vec3(1.0, 0.80, 0.52) * g * uI * smoothstep(1.0, 0.7, r), 1.0);
  }`;
const shadowFrag = /* glsl */ `
  varying vec2 vUv; uniform vec2 uHalf; uniform float uI;
  void main() {
    vec2 p = (vUv - 0.5) * (uHalf + 1.6) * 2.0;
    vec2 d = abs(p) - uHalf;
    float o = length(max(d, 0.0));
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.7 * uI * (1.0 - smoothstep(0.0, 1.3, o)));
  }`;

const contactFrag = /* glsl */ `
  varying vec2 vUv; uniform float uI;
  void main() { float r = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(0.0, 0.0, 0.0, 0.62 * uI * exp(-r * r * 7.0)); }`;

/** App tile in the style of the Adobe icons (Premiere Pro / After Effects), drawn to a texture. */
function appTile(text: string) {
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const x = c.getContext("2d")!;
  const rr = (m: number, r: number) => { x.beginPath(); x.roundRect(m, m, 512 - 2 * m, 512 - 2 * m, r); };
  rr(6, 92); x.fillStyle = "#9999ff"; x.fill();
  rr(26, 74); x.fillStyle = "#00005b"; x.fill();
  x.fillStyle = "#9999ff"; x.font = "600 236px 'Helvetica Neue', Helvetica, Arial, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(text, 256, 272);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

const CAMERA_GLTF = pick("/film/camera/camera.gltf", "/film/camera/camera_lite.gltf");
const WOOD = pick(["/film/desk/wood_diff.jpg", "/film/desk/wood_nor.jpg", "/film/desk/wood_rough.jpg"], ["/film/desk/wood_diff_1k.jpg", "/film/desk/wood_nor_1k.jpg", "/film/desk/wood_rough_1k.jpg"]);
// start every download at once (otherwise the textures wait for the model to finish: a waterfall)
useGLTF.preload(CAMERA_GLTF, false);
useLoader.preload(THREE.TextureLoader, [...WOOD, "/film/frames.jpg"]);

/** Everything the film chapter adds to the shot: real desk, scanned 8mm camera, backlight, film strip, app tiles. */
export default function FilmScene({ f, s }: { f: RefObject<number>; s: RefObject<number> }) {
  const cine = useGLTF(CAMERA_GLTF, false);
  const [diff, nor, rough, atlas] = useLoader(THREE.TextureLoader, [...WOOD, "/film/frames.jpg"]);
  const ready = useRef(false);
  const desk = useRef<THREE.Mesh>(null), deskMat = useRef<THREE.MeshStandardMaterial>(null);
  const cineGroup = useRef<THREE.Group>(null);
  const sun = useRef<THREE.DirectionalLight>(null), key = useRef<THREE.PointLight>(null), fill = useRef<THREE.AmbientLight>(null);
  const glow = useRef<THREE.Mesh>(null), glowMat = useRef<THREE.ShaderMaterial>(null);
  const shadowMat = useRef<THREE.ShaderMaterial>(null), shadow = useRef<THREE.Mesh>(null);
  const strips = useRef<(THREE.Mesh | null)[]>([]), stripMats = useRef<(THREE.ShaderMaterial | null)[]>([]);
  const tiles = useRef<(THREE.Mesh | null)[]>([]);
  const contactMat = useRef<THREE.ShaderMaterial>(null);
  const time = useRef(0);

  // set before the warm-up draw, so the shadow shaders for the camera get compiled with everything else
  useMemo(() => cine.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = !LITE; }), [cine]);
  const curves = useMemo(() => [stripPath(false), stripPath(true)], []);
  const geo = useMemo(() => [stripGeometry(curves[0]), stripGeometry(curves[1]), stripGeometry(feedPath(), false)], [curves]);
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), d: new THREE.Vector3(), up: new THREE.Vector3() }), []);
  const stripU = useMemo(() => geo.map(() => ({ uAtlas: { value: atlas }, uReveal: { value: 0 }, uSlide: { value: 0 }, uTime: { value: 0 }, uI: { value: 1 }, uSun: { value: SUN } })), [geo, atlas]);
  const glowU = useMemo(() => ({ uI: { value: 0 } }), []);
  const shadowU = useMemo(() => ({ uI: { value: 0 }, uHalf: { value: new THREE.Vector2(...SHEET_H) } }), []);
  const contactU = useMemo(() => ({ uI: { value: 0 } }), []);
  const tileTex = useMemo(() => [appTile("Pr"), appTile("Ae")], []);

  useFrame(({ camera, size, scene, gl }, dt) => {
    if (!ready.current) {
      for (const t of [diff, nor, rough]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5); t.anisotropy = LITE ? 4 : 8; t.needsUpdate = true; }
      diff.colorSpace = THREE.SRGBColorSpace;
      atlas.colorSpace = THREE.SRGBColorSpace; atlas.needsUpdate = true;
      ready.current = true;
    }
    time.current += Math.min(dt, 0.05);
    const ff = f.current ?? 0, portrait = size.width < size.height;
    const on = ease(seg(ff, [0.01, 0.2]));           // the room comes up as the camera tilts down
    const ss = s.current ?? 0;
    const day = 1 - ease(seg(ss, [0.03, 0.17]));     // the sun goes when the screening starts
    const back = (1 - 0.55 * ease(seg(ff, FILM.dim)) * (ss > 0 ? 1 - ease(seg(ss, [0, 0.045])) * 0.4 : 1)) * (0.06 + 0.94 * day); // falls back when the writing takes over

    if (desk.current) desk.current.visible = on > 0;
    if (deskMat.current) deskMat.current.envMapIntensity = 0.1 * on; // more than this and grey reflections wash the wood out
    if (shadow.current) shadow.current.visible = on > 0;
    if (shadowMat.current) shadowMat.current.uniforms.uI.value = on;
    if (sun.current) sun.current.intensity = 2.4 * on * back;
    // the shadow map only needs redrawing while the desk is in view (it is off entirely on phones)
    gl.shadowMap.autoUpdate = !LITE && on > 0 && day > 0;
    if (key.current) key.current.intensity = 130 * on * back;
    if (scene.fog) (scene.fog as THREE.FogExp2).density = 0.022 * on; // the far desk dissolves into haze
    if (fill.current) fill.current.intensity = 0.05 * on;
    if (glow.current) { glow.current.visible = on > 0; glow.current.quaternion.copy(camera.quaternion); }
    if (glowMat.current) glowMat.current.uniforms.uI.value = 0.72 * on * back;
    if (sun.current && !sun.current.userData.aimed) {
      sun.current.target.position.set(CINE[0], CINE[1], 1.5); sun.current.target.updateMatrixWorld(); sun.current.userData.aimed = true;
    }
    if (contactMat.current) contactMat.current.uniforms.uI.value = on;
    if (cineGroup.current) {
      cineGroup.current.visible = on > 0;
      cineGroup.current.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m && "envMapIntensity" in m) m.envMapIntensity = 0.55 * on;
      });
    }

    const reel = ease(seg(ff, FILM.reel));
    geo.forEach((s, k) => {
      const mesh = strips.current[k], mat = stripMats.current[k];
      if (mesh) mesh.visible = k === 2 ? ss > 0 : (k === 1) === portrait && reel > 0;
      if (mat) {
        mat.uniforms.uReveal.value = (k === 2 ? ease(seg(ss, [0.03, 0.165])) : reel) * (s.cells + 0.5);
        mat.uniforms.uSlide.value = -seg(ff, [FILM.reel[0], 1]) * 7; // the film keeps running through as you scroll
        mat.uniforms.uTime.value = time.current;
        mat.uniforms.uI.value = k === 2 ? 0.3 + 0.7 * day : Math.max(back, 0.22);
      }
    });

    const lg = seg(ff, FILM.logos);
    tiles.current.forEach((m, i) => {
      if (!m) return;
      const a = ease(clamp01(lg * 1.6 - i * 0.5)) * (1 - ease(seg(ss, [0, 0.035]))); // gone before the camera leaves for the projector
      m.visible = a > 0.001;
      if (portrait) {
        // on a tall screen: anchored to the frame (top left, above the camera), set just behind the film so its arc crosses them
        tmp.p.set(i ? -0.04 : -0.5, (i ? 0.64 : 0.5) + Math.sin(time.current * 0.6 + i * 2) * 0.008 - (1 - a) * 0.04, 0.5).unproject(camera);
        tmp.d.subVectors(tmp.p, camera.position).normalize();
        tmp.up.set(CINE[0], CINE[1], 2);
        const depth = camera.position.distanceTo(tmp.up) * 1.06;
        m.position.copy(camera.position).addScaledVector(tmp.d, depth);
        m.userData.fit = (0.23 * 2 * Math.tan(THREE.MathUtils.degToRad(17.5)) * (size.width / size.height) * depth) / 2.3;
      } else {
        const base = i === 0 ? [-2.6, -3.7, 2.75] : [-3.4, -6.9, 3.05]; // behind the plane the film travels in, tucked under its arc
        m.position.set(CINE[0] + base[0], CINE[1] + base[1], base[2] + Math.sin(time.current * 0.6 + i * 2) * 0.07 - (1 - a) * 0.7);
      }
      m.quaternion.copy(camera.quaternion);
      m.rotateZ((i ? 1 : -1) * 0.07);
      m.scale.setScalar((0.85 + 0.15 * a) * (portrait ? (m.userData.fit as number) : 1));
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = a; mat.color.setScalar(0.34 * back);
    });
  });

  return (
    <>
      {/* worn wooden desk (scanned texture) under the sheet */}
      <mesh ref={desk} position={[0, 0, -0.02]} visible={false} receiveShadow>
        <planeGeometry args={[96, 96]} />
        <meshStandardMaterial ref={deskMat} map={diff} normalMap={nor} roughnessMap={rough} color="#f2d2b0" roughness={1} metalness={0} normalScale={[0.55, 0.55]} envMapIntensity={0} />
      </mesh>
      <mesh ref={shadow} position={[SHEET_C[0], SHEET_C[1], -0.01]} visible={false}>
        <planeGeometry args={[(SHEET_H[0] + 1.6) * 2, (SHEET_H[1] + 1.6) * 2]} />
        <shaderMaterial ref={shadowMat} vertexShader={glowVert} fragmentShader={shadowFrag} uniforms={shadowU} transparent depthWrite={false} />
      </mesh>

      {/* vintage 8mm cine camera (photo-scanned, Poly Haven CC0) */}
      <group ref={cineGroup} position={[CINE[0], CINE[1], 0]} rotation={[0, 0, CINE_YAW]} visible={false}>
        <primitive object={cine.scene} rotation={[Math.PI / 2, 0, 0]} scale={CINE_SCALE} />
      </group>

      <mesh position={[CINE[0] + 0.2, CINE[1] - 0.1, 0.005]}>
        <planeGeometry args={[7, 7]} />
        <shaderMaterial ref={contactMat} vertexShader={glowVert} fragmentShader={contactFrag} uniforms={contactU} transparent depthWrite={false} />
      </mesh>

      {/* low sun behind the page: backlight, rim and the long sheen on the wood */}
      <directionalLight ref={sun} position={SUN} color="#ffbf7a" intensity={0} castShadow={!LITE} shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.04} shadow-radius={7}>
        <orthographicCamera attach="shadow-camera" args={[-9, 9, 9, -9, 1, 90]} />
      </directionalLight>
      <pointLight ref={key} position={[CINE[0] + 6, CINE[1] + 3, 6]} color="#ffcc94" distance={30} decay={2} intensity={0} />
      <ambientLight ref={fill} color="#7fb0a6" intensity={0} />
      <mesh ref={glow} position={SUN} visible={false} renderOrder={1}>
        <planeGeometry args={[46, 46]} />
        <shaderMaterial ref={glowMat} vertexShader={glowVert} fragmentShader={glowFrag} uniforms={glowU} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Premiere Pro and After Effects, half hidden behind the film */}
      {tileTex.map((t, i) => (
        <mesh key={i} ref={(m) => { tiles.current[i] = m; }} visible={false} renderOrder={3}>
          <planeGeometry args={[2.3, 2.3]} />
          <meshBasicMaterial map={t} transparent opacity={0} toneMapped={false} />
        </mesh>
      ))}

      {/* the film itself */}
      {geo.map((s, k) => (
        <mesh key={k} geometry={s.g} ref={(m) => { strips.current[k] = m; }} visible={false} frustumCulled={false} renderOrder={4}>
          <shaderMaterial ref={(m) => { stripMats.current[k] = m; }} vertexShader={stripVert} fragmentShader={stripFrag} uniforms={stripU[k]} side={THREE.DoubleSide} transparent />
        </mesh>
      ))}
    </>
  );
}

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
