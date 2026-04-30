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
const ZONE_DISABLE_BANNER = `
;(function(){
  if (typeof globalThis === "undefined") return;
  var Z = globalThis;
  // Disable Promise wrapping — the actual cause of React 18 + Suspense +
  // TanStack Query infinite loops ("Maximum update depth exceeded" inside
  // <Transitioner>).  Native Promise lets React's error boundary and
  // Suspense retry behave normally.
  if (Z.__Zone_disable_ZoneAwarePromise === undefined)
    Z.__Zone_disable_ZoneAwarePromise = true;
  // Defence in depth: even if some lib re-enables ZoneAwarePromise, don't
  // re-throw rejections through zone's globalCallback path.
  if (Z.__Zone_disable_PromiseRejectionEvent === undefined)
    Z.__Zone_disable_PromiseRejectionEvent = true;
  // on_property: don't patch onload / onerror / etc — modern React owns
  // those handlers and patching causes spurious re-entrancy.
  if (Z.__Zone_disable_on_property === undefined)
    Z.__Zone_disable_on_property = true;
  // XHR / observers: not needed for trace-context propagation, only adds
  // overhead and surprises libraries that use AbortController / observers
  // in idiomatic ways.
  if (Z.__Zone_disable_XHR === undefined) Z.__Zone_disable_XHR = true;
  if (Z.__Zone_disable_IntersectionObserver === undefined)
    Z.__Zone_disable_IntersectionObserver = true;
  if (Z.__Zone_disable_MutationObserver === undefined)
    Z.__Zone_disable_MutationObserver = true;
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
