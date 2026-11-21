/**
 * Writes inline styles and CSS variables only when their value changes. The overlays are driven every frame;
 * rewriting unchanged values would make the browser recalculate styles for nothing, which costs frames on phones.
 */
export function styleWriter(el: HTMLElement) {
  const last = new Map<string, string>();
  return (key: string, value: string | number) => {
    const v = typeof value === "number" ? value.toFixed(3) : value;
    if (last.get(key) === v) return;
    last.set(key, v);
    if (key.startsWith("--")) el.style.setProperty(key, v);
    else (el.style as unknown as Record<string, string>)[key] = v;
  };
}
