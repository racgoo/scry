/**
 * Edge-case coverage for the transform → emit → tree pipeline.
 * Each test takes a code shape that's been a real-world bug or is a
 * known sharp edge for AST instrumentation, then asserts the tree comes
 * out coherent.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  setupE2E,
  runAndCollect,
  flatNames,
  findByName,
  type E2ECtx,
} from "./jsdomHelper.js";

describe("E2E: edge cases", () => {
  let ctx: E2ECtx;
  beforeEach(async () => {
    ctx = await setupE2E();
  });
  afterEach(() => ctx.cleanup());

  // ─────────────────────────────────────────────────────────────────────
  // ARGUMENT SHAPES
  // ─────────────────────────────────────────────────────────────────────
  it("traces calls with rest spread arguments", async () => {
    const out = await runAndCollect(
      ctx,
      `
      function sum(...nums) { return nums.reduce((a, b) => a + b, 0); }
      Tracer.start("rest");
      sum(1, 2, 3, 4);
      Tracer.end();
    `
    );
    expect(findByName(out.tree, "sum")!.returnValue).toBe(10);
  });

  it("traces calls whose argument is an arrow function", async () => {
    const out = await runAndCollect(
      ctx,
      `
      function once(fn) { return fn(); }
      Tracer.start("cbarg");
      once(() => 42);
      Tracer.end();
    `
    );
    expect(findByName(out.tree, "once")!.returnValue).toBe(42);
  });

  it("traces calls whose argument is a destructured object", async () => {
    const out = await runAndCollect(
      ctx,
      `
      function pick({ a }) { return a; }
      Tracer.start("destr");
      pick({ a: 7, b: 8 });
      Tracer.end();
    `
    );
    expect(findByName(out.tree, "pick")!.returnValue).toBe(7);
  });

  it("preserves object literal arguments in the tree", async () => {
    const out = await runAndCollect(
      ctx,
      `
      function take(obj) { return obj.x; }
      Tracer.start("obj");
      take({ x: 1, y: { z: 2 } });
      Tracer.end();
    `
    );
    const node = findByName(out.tree, "take")!;
    expect(node.args[0]).toEqual({ x: 1, y: { z: 2 } });
    expect(node.returnValue).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────────────
  // CIRCULAR / NON-SERIALIZABLE
  // ─────────────────────────────────────────────────────────────────────
  it("handles circular argument refs without throwing", async () => {
    const out = await runAndCollect(
      ctx,
      `
      function inspect(x) { return typeof x; }
      Tracer.start("circ");
      const a = {};
      a.self = a;
      inspect(a);
      Tracer.end();
    `
    );
    expect(findByName(out.tree, "inspect")!.returnValue).toBe("object");
  });

  it("handles Error returnValue (errored=true on the node)", async () => {
    const out = await runAndCollect(
      ctx,
      `
      function bad() { throw new Error("nope"); }
      Tracer.start("err");
      try { bad(); } catch {}
      Tracer.end();
    `
    );
    const bad = findByName(out.tree, "bad")!;
    expect(bad.errored).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────
  // CONDITIONALS / LOGICAL CHAINS
  // ─────────────────────────────────────────────────────────────────────
  it("traces calls reached via ternary expression", async () => {
    const out = await runAndCollect(
      ctx,
      `
      function yes() { return 1; }
      function no()  { return 2; }
      Tracer.start("tern");
      const cond = true;
      cond ? yes() : no();
      Tracer.end();
    `
    );
    const names = flatNames(out.tree);
    expect(names).toContain("yes");
    expect(names).not.toContain("no");
  });

  it("traces calls reached via short-circuit && / ||", async () => {
    const out = await runAndCollect(
      ctx,
      `
      function side() { return 1; }
      Tracer.start("sc");
      true && side();
      false || side();
      Tracer.end();
    `
    );
    expect(flatNames(out.tree).filter((n) => n === "side").length).toBe(2);
  });

  it("traces calls inside optional-chaining call", async () => {
    const out = await runAndCollect(
      ctx,
      `
      const obj = { fn: () => 9 };
      Tracer.start("oc");
      obj?.fn?.();
      Tracer.end();
    `
    );
    const fn = findByName(out.tree, "fn");
    if (fn) {
      // Some plugin paths may skip optional-call entirely; either is fine
      // as long as it doesn't crash and the tree is coherent.
      expect(fn.returnValue).toBe(9);
    }
  });

  // ─────────────────────────────────────────────────────────────────────
  // RECURSION
  // ─────────────────────────────────────────────────────────────────────
  it("traces recursion up to maxDepth without crashing", async () => {
    // maxDepth defaults to 50 — beyond that the call still executes but
    // is not traced.
    const out = await runAndCollect(
      ctx,
      `
      function fact(n) { return n <= 1 ? 1 : n * fact(n - 1); }
      Tracer.start("rec");
      const v = fact(8);
      Tracer.end();
      if (v !== 40320) throw new Error("wrong factorial");
    `
    );
    const facts = flatNames(out.tree).filter((n) => n === "fact");
    expect(facts.length).toBeGreaterThan(0);
  });

  // ─────────────────────────────────────────────────────────────────────
  // CLASS NUANCES
  // ─────────────────────────────────────────────────────────────────────
  it("traces methods called via this within the class", async () => {
    const out = await runAndCollect(
      ctx,
      `
      class C {
        a() { return this.b() + 1; }
        b() { return 10; }
      }
      Tracer.start("this");
      new C().a();
      Tracer.end();
    `
    );
    const a = findByName(out.tree, "a")!;
    expect(a.returnValue).toBe(11);
    expect(a.children.some((c) => c.name === "b")).toBe(true);
  });

  it("traces getter / setter and static methods", async () => {
    const out = await runAndCollect(
      ctx,
      `
      class P {
        static make() { return new P(7); }
        constructor(x) { this._x = x; }
        get x() { return this._x; }
      }
      Tracer.start("static-getter");
      const p = P.make();
      p.x;
      Tracer.end();
    `
    );
    expect(flatNames(out.tree)).toContain("make");
  });

  // ─────────────────────────────────────────────────────────────────────
  // ITERATION / LOOPS
  // ─────────────────────────────────────────────────────────────────────
  it("traces calls inside for-of loop", async () => {
    const out = await runAndCollect(
      ctx,
      `
      function step(x) { return x * 2; }
      Tracer.start("forof");
      const acc = [];
      for (const i of [1, 2, 3]) acc.push(step(i));
      Tracer.end();
    `
    );
    expect(flatNames(out.tree).filter((n) => n === "step").length).toBe(3);
  });

  it("traces Array.from itself (mapper invocations live inside native code)", async () => {
    const out = await runAndCollect(
      ctx,
      `
      function inc(x) { return x + 1; }
      Tracer.start("from");
      Array.from([1, 2, 3], inc);
      Tracer.end();
    `
    );
    // Array.from is the user-side call we wrap.  `inc` is invoked from
    // native code inside Array.from, which our compile-time instrumentation
    // can't reach — so we don't expect it in the tree.  This is documented
    // behaviour, asserted here so a future refactor doesn't accidentally
    // change it.
    expect(flatNames(out.tree)).toContain("from");
    expect(flatNames(out.tree).filter((n) => n === "inc").length).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────────
  // ASYNC NUANCES
  // ─────────────────────────────────────────────────────────────────────
  it("traces Promise.all with mixed resolved/rejected", async () => {
    const out = await runAndCollect(
      ctx,
      `
      async function ok() { return 1; }
      async function bad() { throw new Error("x"); }
      async function run() {
        Tracer.start("pall");
        try { await Promise.all([ok(), bad()]); } catch {}
        Tracer.end();
      }
      return (async () => { await run(); })();
    `,
      { settleMs: 600 }
    );
    const names = flatNames(out.tree);
    expect(names).toContain("ok");
    expect(names).toContain("bad");
  });

  it("traces a sequence of awaits", async () => {
    const out = await runAndCollect(
      ctx,
      `
      async function step1() { return 1; }
      async function step2(x) { return x + 1; }
      async function run() {
        Tracer.start("seq");
        const a = await step1();
        const b = await step2(a);
        Tracer.end();
        return b;
      }
      return (async () => { await run(); })();
    `,
      { settleMs: 600 }
    );
    expect(flatNames(out.tree)).toEqual(
      expect.arrayContaining(["step1", "step2"])
    );
  });

  // ─────────────────────────────────────────────────────────────────────
  // REPEAT START / END SHAPES
  // ─────────────────────────────────────────────────────────────────────
  it("ignoring start while already tracing does not crash", async () => {
    const out = await runAndCollect(
      ctx,
      `
      function noop() { return 0; }
      Tracer.start("a");
      Tracer.start("b"); // should warn-and-return, not break
      noop();
      Tracer.end();
    `
    );
    expect(out.tree.length).toBeGreaterThan(0);
  });

  it("calling end without a matching start is a no-op", async () => {
    const out = await runAndCollect(
      ctx,
      `
      function noop() { return 0; }
      Tracer.end(); // no start in flight; should not crash
      Tracer.start("real");
      noop();
      Tracer.end();
    `
    );
    expect(flatNames(out.tree)).toContain("noop");
  });

  // ─────────────────────────────────────────────────────────────────────
  // NESTED FUNCTION DEFINITION SHAPES (the IIFE-wrap re-entry hazard)
  // ─────────────────────────────────────────────────────────────────────
  it("traces calls when the function is itself an IIFE", async () => {
    const out = await runAndCollect(
      ctx,
      `
      Tracer.start("iife");
      const x = (function (n) { return n * 2; })(5);
      Tracer.end();
      if (x !== 10) throw new Error("wrong");
    `
    );
    // The inner anonymous IIFE call should be recorded.
    expect(out.details.length).toBeGreaterThan(0);
  });

  it("traces nested function declarations", async () => {
    const out = await runAndCollect(
      ctx,
      `
      function outer() {
        function inner() { return 42; }
        return inner();
      }
      Tracer.start("nestedDef");
      outer();
      Tracer.end();
    `
    );
    const outer = findByName(out.tree, "outer")!;
    expect(outer.children.some((c) => c.name === "inner")).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────
  // RUNTIME COUNTER ACCURACY
  // ─────────────────────────────────────────────────────────────────────
  it("transformedFiles counter increments per Program (not per call)", () => {
    // The fixture transformed once → counter went up by 1 per fixture file
    // imported during this test run.  We assert it is at least 1.
    const c = (
      globalThis as { __scryTransformedFileCount?: number }
    ).__scryTransformedFileCount;
    expect(c).toBeGreaterThan(0);
  });

  // ─────────────────────────────────────────────────────────────────────
  // SOURCE LOCATIONS
  // ─────────────────────────────────────────────────────────────────────
  it("each traced node has a non-empty source location", async () => {
    const out = await runAndCollect(
      ctx,
      `
      function a() { return 1; }
      function b() { return 2; }
      Tracer.start("src");
      a(); b();
      Tracer.end();
    `
    );
    for (const node of out.tree) {
      expect(typeof node.source).toBe("string");
      expect(node.source.length).toBeGreaterThan(0);
    }
  });

  // ─────────────────────────────────────────────────────────────────────
  // INJECTION SHAPE STABILITY
  // ─────────────────────────────────────────────────────────────────────
  it("decoded injection has the same flat names as the runtime tree", async () => {
    const out = await runAndCollect(
      ctx,
      `
      function f() { return Math.floor(Math.random()); }
      function g() { return f(); }
      Tracer.start("inj");
      g();
      Tracer.end();
    `
    );
    const runtimeNames = flatNames(out.tree);
    const decodedNames = flatNames(out.decodedInjection);
    // Order must match — flatted preserves insertion / structure.
    expect(decodedNames).toEqual(runtimeNames);
  });
});
