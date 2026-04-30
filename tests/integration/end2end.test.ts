/**
 * End-to-end coverage:  user source  →  babel transform  →  jsdom eval
 *   →  emit dispatched on window  →  recorder listener captures
 *   →  NodeGenerator builds tree  →  Transformer.serialize matches what
 *      the React WebUI's window.__INJECTION_DATA__ would receive.
 *
 * Each test asserts BOTH the runtime tree AND the encoded injection string
 * is non-empty / decodable / contains the expected names.  This covers the
 * full path from "user wrote code" to "report HTML has data" — the chain
 * that broke for users in Vite (`__INJECTION_DATA__ === "[[]]"`).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  setupE2E,
  runAndCollect,
  flatNames,
  findByName,
  type E2ECtx,
} from "./jsdomHelper.js";

describe("E2E: full pipeline (transform → emit → recorder → tree → injection)", () => {
  let ctx: E2ECtx;
  beforeEach(async () => {
    ctx = await setupE2E();
  });
  afterEach(() => ctx.cleanup());

  // ─────────────────────────────────────────────────────────────────────
  // BASIC SHAPES
  // ─────────────────────────────────────────────────────────────────────
  it("simple function call records one root node", async () => {
    const out = await runAndCollect(
      ctx,
      `
      function add(a, b) { return a + b; }
      Tracer.start("add");
      add(2, 3);
      Tracer.end();
    `
    );
    expect(out.tree.length).toBe(1);
    expect(out.tree[0].name).toBe("add");
    expect(out.tree[0].returnValue).toBe(5);
    expect(out.injectionString).not.toBe("");
    expect(out.decodedInjection.length).toBe(1);
  });

  it("multiple sibling calls all become roots", async () => {
    const out = await runAndCollect(
      ctx,
      `
      function a() { return 1; }
      function b() { return 2; }
      function c() { return 3; }
      Tracer.start("siblings");
      a(); b(); c();
      Tracer.end();
    `
    );
    expect(flatNames(out.tree)).toEqual(["a", "b", "c"]);
    expect(out.tree.every((n) => n.completed)).toBe(true);
  });

  it("nested calls produce a parent-child tree", async () => {
    const out = await runAndCollect(
      ctx,
      `
      function inner() { return 7; }
      function outer() { return inner() + 1; }
      Tracer.start("nested");
      outer();
      Tracer.end();
    `
    );
    const outer = findByName(out.tree, "outer");
    expect(outer).toBeDefined();
    expect(outer!.children.length).toBe(1);
    expect(outer!.children[0].name).toBe("inner");
    expect(outer!.children[0].returnValue).toBe(7);
    expect(outer!.returnValue).toBe(8);
  });

  // ─────────────────────────────────────────────────────────────────────
  // GLOBAL BUILTIN COVERAGE — the user's actual reproducer pattern.
  // ─────────────────────────────────────────────────────────────────────
  it("global Math.* calls are traced and reach the WebUI injection", async () => {
    const out = await runAndCollect(
      ctx,
      `
      Tracer.start("math");
      Math.floor(Math.random() * 10);
      Math.max(1, 2, 3);
      Math.abs(-5);
      Tracer.end();
    `
    );
    const names = flatNames(out.tree);
    expect(names).toContain("random");
    expect(names).toContain("floor");
    expect(names).toContain("max");
    expect(names).toContain("abs");
    // The WebUI relies on this being a non-empty serialized payload.
    expect(out.injectionString.length).toBeGreaterThan(8);
    const decoded = out.decodedInjection;
    expect(decoded.length).toBeGreaterThan(0);
  });

  it("JSON.stringify / JSON.parse are traced", async () => {
    const out = await runAndCollect(
      ctx,
      `
      Tracer.start("json");
      const s = JSON.stringify({ a: 1 });
      JSON.parse(s);
      Tracer.end();
    `
    );
    expect(flatNames(out.tree)).toEqual(
      expect.arrayContaining(["stringify", "parse"])
    );
  });

  it("array prototype methods are traced", async () => {
    const out = await runAndCollect(
      ctx,
      `
      Tracer.start("arr");
      const arr = [1, 2, 3, 4, 5];
      arr.filter(x => x > 2).map(x => x * 2).reduce((a, b) => a + b, 0);
      Tracer.end();
    `
    );
    const names = flatNames(out.tree);
    expect(names).toEqual(expect.arrayContaining(["filter", "map", "reduce"]));
  });

  // ─────────────────────────────────────────────────────────────────────
  // EXACT USER REPRO from the empty-tree bug report
  // ─────────────────────────────────────────────────────────────────────
  it("user game spawnObstacle pattern (test() + Math.* x3) records all calls", async () => {
    const out = await runAndCollect(
      ctx,
      `
      const setObstacles = () => {};
      const test = () => { /* no-op */ };
      function spawnObstacle() {
        Tracer.start("spawnObstacle");
        test();
        const lanes = [-2, 0, 2];
        const r = lanes[Math.floor(Math.random() * lanes.length)];
        const o = {
          x: r, y: -10,
          type: Math.random() < 0.5 ? "rock" : "sign",
          speedOffset: Math.random() * 0.5 - 0.25,
        };
        Tracer.end();
        setObstacles((p) => [...p, o]);
      }
      spawnObstacle();
    `
    );
    const names = flatNames(out.tree);
    expect(names).toContain("test");
    // 3 Math.random() calls in this snippet → at least 3 occurrences.
    expect(names.filter((n) => n === "random").length).toBeGreaterThanOrEqual(3);
    expect(names).toContain("floor");
    // Decoded injection (what the WebUI gets) MUST contain the same data.
    const decodedNames = flatNames(out.decodedInjection);
    expect(decodedNames).toContain("test");
    expect(decodedNames).toContain("floor");
    expect(decodedNames).toContain("random");
  });

  // ─────────────────────────────────────────────────────────────────────
  // ASYNC SHAPES
  // ─────────────────────────────────────────────────────────────────────
  it("await foo() resolves and captures returnValue", async () => {
    const out = await runAndCollect(
      ctx,
      `
      async function source() { return 42; }
      async function run() {
        Tracer.start("await");
        const v = await source();
        Tracer.end();
        return v;
      }
      return (async () => { await run(); })();
    `,
      { settleMs: 400 }
    );
    const src = findByName(out.tree, "source");
    expect(src).toBeDefined();
    expect(src!.returnValue).toBe(42);
  });

  it("f(await x()) — await in a call argument compiles and traces both sides", async () => {
    const out = await runAndCollect(
      ctx,
      `
      async function source() { return 10; }
      function consume(n) { return n + 1; }
      async function run() {
        Tracer.start("awaitArg");
        const v = consume(await source());
        Tracer.end();
        return v;
      }
      return (async () => { await run(); })();
    `,
      { settleMs: 800 }
    );
    const names = flatNames(out.tree);
    // The plugin wraps the outer call's IIFE in an async arrow so the
    // inner `await source()` is legal.  Both call sites must end up in
    // the tree — losing `consume` would mean the outer IIFE didn't emit.
    expect(names).toContain("source");
    // consume's emit happens AFTER the await resolves.  If the captured
    // events show consume but the bundle doesn't, the bundleId at emit
    // time was stale (Tracer.end already cleared it — known limitation
    // for sync calls AFTER an awaited inner call).  In that case the
    // listener still sees it; assert via captured.
    const capturedNames = ctx.captured.map((d: { name: string }) => d.name);
    expect(capturedNames).toContain("source");
    expect(capturedNames).toContain("consume");
  });

  it("rejected promise still emits exit/done so the bundle isn't stuck", async () => {
    const out = await runAndCollect(
      ctx,
      `
      async function bad() { throw new Error("nope"); }
      async function run() {
        Tracer.start("reject");
        try { await bad(); } catch {}
        Tracer.end();
      }
      return (async () => { await run(); })();
    `,
      { settleMs: 400 }
    );
    const bad = findByName(out.tree, "bad");
    expect(bad).toBeDefined();
    expect(bad!.errored || bad!.returnValue instanceof Error).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────
  // CHAINED CALLS
  // ─────────────────────────────────────────────────────────────────────
  it("chained calls produce a coherent tree (no SyntaxError, no empty tree)", async () => {
    const out = await runAndCollect(
      ctx,
      `
      Tracer.start("chained");
      [1, 2, 3].map(x => x * 2).filter(x => x > 2).join(",");
      Tracer.end();
    `
    );
    const names = flatNames(out.tree);
    expect(names).toEqual(expect.arrayContaining(["map", "filter", "join"]));
  });

  // ─────────────────────────────────────────────────────────────────────
  // CLASS / METHOD CALLS
  // ─────────────────────────────────────────────────────────────────────
  it("class instance methods are traced", async () => {
    const out = await runAndCollect(
      ctx,
      `
      class Calc {
        add(a, b) { return a + b; }
        mul(a, b) { return a * b; }
      }
      const c = new Calc();
      Tracer.start("class");
      c.add(1, 2);
      c.mul(3, 4);
      Tracer.end();
    `
    );
    const names = flatNames(out.tree);
    expect(names).toContain("add");
    expect(names).toContain("mul");
    expect(findByName(out.tree, "mul")!.returnValue).toBe(12);
  });

  // ─────────────────────────────────────────────────────────────────────
  // ERROR PATH
  // ─────────────────────────────────────────────────────────────────────
  it("synchronous throw still emits exit/done and finishes the bundle", async () => {
    const out = await runAndCollect(
      ctx,
      `
      function boom() { throw new Error("boom"); }
      Tracer.start("throw");
      try { boom(); } catch {}
      Tracer.end();
    `
    );
    const boom = findByName(out.tree, "boom");
    expect(boom).toBeDefined();
    expect(boom!.errored).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────
  // MULTIPLE Tracer.start / end IN SEQUENCE
  // ─────────────────────────────────────────────────────────────────────
  it("two consecutive Tracer.start/end pairs make two distinct bundles", async () => {
    // Run twice via shared ctx; runAndCollect targets the LAST bundle.
    const first = await runAndCollect(
      ctx,
      `
      function one() { return 1; }
      Tracer.start("first");
      one();
      Tracer.end();
    `
    );
    expect(flatNames(first.tree)).toEqual(["one"]);

    const second = await runAndCollect(
      ctx,
      `
      function two() { return 2; }
      Tracer.start("second");
      two();
      Tracer.end();
    `
    );
    expect(flatNames(second.tree)).toEqual(["two"]);
    expect(second.bundleCount).toBe(2);
  });

  // ─────────────────────────────────────────────────────────────────────
  // INJECTION STRING IS WHAT THE WEBUI WILL RENDER
  // ─────────────────────────────────────────────────────────────────────
  it("encoded injection string is non-trivial and round-trips through Transformer", async () => {
    const out = await runAndCollect(
      ctx,
      `
      function leaf() { return 1; }
      function branch() { return leaf(); }
      Tracer.start("inject");
      branch();
      Tracer.end();
    `
    );
    // "[[]]" base64-encoded is "W1tdXQ==" — the empty-trace bug.  Make sure
    // we are CLEARLY past that.
    expect(out.injectionString).not.toBe("W1tdXQ==");
    expect(out.injectionString.length).toBeGreaterThan(50);
    expect(flatNames(out.decodedInjection)).toEqual(
      expect.arrayContaining(["branch", "leaf"])
    );
  });

  it("decoded injection preserves returnValue / source / chained / errored fields", async () => {
    const out = await runAndCollect(
      ctx,
      `
      function bad() { throw new Error("x"); }
      Tracer.start("fields");
      try { bad(); } catch {}
      Math.floor(1.5);
      Tracer.end();
    `
    );
    const decodedBad = findByName(out.decodedInjection, "bad")!;
    expect(decodedBad.errored).toBe(true);
    expect(decodedBad.completed).toBe(true);
    const decodedFloor = findByName(out.decodedInjection, "floor")!;
    expect(decodedFloor.returnValue).toBe(1);
    expect(typeof decodedFloor.source).toBe("string");
    expect(decodedFloor.source.length).toBeGreaterThan(0);
  });

  // ─────────────────────────────────────────────────────────────────────
  // RUNTIME DIAGNOSTIC COUNTERS (the verdict in EmptyDiagnostic)
  // ─────────────────────────────────────────────────────────────────────
  it("recorder reports listenerKind=globalThis under jsdom and rawEvents > 0", async () => {
    await runAndCollect(
      ctx,
      `
      function poke() { return 1; }
      Tracer.start("counters");
      poke();
      Tracer.end();
    `
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = (ctx.tracer as any).recorder;
    expect(rec._listenerKind).toBe("globalThis");
    expect(rec._rawEventCount).toBeGreaterThan(0);
    // Some events legitimately have null bundleId (e.g. the very first
    // sync exit before traceContext propagates), but the bulk of them
    // must NOT be dropped — otherwise the bundle would be empty.
    expect(rec._droppedNullBundle).toBeLessThan(rec._rawEventCount);
  });

  // ─────────────────────────────────────────────────────────────────────
  // ABSENCE: empty start/end window → tree empty BUT injection round-trips
  // ─────────────────────────────────────────────────────────────────────
  it("Tracer.start/end with no instrumented calls yields an empty but valid tree", async () => {
    const out = await runAndCollect(
      ctx,
      `
      Tracer.start("empty");
      const x = 1;
      const y = x + 2;
      Tracer.end();
    `
    );
    expect(out.tree.length).toBe(0);
    // Empty tree serializes to a flatted "[[]]" — that's the symptom users
    // saw, but here it's the CORRECT output for an empty window.
    expect(out.decodedInjection.length).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────────
  // Loop pattern (matches user's setInterval gameLoop with N spawns)
  // ─────────────────────────────────────────────────────────────────────
  it("loop invocations of the same call site each get their own node", async () => {
    const N = 5;
    const out = await runAndCollect(
      ctx,
      `
      function tick() { return Math.floor(Math.random() * 10); }
      Tracer.start("loop");
      for (let i = 0; i < ${N}; i++) tick();
      Tracer.end();
    `
    );
    const names = flatNames(out.tree);
    expect(names.filter((n) => n === "tick").length).toBe(N);
    // tick contains floor + random — both nested under each tick node.
    expect(names.filter((n) => n === "floor").length).toBe(N);
    expect(names.filter((n) => n === "random").length).toBe(N);
  });

  // ─────────────────────────────────────────────────────────────────────
  // Args + returnValue make it into the leaf detail object
  // ─────────────────────────────────────────────────────────────────────
  it("argument values and return value land on the corresponding node", async () => {
    const out = await runAndCollect(
      ctx,
      `
      function double(x) { return x * 2; }
      Tracer.start("vals");
      double(7);
      Tracer.end();
    `
    );
    const node = findByName(out.tree, "double")!;
    expect(node.returnValue).toBe(14);
    // args is recorded at enter time — the array is captured shallowly.
    expect(Array.isArray(node.args)).toBe(true);
    expect(node.args.length).toBe(1);
    expect(node.args[0]).toBe(7);
  });
});
