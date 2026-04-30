// Shared helpers for jsdom-based end-to-end tests.
//
// Each test wants the same "real browser" setup:
//   1. Spin up a window/document/CustomEvent/dispatchEvent.
//   2. Wire those onto Node's globalThis so the runtime listener and the
//      transformed user-code emit share a single EventTarget.
//   3. Transform an inline source with the actual scry babel plugin
//      (NODE_ENV=development).
//   4. Strip the plugin-injected scry imports — we already loaded the
//      runtime — and eval what's left.
//   5. Assert on the resulting trace tree, recorder counters, and the
//      __INJECTION_DATA__ string the WebUI will actually receive.
//
// All of that lives here so individual tests stay readable.

import { transformSync } from "@babel/core";
import { JSDOM } from "jsdom";
import { scryBabelPlugin } from "../../src/babel/index.js";
import Tracer from "../../src/tracer/tracer.js";
import { NodeGenerator } from "../../src/tracer/node/nodeGenerator.js";
import { Transformer } from "../../src/utils/transformer.js";
import type { TraceNode } from "../../src/tracer/node/type.js";
import Extractor from "../../src/utils/extractor.js";

export interface E2ECtx {
  /** Per-test Tracer instance — listener registered to the SAME globalThis
   *  the transformed code dispatches to (mirrors prod). */
  tracer: InstanceType<typeof Tracer>;
  /** Snapshot of every detail the listener saw, in arrival order. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  captured: any[];
  /** Cleanup; call from afterEach. */
  cleanup: () => void;
}

const SAVED_GLOBAL_KEYS = [
  "window",
  "document",
  "CustomEvent",
  "Event",
  "dispatchEvent",
  "addEventListener",
  "removeEventListener",
] as const;

export function setupJsdomGlobals(): () => void {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
    url: "http://localhost/",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saved: Record<string, any> = {};
  for (const k of SAVED_GLOBAL_KEYS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    saved[k] = (globalThis as any)[k];
    const v = (w as unknown as Record<string, unknown>)[k];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any)[k] = typeof v === "function" ? (v as any).bind(w) : v;
  }
  return () => {
    for (const k of SAVED_GLOBAL_KEYS) {
      if (saved[k] === undefined)
        delete (globalThis as Record<string, unknown>)[k];
      else (globalThis as Record<string, unknown>)[k] = saved[k];
    }
  };
}

export async function setupE2E(): Promise<E2ECtx> {
  const cleanupGlobals = setupJsdomGlobals();
  const tracer = new Tracer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const captured: any[] = [];
  const onTrace = (e: Event) => {
    captured.push((e as CustomEvent).detail);
  };
  window.addEventListener("__SCRY_TRACE_EVENT_NAME__", onTrace);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Tracer = tracer;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Extractor = Extractor;

  return {
    tracer,
    captured,
    cleanup: () => {
      window.removeEventListener("__SCRY_TRACE_EVENT_NAME__", onTrace);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (tracer as any).recorder?.destroy?.();
      cleanupGlobals();
    },
  };
}

/** Transform user source with scry plugin (NODE_ENV=development), strip
 *  plugin-injected scry imports (Tracer/Extractor are already on globalThis),
 *  and return the runnable code string.
 *
 *  Tests pass arbitrary user-shape snippets as the source, sometimes ending
 *  in a top-level `return ...` statement (so they can hand a Promise back
 *  to the harness for awaiting).  Those aren't valid at module top-level,
 *  so we wrap the whole thing in `(function () { ... })()` BEFORE babel
 *  parses — that way the test fixture grammar is "function body", not
 *  "module body". */
export function transformAndStrip(src: string): string {
  const wrapped = `(function () {\n${src}\n})()`;
  const orig = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  let out: ReturnType<typeof transformSync>;
  try {
    out = transformSync(wrapped, {
      filename: "/test/sim.ts",
      presets: [["@babel/preset-typescript", { allExtensions: true }]],
      plugins: [scryBabelPlugin],
      babelrc: false,
      configFile: false,
      sourceType: "module",
    });
  } finally {
    process.env.NODE_ENV = orig;
  }
  if (!out?.code) throw new Error("transform produced no code");
  // Drop ALL `import` lines — runtime is already loaded; the only imports
  // injected by the plugin are scry ones, which would fail under
  // `new Function`.  Stripping is safe because user fixtures here never
  // import anything else.
  // We also need to surface the wrapper IIFE's return value so the harness
  // can await an async fixture.  Replace the trailing `})()` with a
  // `return (function...)()`.
  const code = out.code.replace(/^import.*$/gm, "");
  // The transform may add markers / IIFEs around our wrapper; locate the
  // outermost `(function () {`...`})()` and prepend a `return`.
  // Easiest: just append a top-level return that evaluates the same form.
  // The wrapper is the last statement; capturing its result is awkward.
  // Instead: have the wrapper assign to a known global, and return it.
  return code;
}

/** Like transformAndStrip but the source is treated as a function body and
 *  its return value (if any) is propagated to the caller via a known
 *  global slot.  Used for async fixtures that want to hand back a Promise. */
export function transformBodyReturning(src: string): string {
  const wrapped = `globalThis.__SCRY_TEST_RESULT__ = (function () {\n${src}\n})()`;
  const orig = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  let out: ReturnType<typeof transformSync>;
  try {
    out = transformSync(wrapped, {
      filename: "/test/sim.ts",
      presets: [["@babel/preset-typescript", { allExtensions: true }]],
      plugins: [scryBabelPlugin],
      babelrc: false,
      configFile: false,
      sourceType: "module",
    });
  } finally {
    process.env.NODE_ENV = orig;
  }
  if (!out?.code) throw new Error("transform produced no code");
  return out.code.replace(/^import.*$/gm, "");
}

export interface E2EOutcome {
  /** Tree the NodeGenerator would build for this Tracer.start session. */
  tree: TraceNode[];
  /** Number of bundles the recorder has (one per Tracer.start call). */
  bundleCount: number;
  /** All flat detail records for the most recent bundle. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: any[];
  /** What the WebUI actually receives on window.__INJECTION_DATA__. */
  injectionString: string;
  /** Decoded version of injectionString — the array the WebUI deserializes. */
  decodedInjection: TraceNode[];
}

/** Run user source as a synchronous IIFE under jsdom and return the trace
 *  outcome plus a string snapshot of what the WebUI would render from.
 *
 *  The fixture is wrapped in an IIFE before transform so it can use
 *  top-level `return` to hand back a Promise from async fixtures.  The
 *  return value lands on globalThis.__SCRY_TEST_RESULT__. */
export async function runAndCollect(
  ctx: E2ECtx,
  src: string,
  opts: { settleMs?: number } = {}
): Promise<E2EOutcome> {
  const stripped = transformBodyReturning(src);
  // Reset the slot so a previous run can't leak.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__SCRY_TEST_RESULT__ = undefined;
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const fn = new Function(stripped);
  fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (globalThis as any).__SCRY_TEST_RESULT__;
  if (result && typeof result.then === "function") await result;
  await new Promise((r) => setTimeout(r, opts.settleMs ?? 200));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rec = (ctx.tracer as any).recorder;
  const bundles = Array.from(rec.bundleMap.values()) as Array<{
    details: unknown[];
  }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastBundleId = Math.max(...(Array.from(rec.bundleMap.keys()) as any[]));
  const bundle = rec.bundleMap.get(lastBundleId);
  const details = bundle?.details ?? [];
  const generator = new NodeGenerator();
  const tree = generator.generateNodesWithTraceDetails(
    details
  ) as unknown as TraceNode[];
  const injectionString = Transformer.serialize(tree);
  const decodedInjection = Transformer.deserialize(injectionString);
  return {
    tree,
    bundleCount: bundles.length,
    details,
    injectionString,
    decodedInjection,
  };
}

/** Flat list of node names depth-first across the whole tree. */
export function flatNames(nodes: TraceNode[]): string[] {
  const out: string[] = [];
  const walk = (list: TraceNode[]) => {
    for (const n of list) {
      out.push(n.name);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

/** First node in tree (DFS) matching name. */
export function findByName(
  nodes: TraceNode[],
  name: string
): TraceNode | undefined {
  for (const n of nodes) {
    if (n.name === name) return n;
    const c = findByName(n.children, name);
    if (c) return c;
  }
  return undefined;
}
