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
  originCode?: string;
  classCode?: string;
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
  originCode: string;
  classCode: string;
}

interface DisplayDetailResult {
  title: string;
  html: string;
}

type TraceEventType = "enter" | "exit";
