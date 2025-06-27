import dayjs from "dayjs";
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
  parentTraceId: number;
  returnValue: unknown;
  classCode: string;
  methodCode: string;
  functionCode: string;
  chained: boolean;
  chainInfo?: TraceChainInfo;
}

/**
 * TraceRecord.
 * This type is used to define the trace record.
 */
interface TraceRecord {
  description: string;
  details: TraceDetail[];
  startTime: dayjs.Dayjs;
  duration: number;
  activeTraceIdSet: Set<number>;
}

export { TraceRecord, TraceDetail, TraceEventType };
