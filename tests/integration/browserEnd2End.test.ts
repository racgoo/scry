import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { transformSync } from "@babel/core";
import { JSDOM } from "jsdom";
import { scryBabelPlugin } from "../../src/babel/index.js";

// End-to-end browser emit path:
// 1. Spin up a jsdom window so window/document/CustomEvent/dispatchEvent
//    exist (the prod-browser branch the existing process.emit-based tests
//    never hit).
// 2. Wire jsdom's globals onto Node's globalThis so the runtime listener
//    (TraceRecorder.initEventListener -> globalThis.addEventListener) and
//    user-code emit (globalThis.dispatchEvent) share the same EventTarget.
// 3. Transform a small piece of user code with the actual scry babel plugin
//    (NODE_ENV=development), then evaluate the transformed source under
//    jsdom and assert that:
//       - the listener received non-zero raw events,
//       - the recorder bundle ended up populated,
//       - the resulting tree contains the expected names.
//
// This is the harness that found the real-world Vite bug where users were
// getting empty `__INJECTION_DATA__` ("[[]]") despite emit clearly happening
// in the page — manual repro that lived in /tmp; baking it into the test
// suite so future regressions of the same shape get caught automatically.
describe("Integration: browser end-to-end (jsdom)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saved: Record<string, any> = {};

  beforeAll(() => {
    const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
      url: "http://localhost/",
      pretendToBeVisual: true,
    });
    const w = dom.window;
    for (const k of [
      "window",
      "document",
      "CustomEvent",
      "Event",
      "dispatchEvent",
      "addEventListener",
      "removeEventListener",
    ] as const) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      saved[k] = (globalThis as any)[k];
      const v = (w as unknown as Record<string, unknown>)[k];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any)[k] = typeof v === "function" ? (v as any).bind(w) : v;
    }
  });

  afterAll(() => {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined)
        delete (globalThis as Record<string, unknown>)[k];
      else (globalThis as Record<string, unknown>)[k] = saved[k];
    }
  });

  it("transformed user code emits and recorder records under jsdom", async () => {
    // Capture raw events that the transformed code dispatches.
    const captured: { type: string; name: string }[] = [];
    const listener = (e: Event) => {
      const detail = (e as CustomEvent).detail as { type: string; name: string };
      captured.push({ type: detail.type, name: detail.name });
    };
    window.addEventListener("__SCRY_TRACE_EVENT_NAME__", listener);

    // Eagerly load the runtime listener BEFORE eval'ing the user code.
    await import("../../src/zone-init.js");
    const { default: Tracer } = await import("../../src/tracer/tracer.js");
    const { default: Extractor } = await import("../../src/utils/extractor.js");
    const tracer = new Tracer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Tracer = tracer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Extractor = Extractor;

    // The exact user shape that hit the empty-trace bug in prod.
    const userSrc = `
      const setObstacles = () => {};
      const test = () => { /* no-op */ };
      function spawnObstacle() {
        Tracer.start("spawnObstacle");
        test();
        const lanes = [-2, 0, 2];
        const r = lanes[Math.floor(Math.random() * lanes.length)];
        const o = { x: r, y: -10, type: Math.random() < 0.5 ? "rock" : "sign" };
        Tracer.end();
        setObstacles((p) => [...p, o]);
      }
      spawnObstacle();
    `;
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    let out: ReturnType<typeof transformSync>;
    try {
      out = transformSync(userSrc, {
        filename: "/sim.ts",
        presets: [["@babel/preset-typescript", { allExtensions: true }]],
        plugins: [scryBabelPlugin],
        babelrc: false,
        configFile: false,
        sourceType: "module",
      });
    } finally {
      process.env.NODE_ENV = origEnv;
    }
    expect(out?.code).toBeTruthy();

    // Strip plugin-injected imports — we already loaded the runtime above.
    const stripped = out!.code!.replace(/^import.*$/gm, "");
    // Run the transformed user code synchronously.  Tracer.start/end wrap
    // sync work in this fixture, so `spawnObstacle()` returns before this
    // line yields.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    new Function(stripped)();

    // Give Tracer.end()'s async waitAllContextDone a chance to settle.
    await new Promise((r) => setTimeout(r, 200));

    // 1. Listener actually heard events — proves emit and listener share a
    //    globalThis (the regression Vite users hit).
    expect(captured.length).toBeGreaterThan(0);
    const names = new Set(captured.map((c) => c.name));
    expect(names.has("test")).toBe(true);
    expect(names.has("random")).toBe(true);
    expect(names.has("floor")).toBe(true);

    // 2. Recorder accepted them (non-null bundleId) and produced a non-empty
    //    bundle for this Tracer.start session.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = (tracer as any).recorder;
    const bundles = Array.from(rec.bundleMap.values()) as Array<{
      details: unknown[];
      description: string;
    }>;
    expect(bundles.length).toBe(1);
    expect(bundles[0].description).toBe("spawnObstacle");
    expect(bundles[0].details.length).toBeGreaterThan(0);

    // 3. Diagnostic counters used by the empty-tree panel are populated.
    expect(rec._rawEventCount).toBeGreaterThan(0);
    expect(rec._listenerKind).toBe("globalThis");
    expect(rec._droppedNullBundle).toBeLessThan(rec._rawEventCount);

    window.removeEventListener("__SCRY_TRACE_EVENT_NAME__", listener);
  });
});
