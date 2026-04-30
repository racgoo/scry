import { describe, it, expect } from "vitest";
import { NodeGenerator } from "../../src/tracer/node/nodeGenerator.js";
import { TraceEvent } from "../../src/tracer/record/constant.js";
import type { TraceDetail } from "../../src/tracer/record/type.js";

function makeEnter(
  traceId: number,
  parentTraceId: number | null,
  name = `fn${traceId}`
): TraceDetail {
  return {
    type: TraceEvent.ENTER,
    traceId,
    traceBundleId: 1,
    parentTraceId,
    name,
    source: "test.ts",
    args: [],
    returnValue: undefined,
    chained: false,
  };
}

function makeExit(
  traceId: number,
  returnValue: unknown = undefined
): TraceDetail {
  return {
    type: TraceEvent.EXIT,
    traceId,
    traceBundleId: 1,
    parentTraceId: null,
    name: `fn${traceId}`,
    source: "test.ts",
    args: [],
    returnValue,
    chained: false,
  };
}

describe("Unit: NodeGenerator", () => {
  const gen = new NodeGenerator();

  it("generates a single root node from an enter+exit pair", () => {
    const details: TraceDetail[] = [
      makeEnter(1, null, "root"),
      makeExit(1, "result"),
    ];
    const nodes = gen.generateNodesWithTraceDetails(details);
    expect(nodes.length).toBe(1);
    expect(nodes[0].name).toBe("root");
  });

  it("records the returnValue from the exit event", () => {
    const details: TraceDetail[] = [
      makeEnter(1, null, "fn"),
      makeExit(1, 42),
    ];
    const nodes = gen.generateNodesWithTraceDetails(details);
    expect(nodes[0].returnValue).toBe(42);
  });

  it("builds a parent-child tree from nested enter events", () => {
    const details: TraceDetail[] = [
      makeEnter(1, null, "parent"),
      makeEnter(2, 1, "child"),
      makeExit(2, "child-ret"),
      makeExit(1, "parent-ret"),
    ];
    const nodes = gen.generateNodesWithTraceDetails(details);
    expect(nodes.length).toBe(1);
    expect(nodes[0].name).toBe("parent");
    expect(nodes[0].children.length).toBe(1);
    expect(nodes[0].children[0].name).toBe("child");
  });

  it("handles multiple sibling root nodes", () => {
    const details: TraceDetail[] = [
      makeEnter(1, null, "a"),
      makeExit(1),
      makeEnter(2, null, "b"),
      makeExit(2),
    ];
    const nodes = gen.generateNodesWithTraceDetails(details);
    const names = nodes.map((n) => n.name);
    expect(names).toContain("a");
    expect(names).toContain("b");
  });

  it("returns an empty array for empty details", () => {
    const nodes = gen.generateNodesWithTraceDetails([]);
    expect(nodes).toEqual([]);
  });

  it("handles enter without matching exit (incomplete trace)", () => {
    const details: TraceDetail[] = [makeEnter(1, null, "orphan")];
    // Should not throw
    expect(() =>
      gen.generateNodesWithTraceDetails(details)
    ).not.toThrow();
  });

  it("deep nesting does not throw (3 levels)", () => {
    const details: TraceDetail[] = [
      makeEnter(1, null, "L1"),
      makeEnter(2, 1, "L2"),
      makeEnter(3, 2, "L3"),
      makeExit(3, "c"),
      makeExit(2, "b"),
      makeExit(1, "a"),
    ];
    const nodes = gen.generateNodesWithTraceDetails(details);
    expect(nodes[0].name).toBe("L1");
    expect(nodes[0].children[0].name).toBe("L2");
    expect(nodes[0].children[0].children[0].name).toBe("L3");
  });
});
