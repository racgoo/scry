import { TraceEvent } from "./constant.js";

/**
 * TraceEventType.
 * This type is used to define the trace event type.
 */
type TraceEventType = (typeof TraceEvent)[keyof typeof TraceEvent];

/**
 * TraceChainInfo.
 * This type is used to define the trace chain info.
 */
interface TraceChainInfo {
  startTraceId: number;
  index: number;
}
/**
 * TraceDetail.
 * This type is used to define the trace detail.
 */
interface TraceDetail {
  type: TraceEventType;
  traceId: number;
  name: string;
  source: string;
  args: unknown[];
  traceBundleId: number;
  parentTraceId: number | null;
  returnValue: unknown;
  classCode: string;
  methodCode: string;
  functionCode: string;
  chained: boolean;
  chainInfo?: TraceChainInfo;
}

/**
 * TraceBundle.
 * This type is used to define the trace bundle.
 */
interface TraceBundle {
  description: string;
  details: TraceDetail[];
  // startTime is captured as a millisecond epoch (Date.now()) so the
  // recorder has zero runtime dependencies and survives Vite's
  // optimizeDeps prebundler / cjs-esm interop edge cases.  Was
  // previously dayjs.Dayjs which forced consumers to deal with dayjs's
  // cjs default export when they excluded scry from prebundling.
  startTime: number;
  duration: number;
  activeTraceIdSet: Set<number>;
}

export type { TraceBundle, TraceDetail, TraceEventType };
