/**
 * Phones and tablets get a lighter build of the same film: smaller textures, cheaper shaders, no real-time
 * shadows. Decided once, in the browser. Import this only from client-only modules (the 3D scene and the
 * code it imports), never in markup that renders on the server.
 */
export const LITE =
  typeof window !== "undefined" &&
  (window.matchMedia("(pointer: coarse)").matches || Math.min(window.screen.width, window.screen.height) < 600);

/** Prepend to a shader so it can `#ifdef LITE`. */
export const LITE_DEF = LITE ? "#define LITE\n" : "";

/** Pick the light or the full version of an asset. */
export const pick = <T,>(full: T, lite: T): T => (LITE ? lite : full);
