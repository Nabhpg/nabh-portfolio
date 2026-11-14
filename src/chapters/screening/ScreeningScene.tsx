"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Programme } from "./programme";
import { LENS, PIC, PJ, PJ_SCALE, SHOW, WALL_Y, ease, flashAt, seg } from "./timeline";

const wallVert = /* glsl */ `
  varying vec3 vW;
  void main() { vW = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
/** The wall is plaster; the picture is light falling on it, so the plaster shows through every frame. */
const wallFrag = /* glsl */ `
  varying vec3 vW;
  uniform sampler2D uProg, uWall, uNor;
  uniform vec4 uPic;            // centre x, centre z, width, height
  uniform vec3 uAvg;
  uniform float uOn, uFlash, uBlur, uTime, uCue;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec2 wuv = vW.xz * 0.075;
    vec3 albedo = texture2D(uWall, wuv).rgb;
    vec3 n = texture2D(uNor, wuv).xyz * 2.0 - 1.0;
    float relief = clamp(0.86 + n.x * 0.42 + n.y * 0.3, 0.3, 1.5);   // light rakes across the plaster

    // where this bit of wall sits in the projected frame (looking south, +x is frame-left)
    vec2 uv = vec2((uPic.x + uPic.z * 0.5 - vW.x) / uPic.z, (vW.z - (uPic.y - uPic.w * 0.5)) / uPic.w);
    float t24 = floor(uTime * 24.0);
    uv += vec2(sin(uTime * 13.0) * 0.0011 + (hash(vec2(t24, 1.0)) - 0.5) * 0.0012, sin(uTime * 17.3) * 0.0016 + (hash(vec2(t24, 2.0)) - 0.5) * 0.002); // gate weave
    vec2 e = min(uv, 1.0 - uv);
    float soft = 0.006 + uBlur * 0.03;
    float gate = smoothstep(0.0, soft, e.x) * smoothstep(0.0, soft * 1.6, e.y);
    float corner = smoothstep(0.0, 0.03, length(max(vec2(0.03) - e, 0.0)));
    gate *= 1.0 - corner * 0.0 ;

    // the frame itself, with the lens racking into focus
    vec3 img = vec3(0.0);
    float r = uBlur * 0.016 + 0.0009;
    for (int k = 0; k < 8; k++) {
      float a = float(k) * 0.7854;
      vec2 o = vec2(cos(a), sin(a)) * r * vec2(1.0, 1.78);
      img += vec3(texture2D(uProg, uv + o * 1.08).r, texture2D(uProg, uv + o).g, texture2D(uProg, uv + o * 0.92).b);
    }
    img /= 8.0;
    float flick = 0.9 + 0.1 * hash(vec2(t24, 7.0));
    float hot = 1.0 - 0.42 * dot(uv - 0.5, uv - 0.5) * 2.4;                         // lamp hotspot
    img = img * flick * hot;
    img *= 0.82 + 0.36 * hash(floor(uv * vec2(420.0, 240.0)) + t24);               // print grain
    float sx = floor(uv.x * 380.0);
    img += 0.16 * step(0.9985, hash(vec2(sx, floor(uTime * 3.0)))) * step(0.3, hash(vec2(sx, t24)));   // scratches
    img *= 1.0 - 0.75 * step(0.9993, hash(floor(uv * vec2(150.0, 90.0)) + t24 * 3.1));                 // dust in the gate
    img = mix(img, vec3(1.0, 0.96, 0.88), uFlash);
    // cue mark, top right, just before a reel ends
    img *= 1.0 - uCue * 0.9 * (1.0 - smoothstep(0.016, 0.022, length((uv - vec2(0.93, 0.88)) * vec2(1.78, 1.0))));

    vec3 light = img * uOn * gate * 1.35;
    // what spills past the gate, and what the room gives back
    float outD = length(max(-e, 0.0) * vec2(uPic.z, uPic.w));
    vec3 spill = uAvg * uOn * (exp(-outD * 0.55) * 0.085 + exp(-outD * 0.12) * 0.02) * (1.0 - gate);
    vec3 col = albedo * (light * relief + spill * relief + vec3(0.0025, 0.0035, 0.004) * uOn);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

const beamVert = /* glsl */ `
  attribute float aT; varying float vT; varying vec3 vP;
  void main() { vT = aT; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const beamFrag = /* glsl */ `
  varying float vT; varying vec3 vP;
  uniform float uOn, uTime; uniform vec3 uAvg;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    // haze drifting through the throw; brighter and tighter near the lens
    float haze = 0.55 + 0.9 * vn(vec2(vP.x * 0.5 + uTime * 0.06, vP.y * 0.22 - uTime * 0.05)) * vn(vec2(vP.z * 0.7, vP.y * 0.3 + uTime * 0.04));
    float fall = mix(1.0, 0.05, smoothstep(0.0, 0.85, vT)) * smoothstep(0.0, 0.03, vT);
    float flick = 0.9 + 0.1 * hash(vec2(floor(uTime * 24.0), 3.0));
    vec3 c = mix(vec3(1.0, 0.93, 0.8), uAvg * 2.2 + 0.08, 0.6);
    gl_FragColor = vec4(c * haze * haze * fall * flick * uOn * 0.05, 1.0);
  }`;
const lensFrag = /* glsl */ `
  varying vec2 vUv; uniform float uOn;
  void main() { float r = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(vec3(1.0, 0.9, 0.74) * (exp(-r * r * 30.0) * 1.6 + exp(-r * 3.0) * 0.16) * uOn, 1.0); }`;
const uvVert = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

useGLTF.preload("/screening/projector/projector.gltf", false);

/** The screening room: a scanned 8mm projector, its beam through the haze, and client work as light on a plaster wall. */
export default function ScreeningScene({ s }: { s: RefObject<number> }) {
  const proj = useGLTF("/screening/projector/projector.gltf", false);
  const [wallTex, wallNor] = useLoader(THREE.TextureLoader, ["/screening/wall_diff.jpg", "/screening/wall_nor.jpg"]);
  const programme = useMemo(() => new Programme(), []);
  const progTex = useMemo(() => {
    const t = new THREE.CanvasTexture(programme.canvas);
    t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    return t;
  }, [programme]);
  useEffect(() => () => progTex.dispose(), [progTex]);

  const group = useRef<THREE.Group>(null), projGroup = useRef<THREE.Group>(null);
  const wallMat = useRef<THREE.ShaderMaterial>(null), beamMat = useRef<THREE.ShaderMaterial>(null), lensMat = useRef<THREE.ShaderMaterial>(null);
  const lensGlow = useRef<THREE.Mesh>(null);
  const bounce = useRef<THREE.PointLight>(null), leak = useRef<THREE.PointLight>(null);
  const st = useRef({ time: 0, ready: false, spools: [] as THREE.Object3D[] });

  const wallGeo = useMemo(() => {
    const g = new THREE.BufferGeometry(), x0 = PIC.x - 60, x1 = PIC.x + 60, z0 = -0.5, z1 = 34;
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([x1, WALL_Y, z0, x0, WALL_Y, z0, x0, WALL_Y, z1, x1, WALL_Y, z1]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    return g;
  }, []);
  const beamGeo = useMemo(() => {
    const g = new THREE.BufferGeometry(), y = WALL_Y + 0.05;
    const c = [[PIC.x + PIC.w / 2, PIC.z - PIC.h / 2], [PIC.x - PIC.w / 2, PIC.z - PIC.h / 2], [PIC.x - PIC.w / 2, PIC.z + PIC.h / 2], [PIC.x + PIC.w / 2, PIC.z + PIC.h / 2]];
    const pos: number[] = [], aT: number[] = [];
    for (let k = 0; k < 4; k++) {
      const a = c[k], b = c[(k + 1) % 4];
      pos.push(LENS.x, LENS.y, LENS.z, a[0], y, a[1], b[0], y, b[1]); aT.push(0, 1, 1);
    }
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("aT", new THREE.BufferAttribute(new Float32Array(aT), 1));
    return g;
  }, []);
  const wallU = useMemo(() => ({
    uProg: { value: progTex }, uWall: { value: wallTex }, uNor: { value: wallNor },
    uPic: { value: new THREE.Vector4(PIC.x, PIC.z, PIC.w, PIC.h) }, uAvg: { value: new THREE.Vector3() },
    uOn: { value: 0 }, uFlash: { value: 0 }, uBlur: { value: 1 }, uTime: { value: 0 }, uCue: { value: 0 },
  }), [progTex, wallTex, wallNor]);
  const beamU = useMemo(() => ({ uOn: { value: 0 }, uTime: { value: 0 }, uAvg: { value: new THREE.Vector3() } }), []);
  const lensU = useMemo(() => ({ uOn: { value: 0 } }), []);

  useFrame(({ camera }, dt) => {
    const S = st.current, ss = s.current ?? 0;
    if (!S.ready) {
      for (const t of [wallTex, wallNor]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.needsUpdate = true; }
      wallTex.colorSpace = THREE.SRGBColorSpace;
      for (const n of ["filmstrip_projector_8mm_spool_feed", "filmstrip_projector_8mm_spool_takeup"]) { const o = proj.scene.getObjectByName(n); if (o) S.spools.push(o); }
      S.ready = true;
    }
    if (group.current) group.current.visible = ss > 0;
    if (ss <= 0) return;
    S.time += Math.min(dt, 0.05);

    const room = ease(seg(ss, [0.0, 0.1]));
    const lamp = ease(seg(ss, SHOW.lamp));
    try { programme.draw(ss); } catch { /* a frame that fails to paint must never stop the scene from rendering */ }
    progTex.needsUpdate = true;
    const [ar, ag, ab] = programme.avg.map((v) => (Number.isFinite(v) ? v : 0));

    // reels turn while the lamp is on
    for (const o of S.spools) o.rotation.x -= dt * 2.2 * lamp;
    if (projGroup.current) projGroup.current.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && "envMapIntensity" in m) m.envMapIntensity = 0.16 * room;
    });

    // cue mark in the last stretch of each reel
    let cue = 0;
    for (const [a, b] of SHOW.reels) { const q = (ss - a) / (b - a); if (q > 0.9 && q < 0.985 && Math.floor(S.time * 4) % 2 === 0) cue = 1; }

    if (wallMat.current) {
      const u = wallMat.current.uniforms;
      u.uOn.value = lamp; u.uTime.value = S.time; u.uCue.value = cue;
      u.uFlash.value = Math.max(flashAt(ss), (1 - seg(ss, [SHOW.lamp[1], SHOW.lamp[1] + 0.02])) * 0.0);
      u.uBlur.value = 1 - ease(seg(ss, [SHOW.lamp[0] + 0.02, SHOW.reels[0][0] + 0.02])); // racks into focus as the first slate lands
      (u.uAvg.value as THREE.Vector3).set(ar, ag, ab);
    }
    if (beamMat.current) { const u = beamMat.current.uniforms; u.uOn.value = lamp; u.uTime.value = S.time; (u.uAvg.value as THREE.Vector3).set(ar, ag, ab); }
    if (lensMat.current) lensMat.current.uniforms.uOn.value = lamp;
    if (lensGlow.current) lensGlow.current.quaternion.copy(camera.quaternion);
    const luma = 0.3 * ar + 0.6 * ag + 0.1 * ab, flick = 0.9 + 0.1 * Math.sin(S.time * 151) * Math.sin(S.time * 37);
    if (bounce.current) { bounce.current.color.setRGB(0.25 + ar, 0.22 + ag, 0.18 + ab); bounce.current.intensity = 520 * lamp * (0.12 + luma) * flick; }
    if (leak.current) leak.current.intensity = 26 * lamp * flick + 3 * room;
  });

  return (
    <group ref={group} visible={false}>
      <mesh geometry={wallGeo}>
        <shaderMaterial ref={wallMat} vertexShader={wallVert} fragmentShader={wallFrag} uniforms={wallU} side={THREE.DoubleSide} />
      </mesh>

      {/* scanned 8mm projector (Poly Haven, CC0). Stood up so the lens faces the wall. */}
      <group ref={projGroup} position={PJ}>
        <primitive object={proj.scene} rotation={[Math.PI / 2, 0, 0]} scale={PJ_SCALE} />
      </group>

      <mesh geometry={beamGeo} renderOrder={5} frustumCulled={false}>
        <shaderMaterial ref={beamMat} vertexShader={beamVert} fragmentShader={beamFrag} uniforms={beamU} transparent depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={lensGlow} position={[LENS.x, LENS.y - 0.25, LENS.z]} renderOrder={6}>
        <planeGeometry args={[3.2, 3.2]} />
        <shaderMaterial ref={lensMat} vertexShader={uvVert} fragmentShader={lensFrag} uniforms={lensU} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* the picture lights the room: bounce off the wall, and a warm leak from the lamp house */}
      <pointLight ref={bounce} position={[PIC.x, WALL_Y + 4, PIC.z]} distance={70} decay={2} intensity={0} />
      <pointLight ref={leak} position={[PJ.x + 1.4, PJ.y + 1.5, 4.2]} color="#ffb070" distance={11} decay={2} intensity={0} />
    </group>
  );
}
