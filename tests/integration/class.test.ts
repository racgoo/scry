import { describe, it, expect } from "vitest";
import { traceRun, nodeNames, findNode } from "./helpers.js";
import {
  runCalculatorAdd,
  runCalculatorMultiple,
  runAsyncService,
  runBatchProcess,
} from "./fixtures/class.fixture.js";

describe("Integration: class method tracing", () => {
  it("traces a synchronous class method", async () => {
    const nodes = await traceRun(() => {
      runCalculatorAdd(3, 4);
    });
    expect(nodeNames(nodes)).toContain("add");
  });

  it("records the return value of a class method", async () => {
    const nodes = await traceRun(() => {
      runCalculatorAdd(10, 20);
    });
    const node = findNode(nodes, "add");
    expect(node).toBeDefined();
    expect(node!.returnValue).toBe(30);
  });

  it("traces multiple methods on the same instance", async () => {
    const nodes = await traceRun(() => {
      runCalculatorMultiple();
    });
    const names = nodeNames(nodes);
    expect(names).toContain("add");
    expect(names).toContain("multiply");
    expect(names).toContain("getHistory");
  });

  it("classCode or functionCode is populated for method nodes", async () => {
    const nodes = await traceRun(() => {
      runCalculatorAdd(1, 2);
    });
    const node = findNode(nodes, "add");
    expect(node).toBeDefined();
    expect(!!(node!.classCode ?? node!.functionCode)).toBe(true);
  });

  it("traces async class methods", async () => {
    const nodes = await traceRun(async () => {
      await runAsyncService(7);
    });
    expect(nodeNames(nodes)).toContain("fetchAndProcess");
  });

  it("async class method records the resolved value", async () => {
    const nodes = await traceRun(async () => {
      await runAsyncService(7);
    });
    const node = findNode(nodes, "fetchAndProcess");
    expect(node).toBeDefined();
    expect(node!.returnValue).toBe("processed-7");
  });

  it("batchProcess traces all parallel async method calls", async () => {
    const nodes = await traceRun(async () => {
      await runBatchProcess([1, 2, 3]);
    });
    const names = nodeNames(nodes);
    const fetchCount = names.filter((n) => n === "fetchAndProcess").length;
    expect(fetchCount).toBeGreaterThanOrEqual(3);
  });
});
