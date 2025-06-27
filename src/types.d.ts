interface TraceNode {
  traceId: number;
  name: string;
  source: string;
  args: unknown[];
  parent: TraceNode | null;
  children: TraceNode[];
  returnValue?: unknown;
  errored: boolean;
  completed: boolean;
  chained?: boolean;
  parentTraceId?: number;
  classCode?: string;
  methodCode?: string;
  functionCode?: string;
  context?: {
    params: string;
    result: string;
    link: string;
  };
  chainInfo?: {
    startTraceId: number;
    index: number;
  };
}

interface Detail {
  type: TraceEventType;
  traceId: number;
  name: string;
  source: string;
  args: unknown[];
  chained: boolean;
  traceBundleId: number;
  parentTraceId: number;
  returnValue: unknown;
  classCode: string;
  methodCode: string;
  functionCode: string;
  chainInfo?: {
    startTraceId: number;
    index: number;
  };
}

interface DisplayDetailResult {
  title: string;
  html: string;
  depth: number;
  chainInfo?: {
    startTraceId: number;
    index: number;
  };
}

type TraceEventType = "enter" | "exit" | "done";
