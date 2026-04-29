import { describe, it, expect, beforeEach, afterEach } from "vitest";
import TraceRecorder from "../../src/tracer/record/TracerRecorder.js";
import { TRACE_EVENT_NAME } from "../../src/babel/scry.constant.js";
import { TraceEvent } from "../../src/tracer/record/constant.js";
import type { TraceDetail } from "../../src/tracer/record/type.js";

function makeDetail(
  overrides: Partial<TraceDetail> = {}
): TraceDetail {
  return {
    type: TraceEvent.ENTER,
    traceId: 1,
    traceBundleId: 1,
    parentTraceId: null,
    name: "testFn",
    source: "test.ts",
    args: [],
    returnValue: undefined,
    chained: false,
    ...overrides,
  };
}

function emitDetail(detail: TraceDetail) {
  // TracerRecorder listens via process.on in Node.js
  process.emit(TRACE_EVENT_NAME as "uncaughtException", detail as never);
}

describe("Unit: TracerRecorder", () => {
  let recorder: TraceRecorder;

  beforeEach(() => {
    recorder = new TraceRecorder();
    recorder.initBundle(1, "test-bundle");
  });

  afterEach(() => {
    recorder.destroy();
  });

  it("adds traceId to activeTraceIdSet on ENTER", () => {
    const detail = makeDetail({ type: TraceEvent.ENTER, traceId: 10 });
    emitDetail(detail);
    const bundle = recorder.getBundleMap().get(1)!;
    expect(bundle.activeTraceIdSet.has(10)).toBe(true);
  });

  it("removes traceId from activeTraceIdSet on DONE", () => {
    const enter = makeDetail({ type: TraceEvent.ENTER, traceId: 10 });
    const done = makeDetail({ type: TraceEvent.DONE, traceId: 10 });
    emitDetail(enter);
    emitDetail(done);
    const bundle = recorder.getBundleMap().get(1)!;
    expect(bundle.activeTraceIdSet.has(10)).toBe(false);
  });

  it("addDetailToBundle appends to details array", () => {
    const d = makeDetail({ type: TraceEvent.ENTER, traceId: 5 });
    emitDetail(d);
    const bundle = recorder.getBundleMap().get(1)!;
    expect(bundle.details.length).toBeGreaterThan(0);
    expect(bundle.details[0].traceId).toBe(5);
  });

  it("isAllContextDone returns true when activeTraceIdSet is empty", async () => {
    const enter = makeDetail({ type: TraceEvent.ENTER, traceId: 20 });
    const done = makeDetail({ type: TraceEvent.DONE, traceId: 20 });
    emitDetail(enter);
    emitDetail(done);
    const completed = await recorder.waitAllContextDone(1, 3000);
    expect(completed).toBe(true);
  });

  it("waitAllContextDone returns false on timeout when set not empty", async () => {
    const enter = makeDetail({ type: TraceEvent.ENTER, traceId: 99 });
    emitDetail(enter);
    // Don't emit DONE — should timeout
    const completed = await recorder.waitAllContextDone(1, 100);
    expect(completed).toBe(false);
  });

  it("destroy() removes the event listener (no double-processing)", () => {
    const rec2 = new TraceRecorder();
    rec2.initBundle(1, "bundle2");
    rec2.destroy(); // listener removed

    const enter = makeDetail({ type: TraceEvent.ENTER, traceId: 55 });
    emitDetail(enter);

    // rec2's bundle should NOT have the event (listener was removed)
    const bundle = rec2.getBundleMap().get(1)!;
    expect(bundle.details.length).toBe(0);
  });

  it("ignores events for non-existent bundles", () => {
    const detail = makeDetail({ type: TraceEvent.ENTER, traceBundleId: 999 });
    // Should not throw
    expect(() => emitDetail(detail)).not.toThrow();
  });
});
