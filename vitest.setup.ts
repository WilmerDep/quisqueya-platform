// Vitest setup: ensure browser storage APIs come from jsdom, not Node's experimental globals.
if (typeof window !== 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: window.localStorage,
  });

  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: window.sessionStorage,
  });
}
