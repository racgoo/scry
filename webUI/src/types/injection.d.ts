// Mirror of src/tracer/node/type.ts in the main package — kept inline so the
// WebUI builds standalone (it gets bundled into a single self-contained HTML).

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
  parentTraceId?: number | null;
  classCode?: string;
  methodCode?: string;
  functionCode?: string;
  context?: TraceNodeContext;
  chainInfo?: TraceChainInfo;
}

export type { TraceNode, TraceNodeContext, TraceChainInfo };

declare global {
  interface Window {
    __INJECTION_DATA__: string;
    __INJECTION_META__?: {
      description: string;
      startTimeISO: string;
      durationMs: number;
    };
  }
}
