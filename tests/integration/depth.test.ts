import { describe, it, expect } from "vitest";
import { traceRun, findNode } from "./helpers.js";
import {
  runFactorial,
  runFibonacci,
  runDeepRecurse,
} from "./fixtures/recursive.fixture.js";

describe("Integration: maxDepth guard", () => {
  it("traces factorial without hanging on deep recursion", async () => {
    const nodes = await traceRun(() => {
      runFactorial(10);
    });
    expect(findNode(nodes, "factorial")).toBeDefined();
  });

  it("factorial(10) returns the correct value", async () => {
    const nodes = await traceRun(() => {
      runFactorial(10);
    });
    const root = findNode(nodes, "factorial");
    expect(root).toBeDefined();
    expect(root!.returnValue).toBe(3628800);
  });

  it("traces fibonacci without exponential Zone overhead", async () => {
    const nodes = await traceRun(() => {
      runFibonacci(8);
    });
    expect(findNode(nodes, "fibonacci")).toBeDefined();
  });

  it("fibonacci(8) returns the correct value", async () => {
    const nodes = await traceRun(() => {
      runFibonacci(8);
    });
    expect(findNode(nodes, "fibonacci")!.returnValue).toBe(21);
  });

  it("deepRecurse completes within reasonable time (maxDepth guard fires)", async () => {
    const start = Date.now();
    const nodes = await traceRun(() => {
      runDeepRecurse(100);
    });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10000);
    expect(findNode(nodes, "deepRecurse")).toBeDefined();
  });

  it("deepRecurse returns the correct total", async () => {
    const nodes = await traceRun(() => {
      runDeepRecurse(5);
    });
    expect(findNode(nodes, "deepRecurse")!.returnValue).toBe(5);
  });
});
