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
//
// IMPORTANT: zone.js's disable flags use the EXACT __load_patch name as the
// suffix.  An earlier attempt at this fix used invented names like
// `__Zone_disable_unhandledPromiseRejections` / `__Zone_disable_fetch` /
// `__Zone_disable_ResizeObserver`, which zone.js silently ignores.  The
// real patch names (from grepping zone.js's source) are:
//   ZoneAwarePromise   — the Promise wrapper itself
//   PromiseRejectionEvent — the unhandled-rejection re-throw plumbing
//   on_property / XHR / MutationObserver / IntersectionObserver / FileReader
//   queueMicrotask / customElements / EventTarget / timers / blocking ...
const Z = globalThis as Record<string, unknown>;

// CRITICAL for React 18+ Suspense + TanStack Query.  Without this,
// every Promise constructed in user code becomes a `ZoneAwarePromise`.
// React Suspense throws those Promises to suspend, then the router
// retries them; each retry constructs ANOTHER ZoneAwarePromise wrapping
// the same underlying work, the rejection re-fires through zone.js's
// own globalCallback path, and we get "Maximum update depth exceeded"
// inside <Transitioner> forever.  Disabling the Promise patch makes
// `new Promise(...)` resolve to the native one, which Suspense and
// React's error boundary both handle correctly.
//
// Trade-off: zone-context propagation across `.then()` boundaries is
// no longer automatic.  In practice we don't depend on it — the babel
// plugin captures parent traceId at the IIFE-wrap site and emits
// enter/exit synchronously, and the recorder uses
// `traceContext.traceBundleId` (a snapshot) rather than walking
// Zone.current.  Sync code is unaffected.  Awaited inner calls still
// work because each call site has its own IIFE wrapper that snapshots
// the bundle id before awaiting.
if (Z.__Zone_disable_ZoneAwarePromise === undefined) {
  Z.__Zone_disable_ZoneAwarePromise = true;
}
// Also disable the unhandled-rejection re-throw path (defence in depth
// — with ZoneAwarePromise disabled this should no longer fire, but if
// some downstream lib re-enables it we still want the React-friendly
// behaviour).
if (Z.__Zone_disable_PromiseRejectionEvent === undefined) {
  Z.__Zone_disable_PromiseRejectionEvent = true;
}
// Don't patch on-* DOM property handlers (onload / onerror / etc) — modern
// React owns these and patching them causes spurious re-entrancy.
if (Z.__Zone_disable_on_property === undefined) {
  Z.__Zone_disable_on_property = true;
}
// Don't patch XHR — we don't need it for tracing user code, it just adds
// latency and surprises libraries that use AbortController.
if (Z.__Zone_disable_XHR === undefined) Z.__Zone_disable_XHR = true;
// Don't patch IntersectionObserver / MutationObserver — modern React /
// router / lazy-image libs hammer these, and patching them adds zone
// overhead with no tracing benefit for our use case.
if (Z.__Zone_disable_IntersectionObserver === undefined)
  Z.__Zone_disable_IntersectionObserver = true;
if (Z.__Zone_disable_MutationObserver === undefined)
  Z.__Zone_disable_MutationObserver = true;

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
