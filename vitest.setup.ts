import "@testing-library/jest-dom/vitest";

if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = () => "blob:test";
}

if (!globalThis.URL.revokeObjectURL) {
  globalThis.URL.revokeObjectURL = () => undefined;
}

if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false
    })
  });
}
