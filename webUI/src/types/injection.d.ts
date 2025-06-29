//이건 Scry에 있는거라 모노레포로 바꾸면 좋을듯???

interface TraceNodeContext {
  params: string;
  result: string;
  link: string;
}

interface TraceChainInfo {
  startTraceId: number;
  index: number;
}

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
  context?: TraceNodeContext;
  chainInfo?: TraceChainInfo;
}

export type { TraceNode, TraceNodeContext };

declare global {
  interface Window {
    __INJECTION_DATA__: string;
  }
}
