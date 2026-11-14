/** Scroll phases (0..1 of the prologue's scroll length). Shared by the 3D scene and the HTML overlays. */
export const PHASE = {
  reveal: [0.02, 0.15],
  rise: [0.17, 0.31],
  write: [0.31, 0.88],
  exit: [0.9, 1.0],
} as const;

/** Share of the opening's scroll length spent on the autograph; the rest is the film chapter. */
export const SPLIT = 0.2065;
/** Where the film chapter ends and the screening (agency / client work) begins. */
export const SPLIT2 = 0.5032;
/** Where the screening ends and the denoise chapter (what comes next) begins. */
export const SPLIT3 = 0.8065;
