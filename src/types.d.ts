interface TraceNode {
  traceId: string;
  name: string;
  source: string;
  args: unknown[];
  children: TraceNode[];
  returnValue?: unknown;
  timestamp?: number;
  duration?: number;
  completed: boolean;
  chained?: boolean;
  parentTraceId?: string;
  context?: {
    params: string;
    result: string;
    link: string;
  };
}

interface Detail {
  type: TraceEventType;
  traceId: string;
  name: string;
  source: string;
  args: unknown[];
  chained: boolean;
  parentTraceId: string;
  returnValue: unknown;
}

type TraceEventType = "enter" | "exit";
