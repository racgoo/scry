import { TraceDetail, TraceBundle } from "./type";

/**
 * TraceRecorderInterface.
 * This interface is used to define the interface of the TraceRecorder.
 */
interface TraceRecorderInterface {
  getBundleMap(): Map<number, TraceBundle>;
  initBundle(bundleId: number, description?: string): void;
  hasBundle(bundleId: number): boolean;
  addDetailToBundle(detail: TraceDetail): void;
}

export { TraceRecorderInterface };
