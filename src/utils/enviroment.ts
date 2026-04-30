//Environment class. for single instance.
class Environment {
  // Check runtime environment.  We need a check that's reliable when bundlers
  // polyfill `process` for the browser (Vite's `define`, webpack's
  // process/browser shim, etc.).  Pure `typeof process !== "undefined"` is a
  // false positive in those environments and used to send the Tracer down the
  // Node-only export strategy — which then failed because `fs` etc. weren't
  // really available, leaving the user with a half-rendered report.
  //
  // Strategy: trust DOM presence as the primary signal.  If a `window` or
  // `document` exists with the usual browser-DOM shape, treat as browser.
  // Otherwise check for genuine Node (`process.versions.node`, which polyfills
  // generally don't fake).
  static isNodeJS(): boolean {
    const g = globalThis as Record<string, unknown>;
    const hasDOM =
      typeof g.window !== "undefined" &&
      typeof g.document !== "undefined" &&
      // jsdom + real browsers expose addEventListener on window
      typeof (g.window as { addEventListener?: unknown }).addEventListener ===
        "function";
    if (hasDOM) return false;
    const p = g.process as
      | { versions?: { node?: string } }
      | undefined;
    return !!(p && p.versions && typeof p.versions.node === "string");
  }
}

export { Environment };
