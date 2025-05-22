interface TraceNode {
  traceId: string;
  name: string;
  source: string;
  args: any[];
  children: TraceNode[];
  returnValue?: any;
  timestamp?: number;
  duration?: number;
  completed: boolean;
  chained?: boolean;
  parentTraceId?: string;
}

interface Detail {
  type: string;
  traceId: string;
  name: string;
  source: string;
  args: any[];
  chained: boolean;
  parentTraceId: string;
  returnValue: any;
}
