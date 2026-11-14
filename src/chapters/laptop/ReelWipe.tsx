"use client";

import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";
import { LAP, ease, seg } from "./timeline";

const vert = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
/**
 * A strip of film comes in from the bottom-left corner, swelling as if it were passing right in front of
 * the lens, until it covers the frame; then its trailing edge leaves and the next scene is there.
 */
const frag = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uAtlas;
  uniform float uLead, uTail, uSlide, uAspect, uTime;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec2 p = vec2(vUv.x * uAspect, vUv.y);
    vec2 dir = normalize(vec2(1.0, 0.62)), along = vec2(-dir.y, dir.x);
    float c = dot(p, dir);
    float wdt = max(uLead - uTail, 0.0001);
    float v = (c - uTail) / wdt;                       // 0..1 across the strip
    if (v < 0.0 || v > 1.0) discard;
    float u = dot(p, along) / (wdt * 0.82) + uSlide;   // frames grow with the strip
    vec2 cell = vec2(fract(u), v);
    float px = fract(u * 4.0);
    float hole = step(abs(px - 0.5), 0.2) * (step(abs(cell.y - 0.085), 0.034) + step(abs(cell.y - 0.915), 0.034));
    float inFrame = step(0.05, cell.x) * step(cell.x, 0.95) * step(0.17, cell.y) * step(cell.y, 0.83);
    // only the graphic frames from the reel (no faces): atlas cells 0, 2, 5 and 10
    float pick = mod(floor(u), 4.0);
    float id = pick < 0.5 ? 0.0 : pick < 1.5 ? 2.0 : pick < 2.5 ? 5.0 : 10.0;
    vec2 f = vec2((cell.x - 0.05) / 0.9, (cell.y - 0.17) / 0.66);
    vec3 img = texture2D(uAtlas, vec2((mod(id, 4.0) + f.x) / 4.0, 1.0 - (floor(id / 4.0) + 0.1 + (1.0 - f.y) * 0.62) / 3.0)).rgb;
    float l = dot(img, vec3(0.299, 0.587, 0.114));
    vec3 neg = mix(vec3(0.012, 0.05, 0.042), vec3(0.5, 0.82, 0.7), smoothstep(0.02, 0.95, l));
    neg *= 0.78 + 0.44 * hash(floor(vec2(u * 90.0, cell.y * 90.0)) + floor(uTime * 12.0));
    neg += 0.2 * step(0.994, hash(vec2(floor(cell.y * 260.0), floor(u * 0.6))));
    vec3 base = vec3(0.030, 0.024, 0.020) * (0.8 + 0.4 * hash(floor(vec2(u * 30.0, cell.y * 30.0))));
    vec3 col = mix(base, neg * 0.36, inFrame);
    col = mix(col, vec3(0.0), hole * 0.9);                                  // perforations read as dark, not see-through
    col *= 0.62 + 0.5 * sin(v * 3.14159);                                    // the strip bows: darker at its edges
    col += vec3(1.0, 0.82, 0.6) * pow(max(1.0 - abs(v - 0.3) * 3.0, 0.0), 3.0) * 0.05;   // a soft sheen along it
    float edge = smoothstep(0.0, 0.006, v) * smoothstep(0.0, 0.006, 1.0 - v);
    gl_FragColor = vec4(col, edge);
    #include <colorspace_fragment>
  }`;

export default function ReelWipe({ x }: { x: RefObject<number> }) {
  const atlas = useLoader(THREE.TextureLoader, "/film/frames.jpg");
  const mesh = useRef<THREE.Mesh>(null), mat = useRef<THREE.ShaderMaterial>(null), time = useRef(0);
  const uniforms = useMemo(() => ({ uAtlas: { value: atlas }, uLead: { value: 0 }, uTail: { value: 0 }, uSlide: { value: 0 }, uAspect: { value: 1 }, uTime: { value: 0 } }), [atlas]);

  useFrame(({ size }, dt) => {
    const xx = x.current ?? 0, w = seg(xx, LAP.wipe);
    const on = w > 0 && w < 1;
    if (mesh.current) mesh.current.visible = on;
    if (!on || !mat.current) return;
    time.current += Math.min(dt, 0.05);
    const u = mat.current.uniforms, aspect = size.width / size.height;
    const span = aspect * 0.85 + 0.53 + 0.1;                // how far the frame reaches along the strip's travel
    u.uAspect.value = aspect; u.uTime.value = time.current;
    u.uLead.value = -0.05 + (span + 0.1) * ease(seg(w, [0.0, 0.52]));
    u.uTail.value = -0.1 + (span + 0.2) * ease(seg(w, [0.48, 1.0]));
    u.uSlide.value = w * 2.2;
  });

  return (
    <mesh ref={mesh} visible={false} frustumCulled={false} renderOrder={60}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={mat} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} transparent depthTest={false} depthWrite={false} />
    </mesh>
  );
}
