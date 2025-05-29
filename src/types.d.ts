interface TraceNode {
  traceId: string;
  name: string;
  source: string;
  args: unknown[];
  children: TraceNode[];
  returnValue?: unknown;
  errored: boolean;
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

interface DisplayResult {
  title: string;
  url: string;
}

type TraceEventType = "enter" | "exit";
