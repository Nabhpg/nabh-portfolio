import { Uniform } from "three";
import { Effect, type BloomEffect, type NoiseEffect } from "postprocessing";

/**
 * Colour grade for the film chapter: the look of a cinema camera behind a black-mist filter.
 * Lifted green-teal blacks, warm highlights, a little fade. uAmt 0 = the autograph's look, 1 = full grade.
 */
const frag = /* glsl */ `
  uniform float uAmt, uTime;
  float gh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = inputColor.rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(c, vec3(l), 0.16 * uAmt);
    c += vec3(0.004, 0.009, 0.007) * uAmt * (1.0 - smoothstep(0.0, 0.5, l));
    c *= mix(vec3(1.0), vec3(1.07, 1.0, 0.86), uAmt * smoothstep(0.15, 0.9, l));
    c = mix(c, c * 0.94 + 0.004, 0.6 * uAmt);
    // film-print texture over the whole frame: a few scratches, specks of dust, a breathing gate
    float t = floor(uTime * 18.0);
    float sx = floor(uv.x * 520.0);
    c += uAmt * 0.05 * step(0.9992, gh(vec2(sx, floor(uTime * 2.0)))) * step(0.45, gh(vec2(sx, t)));
    c *= 1.0 - uAmt * 0.5 * step(0.99965, gh(floor(uv * vec2(260.0, 150.0)) + t));
    c *= 1.0 - uAmt * 0.035 * gh(vec2(t, 5.0));
    outputColor = vec4(c, inputColor.a);
  }`;
export class GradeEffect extends Effect {
  constructor() { super("GradeEffect", frag, { uniforms: new Map([["uAmt", new Uniform(0)], ["uTime", new Uniform(0)]]) }); }
  set amount(v: number) { this.uniforms.get("uAmt")!.value = v; }
  set time(v: number) { this.uniforms.get("uTime")!.value = v; }
}

/** Live handles to the post-processing effects, so the scene can ride them with the scroll. */
export const fx: { grade: GradeEffect; bloom: BloomEffect | null; noise: NoiseEffect | null } = {
  grade: new GradeEffect(), bloom: null, noise: null,
};
