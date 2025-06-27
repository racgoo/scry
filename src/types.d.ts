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

export {};
