// Re-exports zone.js so the babel plugin can inject `import "@racgoo/scry/zone"`
// instead of `import "zone.js"`. This keeps zone.js resolution inside scry's
// own node_modules, preventing "Cannot resolve zone.js" errors in consumer projects.
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
