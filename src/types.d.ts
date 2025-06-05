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
  classCode?: string;
  methodCode?: string;
  functionCode?: string;
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
  classCode: string;
  methodCode: string;
  functionCode: string;
}

interface DisplayDetailResult {
  title: string;
  html: string;
  depth: number;
}

type TraceEventType = "enter" | "exit";
