import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

/* jsdom in this setup does not provide localStorage, so anything that persists
 * state (DataTable's filter/Me Mode/advanced-filter memory) silently no-ops
 * under test and cannot be asserted on. Same reason matchMedia is shimmed
 * above. In-memory, per-run, and standards-shaped enough for the callers. */
if (!("localStorage" in window) || !window.localStorage) {
  const store = new Map<string, string>();
  const localStorageShim: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => void store.delete(key),
    setItem: (key: string, value: string) => void store.set(key, String(value)),
  };
  Object.defineProperty(window, "localStorage", {
    writable: true,
    configurable: true,
    value: localStorageShim,
  });
}
