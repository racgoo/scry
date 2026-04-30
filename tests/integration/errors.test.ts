import { describe, it, expect } from "vitest";
import { traceRun, findNode, nodeNames } from "./helpers.js";
import {
  runSyncThrow,
  runSafeCatch,
  runAsyncThrow,
  runAsyncCatch,
} from "./fixtures/error.fixture.js";

describe("Integration: error handling", () => {
  it("sync throw still produces a trace node", async () => {
    const nodes = await traceRun(() => {
      try {
        runSyncThrow();
      } catch {
        // swallow
      }
    });
    expect(nodeNames(nodes)).toContain("syncThrow");
  });

  it("sync throw records an Error as returnValue", async () => {
    const nodes = await traceRun(() => {
      try {
        runSyncThrow();
      } catch {
        // swallow
      }
    });
    const node = findNode(nodes, "syncThrow");
    expect(node).toBeDefined();
    expect(node!.returnValue).toBeInstanceOf(Error);
    expect((node!.returnValue as Error).message).toBe("sync error");
  });

  it("activeTraceIdSet is cleaned up after sync throw (no timeout leak)", async () => {
    const tracer = await import("../../src/tracer/tracer.js");
    const Tracer = tracer.default;
    const t = new Tracer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = (t as any).recorder;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (t as any).currentOption;

    t.start("sync-error-cleanup");
    try {
      runSyncThrow();
    } catch {
      // expected
    }
    const bundleId: number = opts.traceBundleId;
    const start = Date.now();
    const completed = await rec.waitAllContextDone(bundleId, 5000);
    const elapsed = Date.now() - start;

    expect(completed).toBe(true);
    expect(elapsed).toBeLessThan(3000);
    const bundle = rec.getBundleMap().get(bundleId);
    expect(bundle?.activeTraceIdSet.size).toBe(0);
  });

  it("safeCatch traces both the outer and inner function", async () => {
    const nodes = await traceRun(() => {
      runSafeCatch();
    });
    const names = nodeNames(nodes);
    expect(names).toContain("safeCatch");
    expect(names).toContain("syncThrow");
  });

  it("async throw still produces a trace node", async () => {
    const nodes = await traceRun(async () => {
      try {
        await runAsyncThrow();
      } catch {
        // swallow
      }
    });
    expect(nodeNames(nodes)).toContain("asyncThrow");
  });

  it("async throw records an Error as returnValue", async () => {
    const nodes = await traceRun(async () => {
      try {
        await runAsyncThrow();
      } catch {
        // swallow
      }
    });
    const node = findNode(nodes, "asyncThrow");
    expect(node).toBeDefined();
    expect(node!.returnValue).toBeInstanceOf(Error);
    expect((node!.returnValue as Error).message).toBe("async error");
  });

  it("asyncCatch traces both outer and inner even when inner rejects", async () => {
    const nodes = await traceRun(async () => {
      await runAsyncCatch();
    });
    const names = nodeNames(nodes);
    expect(names).toContain("asyncCatch");
    expect(names).toContain("asyncThrow");
  });
});
