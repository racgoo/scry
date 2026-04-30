// Re-exports zone.js so the babel plugin can inject `import "@racgoo/scry/zone"`
// instead of `import "zone.js"`. This keeps zone.js resolution inside scry's
// own node_modules, preventing "Cannot resolve zone.js" errors in consumer projects.
//
// IMPORTANT: zone.js is configured BEFORE it's imported.  Several patches
// it applies break modern React (18+) under Suspense / TanStack Query / etc.:
//
//   - The Promise patch wraps `then` callbacks in zones, which is exactly
//     what we need for tracing.  But it also routes UNHANDLED rejections
//     through `Zone.current.handleError → ZoneImpl.invokeTask` and
//     ultimately re-throws via `globalCallback` — which short-circuits
//     React's <ErrorBoundary> handling, surfacing user fetch errors as
//     `Uncaught {…}` and re-rendering forever ("Maximum update depth
//     exceeded" in <Transitioner> from TanStack Router).
//
//   - The unhandled-rejection plumbing is what causes the infinite loop:
//     React schedules a Suspense retry (a Promise), zone wraps it, the
//     fetch rejects again, zone re-throws via globalCallback, React
//     re-schedules another retry, and we're stuck.
//
// We disable just enough of zone's reactive plumbing to coexist with
// modern React without losing the per-call trace propagation we depend on.
const Z = globalThis as Record<string, unknown>;
// Don't surface rejections through globalCallback — let React's
// ErrorBoundary handle them as designed.  This is the single most
// important flag for React 18+ + Suspense compatibility.
if (Z.__Zone_disable_unhandledPromiseRejections === undefined) {
  Z.__Zone_disable_unhandledPromiseRejections = true;
}
// Don't patch the EventTarget queue micro-task system (replicates above
// pattern at the DOM-event level — same React-loop hazard).
if (Z.__Zone_disable_on_property === undefined) {
  Z.__Zone_disable_on_property = true;
}
// Skip XHR / fetch patches — we don't need them for tracing user code,
// they only add latency and break libraries that use AbortController
// in idiomatic ways.
if (Z.__Zone_disable_XHR === undefined) Z.__Zone_disable_XHR = true;
if (Z.__Zone_disable_fetch === undefined) Z.__Zone_disable_fetch = true;
// MutationObserver / IntersectionObserver / ResizeObserver patches —
// modern React uses these heavily; not patching them avoids surprise
// reentrancy.
if (Z.__Zone_disable_MutationObserver === undefined)
  Z.__Zone_disable_MutationObserver = true;
if (Z.__Zone_disable_IntersectionObserver === undefined)
  Z.__Zone_disable_IntersectionObserver = true;
if (Z.__Zone_disable_ResizeObserver === undefined)
  Z.__Zone_disable_ResizeObserver = true;

import "zone.js";
import { ScryAstVariable } from "./babel/scry.constant.js";

// Set the plugin-applied flag here as a side effect of importing this module.
// The babel plugin injects `import "@racgoo/scry/zone"` at the top of every
// transformed file, so any module that calls Tracer.start() / Tracer.end() is
// guaranteed to have evaluated this module first — ESM hoists static imports
// and evaluates them before the importing module's body. Setting the flag in
// the imported module's evaluation body (rather than as a statement in each
// transformed file) removes the ordering hazard where another module imports
// Tracer and calls Tracer.start() at top level before the flag assignment
// statement in some unrelated transformed file has had a chance to run.
//
// The plugin still emits its own `globalThis.scryPluginApplied = true;` line
// in each transformed file for redundancy and backwards compatibility with
// builds that may exclude this module, but the assignment here is what
// guarantees the flag is set before any user code that imports from
// `@racgoo/scry` runs (which transitively pulls this module in via the
// plugin-injected `import "@racgoo/scry/zone"`).
(globalThis as unknown as { [k: string]: boolean })[
  ScryAstVariable.pluginApplied
] = true;
