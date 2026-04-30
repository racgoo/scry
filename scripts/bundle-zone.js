// Bundle zone.js content directly into dist/esm/zone-init.js and
// dist/cjs/zone-init.cjs so consumers never need to resolve zone.js
// themselves. Without this, pnpm's isolated node_modules would cause
// "Failed to resolve import 'zone.js'" in projects that don't list
// zone.js as a direct dependency.
import esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// CRITICAL: zone.js inspects `__Zone_disable_<patchName>` ON THE GLOBAL
// at evaluation time.  ESM hoists `import "zone.js"` ABOVE any module-body
// statement that tries to set those flags, so doing it from `zone-init.ts`
// is too late — zone.js has already registered its patches.
//
// The only way to set them in the right order, given the bundler context,
// is to PREPEND the flag assignments to the bundled output via esbuild's
// `banner` option.  The banner runs BEFORE the bundled zone.js code, so
// the patches actually see the disable flags.
//
// Patch names verified against zone.js's own `Zone.__load_patch(...)` calls
// — invented names are silently ignored.
// We only need the Zone API itself (Zone.current.fork({...}).run(cb)) for
// trace-context propagation through plugin-emitted IIFEs.  We do NOT need
// any of zone.js's automatic browser-API patches — the babel plugin
// handles trace context manually at every call site.  Every patch we
// leave on is just blast radius for React/lib compatibility bugs.
//
// Disabling each one individually (zone.js has no global "patch nothing"
// flag).  Names verified against `Zone.__load_patch(...)` calls in
// zone.js's source.
// Each flag is written as a literal `__Zone_disable_<name>` string so it's
// trivially greppable from the bundled output (regression test gates on
// these literals).  Every entry uses `=== undefined` so a downstream
// consumer can opt back into a specific patch by setting the flag false
// BEFORE importing scry.
const ZONE_DISABLE_BANNER = `
;(function(){
  if (typeof globalThis === "undefined") return;
  var Z = globalThis;
  // Promise: wrapping causes React 18 + Suspense + TanStack Query
  // infinite loops ("Maximum update depth exceeded" in <Transitioner>).
  if (Z.__Zone_disable_ZoneAwarePromise === undefined) Z.__Zone_disable_ZoneAwarePromise = true;
  // PromiseRejectionEvent: rejection re-throws via globalCallback,
  // React's <ErrorBoundary> can't intercept.
  if (Z.__Zone_disable_PromiseRejectionEvent === undefined) Z.__Zone_disable_PromiseRejectionEvent = true;
  // EventTarget: wraps every addEventListener handler.  When a user
  // fetch error bubbles into a click/submit handler, zone re-throws
  // it via globalCallback before React's invokeGuardedCallback can
  // mark it caught — surfaces as Uncaught fetch errors.
  if (Z.__Zone_disable_EventTarget === undefined) Z.__Zone_disable_EventTarget = true;
  // on_property: onload / onerror / etc.  Modern React owns these.
  if (Z.__Zone_disable_on_property === undefined) Z.__Zone_disable_on_property = true;
  // Timers / microtasks / animation — wrap user callbacks; not needed
  // for our trace context (plugin fork()s a zone at each call site).
  if (Z.__Zone_disable_timers === undefined) Z.__Zone_disable_timers = true;
  if (Z.__Zone_disable_blocking === undefined) Z.__Zone_disable_blocking = true;
  if (Z.__Zone_disable_requestAnimationFrame === undefined) Z.__Zone_disable_requestAnimationFrame = true;
  if (Z.__Zone_disable_queueMicrotask === undefined) Z.__Zone_disable_queueMicrotask = true;
  // Network / DOM observer patches — not needed for trace propagation,
  // surprisingly invasive in modern apps.
  if (Z.__Zone_disable_XHR === undefined) Z.__Zone_disable_XHR = true;
  if (Z.__Zone_disable_FileReader === undefined) Z.__Zone_disable_FileReader = true;
  if (Z.__Zone_disable_MutationObserver === undefined) Z.__Zone_disable_MutationObserver = true;
  if (Z.__Zone_disable_IntersectionObserver === undefined) Z.__Zone_disable_IntersectionObserver = true;
  if (Z.__Zone_disable_customElements === undefined) Z.__Zone_disable_customElements = true;
  if (Z.__Zone_disable_geolocation === undefined) Z.__Zone_disable_geolocation = true;
  // Legacy IE / pre-Promise polyfill plumbing.
  if (Z.__Zone_disable_legacy === undefined) Z.__Zone_disable_legacy = true;
  if (Z.__Zone_disable_toString === undefined) Z.__Zone_disable_toString = true;
})();
`;

// ESM output – keep as ES module
await esbuild.build({
  entryPoints: [path.join(root, "src/zone-init.ts")],
  bundle: true,
  format: "esm",
  outfile: path.join(root, "dist/esm/zone-init.js"),
  platform: "browser",
  conditions: ["browser", "import", "default"],
  allowOverwrite: true,
  banner: { js: ZONE_DISABLE_BANNER },
  logLevel: "info",
});

// CJS output
await esbuild.build({
  entryPoints: [path.join(root, "src/zone-init.ts")],
  bundle: true,
  format: "cjs",
  outfile: path.join(root, "dist/cjs/zone-init.cjs"),
  platform: "node",
  conditions: ["require", "default"],
  allowOverwrite: true,
  banner: { js: ZONE_DISABLE_BANNER },
  logLevel: "info",
});

console.log("zone-init bundled successfully (with zone.js disable banner)");
