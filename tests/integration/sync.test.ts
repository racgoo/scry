import { describe, it, expect } from "vitest";
import { traceRun, nodeNames, findNode } from "./helpers.js";
import {
  runAdd,
  runMultiply,
  runComputeSum,
  runNested,
  runMultipleCalls,
} from "./fixtures/sync.fixture.js";

describe("Integration: sync function tracing", () => {
  it("traces a simple two-argument call", async () => {
    const nodes = await traceRun(() => {
      runAdd(2, 3);
    });
    expect(nodeNames(nodes)).toContain("add");
  });

  it("records the return value of a traced function", async () => {
    const nodes = await traceRun(() => {
      runAdd(10, 5);
    });
    const addNode = findNode(nodes, "add");
    expect(addNode).toBeDefined();
    expect(addNode!.returnValue).toBe(15);
  });

  it("traces nested calls and builds a parent-child tree", async () => {
    const nodes = await traceRun(() => {
      runNested();
    });
    const names = nodeNames(nodes);
    expect(names).toContain("multiply");
    expect(names).toContain("add");
  });

  it("captures the correct return value for multiply", async () => {
    const nodes = await traceRun(() => {
      runMultiply(6, 7);
    });
    const multiplyNode = findNode(nodes, "multiply");
    expect(multiplyNode).toBeDefined();
    expect(multiplyNode!.returnValue).toBe(42);
  });

  it("traces repeated calls and produces multiple nodes", async () => {
    const nodes = await traceRun(() => {
      runComputeSum([1, 2, 3, 4]);
    });
    const names = nodeNames(nodes);
    const addCount = names.filter((n) => n === "add").length;
    expect(addCount).toBeGreaterThanOrEqual(4);
  });

  it("traces multiple distinct calls in one session", async () => {
    const nodes = await traceRun(() => {
      runMultipleCalls();
    });
    const names = nodeNames(nodes);
    expect(names).toContain("add");
    expect(names).toContain("multiply");
  });
});
