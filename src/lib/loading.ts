/**
 * Load state of the 3D film, shared between the scene (which knows) and the page (which shows a loader).
 * `intro`: the opening (pen and autograph) can play — the page lets people scroll from here, while the later
 * chapters keep loading behind the autograph. `ready`: everything is loaded, compiled and on the GPU.
 *
 * The scene is a separately loaded bundle, so the state lives on one global object: even if the bundler gives
 * the page and the scene their own copies of this module, they still talk to the same store.
 */
type Listener = (progress: number, intro: boolean, ready: boolean) => void;
type Store = { listeners: Set<Listener>; progress: number; intro: boolean; ready: boolean };

const store: Store = (() => {
  const fresh = (): Store => ({ listeners: new Set<Listener>(), progress: 0, intro: false, ready: false });
  if (typeof window === "undefined") return fresh();
  const w = window as unknown as { __filmLoading?: Store };
  return (w.__filmLoading ??= fresh());
})();
const emit = () => store.listeners.forEach((l) => l(store.progress, store.intro, store.ready));

export const loading = {
  set(p: number) { if (!store.ready && p > store.progress) { store.progress = Math.min(p, 0.99); emit(); } },
  intro() { if (!store.intro) { store.intro = true; emit(); } },
  done() { if (!store.ready) { store.ready = true; store.intro = true; store.progress = 1; emit(); } },
  on(l: Listener) { store.listeners.add(l); l(store.progress, store.intro, store.ready); return () => { store.listeners.delete(l); }; },
};
