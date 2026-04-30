import { describe, it, expect } from "vitest";
import { traceRun, nodeNames, findNode } from "./helpers.js";
import {
  runFetchData,
  runProcessItems,
  runChainedAsync,
  runPromiseBased,
} from "./fixtures/async.fixture.js";

describe("Integration: async function tracing", () => {
  it("traces a single async function", async () => {
    const nodes = await traceRun(async () => {
      await runFetchData(1);
    });
    expect(nodeNames(nodes)).toContain("fetchData");
  });

  it("records the resolved value of an async function", async () => {
    const nodes = await traceRun(async () => {
      await runFetchData(42);
    });
    const node = findNode(nodes, "fetchData");
    expect(node).toBeDefined();
    expect(node!.returnValue).toEqual({ id: 42, value: "data-42" });
  });

  it("traces Promise.all fan-out", async () => {
    const nodes = await traceRun(async () => {
      await runProcessItems([1, 2, 3]);
    });
    const names = nodeNames(nodes);
    expect(names).toContain("fetchData");
    const fetchCount = names.filter((n) => n === "fetchData").length;
    expect(fetchCount).toBeGreaterThanOrEqual(3);
  });

  it("traces sequential async calls", async () => {
    const nodes = await traceRun(async () => {
      await runChainedAsync();
    });
    expect(nodeNames(nodes)).toContain("fetchData");
  });

  it("traces a raw Promise constructor call", async () => {
    const nodes = await traceRun(async () => {
      await runPromiseBased();
    });
    expect(nodeNames(nodes)).toContain("promiseBased");
  });

  it("activeTraceIdSet is empty after all async traces complete", async () => {
    const tracer = await import("../../src/tracer/tracer.js");
    const Tracer = tracer.default;
    const t = new Tracer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = (t as any).recorder;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (t as any).currentOption;

    t.start("async-cleanup-test");
    await runFetchData(99);
    const bundleId: number = opts.traceBundleId;
    const completed = await rec.waitAllContextDone(bundleId, 5000);

    expect(completed).toBe(true);
    const bundle = rec.getBundleMap().get(bundleId);
    expect(bundle?.activeTraceIdSet.size).toBe(0);
  });
});
