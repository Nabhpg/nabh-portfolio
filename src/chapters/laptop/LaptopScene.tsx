"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { ChatScreen } from "./chat";
import { HOME, LAP, ease, lidAngle, seg, yawAt } from "./timeline";
import { LITE, LITE_DEF } from "@/lib/quality";

// MacBook Air proportions, 1 unit = 10 cm: 30.4 × 21.5 cm, about 1.1 cm thick closed.
const BW = 3.04, BD = 2.15, BASE_T = 0.068, LID_T = 0.042, CORNER = 0.115;

function slab(thickness: number) {
  const s = new THREE.Shape(), w = BW / 2, h = BD / 2, r = CORNER;
  s.moveTo(-w + r, -h); s.lineTo(w - r, -h); s.quadraticCurveTo(w, -h, w, -h + r); s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(-w + r, h); s.quadraticCurveTo(-w, h, -w, h - r); s.lineTo(-w, -h + r); s.quadraticCurveTo(-w, -h, -w + r, -h);
  const b = 0.007;
  return new THREE.ExtrudeGeometry(s, { depth: thickness - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 16 }).translate(0, 0, b);
}
const glowVert = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
/** The dark the laptop hangs in: slow haze with a warm side and a cold side, soft shafts of light, never flat. */
const auraFrag = LITE_DEF + /* glsl */ `
  #ifdef LITE
  #define OCT 2
  #else
  #define OCT 4
  #endif
  varying vec2 vUv; uniform float uI, uTime;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float a = 0.5, v = 0.0; for (int i = 0; i < OCT; i++) { v += a * vn(p); p = p * 2.03 + 11.0; a *= 0.5; } return v; }
  void main() {
    vec2 p = vUv - 0.5; float r = length(p) * 2.0;
    float haze = fbm(p * 3.2 + vec2(uTime * 0.018, -uTime * 0.012)) * fbm(p * 1.4 - uTime * 0.01);
    // shafts falling from the upper left, broken up by the haze
    float band = dot(p, vec2(0.62, 0.78));
    float shafts = pow(0.5 + 0.5 * sin(band * 26.0 + fbm(p * 2.0 + uTime * 0.02) * 5.0), 3.0) * smoothstep(0.5, -0.3, dot(p, vec2(0.78, -0.62)));
    vec3 warm = vec3(1.0, 0.70, 0.42), cold = vec3(0.36, 0.52, 0.60);
    vec3 col = mix(cold, warm, smoothstep(0.25, -0.35, p.x - p.y * 0.4)) * (haze * haze * 0.42 + shafts * haze * 0.11);
    col += warm * exp(-r * r * 18.0) * 0.03 + cold * exp(-r * r * 4.0) * 0.012;
    gl_FragColor = vec4(col * uI * smoothstep(1.0, 0.35, r), 1.0);
  }`;
/** A laptop in the air, built to the MacBook Air's dimensions, with an AI chat on its screen. */
export default function LaptopScene({ x }: { x: RefObject<number> }) {
  const group = useRef<THREE.Group>(null), body = useRef<THREE.Group>(null), lid = useRef<THREE.Group>(null);
  const screenMat = useRef<THREE.MeshBasicMaterial>(null), auraMat = useRef<THREE.ShaderMaterial>(null), aura = useRef<THREE.Mesh>(null);
  const rim = useRef<THREE.PointLight>(null), fill = useRef<THREE.PointLight>(null), glow = useRef<THREE.PointLight>(null);
  const keys = useRef<THREE.InstancedMesh>(null);
  const time = useRef(0), keyed = useRef(false);

  const chat = useMemo(() => new ChatScreen(), []);
  // paint the screen's opening state now, so the warm-up uploads it and the first frame after the cut has nothing to do
  useMemo(() => chat.draw(0, true), [chat]);
  const tex = useMemo(() => { const t = new THREE.CanvasTexture(chat.canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = LITE ? 4 : 8; return t; }, [chat]);
  useEffect(() => () => tex.dispose(), [tex]);
  const geo = useMemo(() => ({ base: slab(BASE_T), lid: slab(LID_T) }), []);
  const mats = useMemo(() => ({
    alu: new THREE.MeshStandardMaterial({ color: "#8f9399", metalness: 1, roughness: 0.52, envMapIntensity: 0 }),
    glass: new THREE.MeshStandardMaterial({ color: "#040405", metalness: 0.2, roughness: 0.12, envMapIntensity: 0 }),
    well: new THREE.MeshStandardMaterial({ color: "#0b0b0c", metalness: 0.1, roughness: 0.7, envMapIntensity: 0 }),
    key: new THREE.MeshStandardMaterial({ color: "#131315", metalness: 0.1, roughness: 0.46, envMapIntensity: 0 }),
    pad: new THREE.MeshStandardMaterial({ color: "#84888e", metalness: 1, roughness: 0.44, envMapIntensity: 0 }),
  }), []);
  const auraU = useMemo(() => ({ uI: { value: 0 }, uTime: { value: 0 } }), []);

  useFrame(({ camera, size }, dt) => {
    const xx = x.current ?? 0, on = xx > LAP.cut;
    if (group.current) group.current.visible = on;
    if (!on) {
      if (rim.current) rim.current.intensity = 0;
      if (fill.current) fill.current.intensity = 0;
      if (glow.current) glow.current.intensity = 0;
      return;
    }
    time.current += Math.min(dt, 0.05);
    if (!keyed.current && keys.current) {
      // keyboard: 5 rows of caps and a shorter function row
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
      let n = 0;
      for (let r = 0; r < 6; r++) for (let c = 0; c < 14; c++) {
        const fn = r === 0, space = r === 5 && c >= 4 && c <= 8;
        if (r === 5 && c > 4 && c <= 8) continue;
        p.set(-1.235 + c * 0.19 + (space ? 0.38 : 0), BASE_T + 0.006, -0.86 + r * 0.19 - (fn ? 0.03 : 0));
        s.set(space ? 0.92 : 0.165, 0.012, fn ? 0.1 : 0.165);
        keys.current.setMatrixAt(n++, m.compose(p, q, s));
      }
      keys.current.count = n; keys.current.instanceMatrix.needsUpdate = true; keyed.current = true;
    }

    const arrive = ease(seg(xx, LAP.emerge)), close = ease(seg(xx, LAP.push));
    if (body.current) {
      // it drifts in turned away, settles facing the viewer, and never quite stops floating
      const t = time.current, calm = 1 - close * 0.85;
      body.current.rotation.set(Math.PI / 2 + (0.2 * (1 - arrive) + Math.sin(t * 0.5) * 0.02 * calm), yawAt(xx) + Math.sin(t * 0.37) * 0.035 * calm, Math.sin(t * 0.43) * 0.02 * calm, "ZXY");
      body.current.position.set(0, 0, Math.sin(t * 0.6) * 0.07 * calm - (1 - arrive) * 1.2);
    }
    if (lid.current) lid.current.rotation.x = Math.PI / 2 - lidAngle(xx);

    const q = seg(xx, LAP.chat), power = ease(seg(xx, [LAP.lid[0] + 0.06, LAP.lid[1]]));
    const portrait = size.width < size.height;
    if (chat.draw(portrait ? 0 : q, Math.floor(time.current * 2) % 2 === 0)) tex.needsUpdate = true;
    if (screenMat.current) screenMat.current.color.setScalar(0.92 * power);
    for (const m of Object.values(mats)) m.envMapIntensity = 0.3 * arrive;
    if (rim.current) rim.current.intensity = 55 * arrive;
    if (fill.current) fill.current.intensity = 14 * arrive;
    if (glow.current) glow.current.intensity = 1.6 * power;
    if (auraMat.current) { auraMat.current.uniforms.uI.value = arrive * (1 - close * 0.35); auraMat.current.uniforms.uTime.value = time.current; }
    if (aura.current) aura.current.quaternion.copy(camera.quaternion);
  });

  return (
    <>
    <group ref={group} position={HOME} visible={false}>
      {/* laptop-local axes: x right, y up, z toward the user */}
      <group ref={body}>
        <mesh geometry={geo.base} material={mats.alu} rotation={[-Math.PI / 2, 0, 0]} />
        <mesh material={mats.well} position={[0, BASE_T + 0.001, -0.37]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[2.72, 1.22]} /></mesh>
        <instancedMesh ref={keys} args={[undefined, undefined, 84]} material={mats.key}><boxGeometry args={[1, 1, 1]} /></instancedMesh>
        <mesh material={mats.pad} position={[0, BASE_T + 0.001, 0.62]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.3, 0.8]} /></mesh>
        {/* lid, hinged along the back edge; its own axes: y up the lid, z out of the screen */}
        <group ref={lid} position={[0, BASE_T, -BD / 2]}>
          <mesh geometry={geo.lid} material={mats.alu} position={[0, BD / 2, -LID_T]} />
          <mesh material={mats.glass} position={[0, BD / 2, 0.0012]}><planeGeometry args={[BW - 0.05, BD - 0.05]} /></mesh>
          <mesh position={[0, BD / 2 + 0.02, 0.0024]}>
            <planeGeometry args={[2.9, 2.9 * 1330 / 2048]} />
            <meshBasicMaterial ref={screenMat} map={tex} toneMapped={false} color="#000" />
          </mesh>
        </group>
      </group>
      <mesh ref={aura} position={[0, 7, 0.6]} renderOrder={-1}>
        <planeGeometry args={[46, 46]} />
        <shaderMaterial ref={auraMat} vertexShader={glowVert} fragmentShader={auraFrag} uniforms={auraU} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
    <group position={HOME}>
      <pointLight ref={rim} position={[-6.5, 6, 4.5]} color="#ffc793" distance={30} decay={2} intensity={0} />
      <pointLight ref={fill} position={[5, -6, 3]} color="#9db4d6" distance={24} decay={2} intensity={0} />
      {/* the screen's own light on the keys, in front of where the open screen sits */}
      <pointLight ref={glow} position={[0, -1.6, 1.4]} color="#cfd8e6" distance={5} decay={2} intensity={0} />
    </group>
    </>
  );
}
