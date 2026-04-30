import dayjs from "dayjs";
import { TraceBundle, TraceDetail } from "./type.js";
import { Output } from "../../utils/output.js";
import { TraceEvent, WAIT_ALL_CONTEXT_DONE_INTERVAL } from "./constant.js";
import { Environment } from "../../utils/enviroment.js";
import { TRACE_EVENT_NAME } from "../../babel/scry.constant.js";
import { TraceRecorderInterface } from "./interface.js";

/**
 * TraceRecorder class.
 * This class is used to record the trace event and mutate bundles or details.
 * Implement TraceRecorderInterface to define the interface of the TraceRecorder.
 */
class TraceRecorder implements TraceRecorderInterface {
  private bundleMap: Map<number, TraceBundle> = new Map();
  private boundOnTrace = this.onTrace.bind(this) as EventListener;
  // Diagnostic counters — visible to Tracer.end()'s empty-bundle warning so
  // users can tell apart "events arrived but were rejected" from "events
  // never arrived at all" (the common Vite prebundle / globalThis-mismatch
  // cause).
  public _rawEventCount = 0;
  public _droppedNullBundle = 0;
  public _listenerKind: "process" | "globalThis" | "none" = "none";
  constructor() {
    this.initEventListener();
  }
  /**
   * onTrace method.
   * This method is used to handle the trace event.
   * Get detail from event and handle the trace event according to the type.
   */
  private onTrace(event: unknown) {
    this._rawEventCount++;
    //Get trace detail from event
    const detail: TraceDetail | null = this.getTraceDetail(event);
    //Check if the detail is valid
    const detailValidation = this.isValidDetail(detail);
    if (!detailValidation) {
      this._droppedNullBundle++;
      return;
    }
    //Check if the return value is error(origin error, not trace error)
    const erroredReturnValue = this.isErrorReturnValue(detail!);
    if (erroredReturnValue) this.handleErrorReturnValue(detail!);
    //Handle the trace event according to the type
    switch (detail!.type) {
      //If the type is done, context return value is done(Promise or Object, etc)
      case TraceEvent.DONE:
        return this.handleDoneType(detail!);
      //If the type is enter, context is entering a function
      case TraceEvent.ENTER:
        return this.handleEnterType(detail!);
      //If the type is exit, context is exiting a function
      case TraceEvent.EXIT:
        return this.handleExitType(detail!);
      default:
        return;
    }
  }
  /**
   * getBundleMap method.
   * This method is used to get the bundleMap.
   */
  public getBundleMap() {
    return this.bundleMap;
  }
  /**
   * initBundle method.
   * This method is used to initialize the bundle as bundleMap's [key,value] with bundleId and description.
   */
  public initBundle(bundleId: number, description?: string) {
    this.bundleMap.set(bundleId, {
      description: description || "",
      details: [],
      startTime: dayjs(),
      duration: 0,
      activeTraceIdSet: new Set(),
    });
  }
  /**
   * addDetailToBundle method.
   * This method is used to add the detail to the bundle in bundleMap.
   */
  public addDetailToBundle(detail: TraceDetail) {
    if (this.bundleMap.get(detail.traceBundleId)) {
      this.bundleMap.get(detail.traceBundleId)!.details.push(detail);
    }
  }
  /**
   * hasBundle method.
   * This method is used to check if the bundle is exists in bundleMap.
   */
  public hasBundle(bundleId: number) {
    return this.bundleMap.has(bundleId);
  }
  /**
   * getTraceDetail method.
   * This method is used to get the trace detail from event.
   */
  private getTraceDetail(event: unknown): TraceDetail | null {
    const detail: TraceDetail =
      (event as { detail?: TraceDetail }).detail ?? (event as TraceDetail);
    return detail ?? null;
  }
  /**
   * handleDoneType method.
   * This method is used to handle the done type detail.
   */
  private handleDoneType(detail: TraceDetail) {
    this.bundleMap
      .get(detail.traceBundleId)
      ?.activeTraceIdSet.delete(detail.traceId);
  }

  /**
   * handleEnterType method.
   * This method is used to handle the enter type detail.
   */
  private handleEnterType(detail: TraceDetail) {
    this.bundleMap
      .get(detail.traceBundleId)
      ?.activeTraceIdSet.add(detail.traceId);
    this.addDetailToBundle(detail);
  }
  /**
   * handleExitType method.
   * This method is used to handle the exit type detail.
   */
  private handleExitType(detail: TraceDetail) {
    this.addDetailToBundle(detail);
  }
  /**
   * isErrorReturnValue method.
   * This method is used to check if the return value in detail is error.
   */
  private isErrorReturnValue(detail: TraceDetail) {
    return detail.returnValue instanceof Error;
  }
  /**
   * handleErrorReturnValue method.
   * This method is used to handle the error return value in detail.
   */
  private handleErrorReturnValue(detail: TraceDetail) {
    Output.printError("Error return value: ", detail.returnValue);
  }
  /**
   * isValidDetail method.
   * This method is used to check if the detail is valid(not null and traceBundleId is not null).
   */
  private isValidDetail(detail: TraceDetail | null) {
    return detail !== null && detail.traceBundleId !== null;
  }
  /**
   * initEventListener method.
   * This method is used to initialize the event listener.
   * Nodejs use process event, browser use globalThis event for trace context event.
   */
  private initEventListener() {
    if (Environment.isNodeJS()) {
      process.on(TRACE_EVENT_NAME, this.boundOnTrace);
      this._listenerKind = "process";
    } else {
      globalThis.addEventListener(TRACE_EVENT_NAME, this.boundOnTrace);
      this._listenerKind = "globalThis";
    }
  }

  /**
   * destroy method.
   * Removes the event listener registered in initEventListener.
   * Call this in hot-reload / test teardown environments where a new
   * TraceRecorder instance will be created, to prevent duplicate listeners.
   */
  public destroy() {
    if (Environment.isNodeJS()) {
      process.off(TRACE_EVENT_NAME, this.boundOnTrace);
    } else {
      globalThis.removeEventListener(TRACE_EVENT_NAME, this.boundOnTrace);
    }
  }
  /**
   * isAllContextDone method.
   * This method is used to check if all context is done.
   * Check if all context is done
   */
  private isAllContextDone(bundleId: number) {
    const bundle = this.getBundleMap().get(bundleId);
    if (!bundle) {
      return true;
    }
    return bundle.activeTraceIdSet.size === 0;
  }

  /**
   * waitAllContextDone method.
   * This method is used to wait for all context to be done.
   * Returns a Promise that resolves when all async traces complete or the timeout elapses.
   * Without a timeout, an unhandled async error can leave traceIds in activeTraceIdSet
   * forever because the "done" event is never emitted, causing this method to hang indefinitely.
   */
  // Returns true when all contexts finished cleanly, false when the timeout
  // fired before all done events arrived. Callers (Tracer.end) can use this to
  // log a warning or annotate the report as potentially incomplete.
  public waitAllContextDone(
    bundleId: number,
    timeout = 5000
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (this.isAllContextDone(bundleId)) {
          clearInterval(interval);
          resolve(true);
        } else if (Date.now() - start > timeout) {
          clearInterval(interval);
          resolve(false);
        }
      }, WAIT_ALL_CONTEXT_DONE_INTERVAL);
    });
  }
}

export default TraceRecorder;
