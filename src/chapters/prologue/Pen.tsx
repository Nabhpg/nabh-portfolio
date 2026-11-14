"use client";

import { forwardRef, useMemo } from "react";
import * as THREE from "three";

/** Total pen length in world units. Nib tip sits at the local origin; body runs along +Y; nib top faces +Z. */
export const PEN_LENGTH = 4.59;

const lathe = (pts: [number, number][], segments = 72) =>
  new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segments);

function makeNib() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.02, 0.05, 0.105, 0.2, 0.105, 0.36);
  s.bezierCurveTo(0.105, 0.46, 0.085, 0.52, 0.085, 0.66);
  s.lineTo(-0.085, 0.66);
  s.bezierCurveTo(-0.085, 0.52, -0.105, 0.46, -0.105, 0.36);
  s.bezierCurveTo(-0.105, 0.2, -0.02, 0.05, 0, 0);
  // slit + breather hole (one keyhole-shaped cut)
  const h = new THREE.Path();
  h.moveTo(-0.0035, 0.03);
  h.lineTo(-0.0035, 0.309);
  h.absarc(0, 0.33, 0.022, -1.73, -1.41, true);
  h.lineTo(0.0035, 0.03);
  h.closePath();
  s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 28,
  });
  // arch the sheet over the feed and lift the base so it sits in the section mouth
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = Math.min(Math.max(y / 0.62, 0), 1);
    p.setZ(i, z - 0.006 - 4.5 * x * x + 0.066 * t * t * (3 - 2 * t));
  }
  g.computeVertexNormals();
  return g;
}

const Pen = forwardRef<THREE.Group>(function Pen(_, ref) {
  const geo = useMemo(() => ({
    nib: makeNib(),
    section: lathe([[0, 0.6], [0.088, 0.585], [0.097, 0.6], [0.1, 0.75], [0.108, 0.95], [0.124, 1.2], [0.13, 1.26]]),
    ring1: lathe([[0.13, 1.26], [0.143, 1.265], [0.143, 1.32], [0.136, 1.325]]),
    barrel: lathe([[0.136, 1.325], [0.146, 1.5], [0.152, 2.2], [0.15, 3.0], [0.14, 3.7], [0.128, 4.05]]),
    ring2: lathe([[0.128, 4.05], [0.137, 4.055], [0.137, 4.1], [0.126, 4.105]]),
    end: lathe([[0.126, 4.105], [0.118, 4.3], [0.1, 4.45], [0.07, 4.54], [0.03, 4.58], [0, PEN_LENGTH]]),
  }), []);

  const mat = useMemo(() => ({
    lacquer: new THREE.MeshPhysicalMaterial({
      color: "#0d0d11", roughness: 0.34, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.5,
    }),
    gold: new THREE.MeshStandardMaterial({ color: "#e0b565", metalness: 1, roughness: 0.2, envMapIntensity: 1.4, side: THREE.DoubleSide }),
    feed: new THREE.MeshStandardMaterial({ color: "#040404", roughness: 0.55, metalness: 0.1 }),
    tip: new THREE.MeshStandardMaterial({ color: "#d9d9de", metalness: 1, roughness: 0.15 }),
  }), []);

  return (
    <group ref={ref}>
      <mesh geometry={geo.nib} material={mat.gold} />
      <mesh material={mat.tip} position={[0, 0.006, -0.004]}>
        <sphereGeometry args={[0.011, 16, 12]} />
      </mesh>
      <mesh material={mat.feed} position={[0, 0.33, -0.012]} rotation={[0.09, 0, 0]} scale={[1, 1, 0.55]}>
        <cylinderGeometry args={[0.082, 0.01, 0.6, 24]} />
      </mesh>
      <mesh geometry={geo.section} material={mat.lacquer} />
      <mesh geometry={geo.ring1} material={mat.gold} />
      <mesh geometry={geo.barrel} material={mat.lacquer} />
      <mesh geometry={geo.ring2} material={mat.gold} />
      <mesh geometry={geo.end} material={mat.lacquer} />
    </group>
  );
});

export default Pen;
